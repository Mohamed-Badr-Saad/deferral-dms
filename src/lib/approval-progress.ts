import { db } from "@/src/db";
import {
  deferralApprovals,
  deferrals,
  notifications,
  users,
} from "@/src/db/schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * Notify all assignees for approvals at (deferralId, stepOrder)
 * Broadcast rules:
 * - If assignedUserId exists -> notify that user
 * - Else notify all users with the stepRole, scoped by:
 *   - targetDepartment (if present) -> users.department must match
 *   - targetGmGroup (if present) -> users.gmGroup must match
 */
export async function notifyAssigneesForStep(
  deferralId: string,
  stepOrder: number,
) {
  const approvals = await db
    .select()
    .from(deferralApprovals)
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        eq(deferralApprovals.stepOrder, stepOrder),
        eq(deferralApprovals.status, "PENDING"),
        eq(deferralApprovals.isActive, true),
      ),
    );

  if (approvals.length === 0) return;

  const userIds = new Set<string>();

  for (const a of approvals) {
    // 1) specific assignment
    if ((a as any).assignedUserId) {
      userIds.add((a as any).assignedUserId as string);
      continue;
    }

    // 2) broadcast role + optional scope
    const role = String((a as any).stepRole ?? "");
    const targetDept = (a as any).targetDepartment as string | null;
    const targetGmGroup = (a as any).targetGmGroup as string | null;

    // build where clause
    const whereParts: any[] = [eq(users.role as any, role as any)];

    if (targetDept)
      whereParts.push(eq(users.department as any, targetDept as any));
    if (targetGmGroup)
      whereParts.push(eq(users.gmGroup as any, targetGmGroup as any));

    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(...whereParts));

    for (const r of rows) userIds.add(r.id);
  }

  // Send notifications
  for (const uid of userIds) {
    await notifyUser(
      uid,
      "Action required",
      "A deferral requires your action.",
      deferralId,
    );
  }
}

/**
 * Activate all approvals in the smallest step_order that still has PENDING approvals.
 */
export async function activateFirstPendingStep(deferralId: string) {
  const pending = await db
    .select()
    .from(deferralApprovals)
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        eq(deferralApprovals.status, "PENDING"),
      ),
    )
    .orderBy(asc(deferralApprovals.stepOrder));

  const first = pending[0];
  if (!first) return;

  await db
    .update(deferralApprovals)
    .set({ isActive: true } as any)
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        eq(deferralApprovals.stepOrder, first.stepOrder),
      ),
    );

  // ✅ notify the newly-active step assignees
  await notifyAssigneesForStep(deferralId, first.stepOrder);
}

/**
 * Keep your old name for compatibility.
 */
export async function activateFirstStep(deferralId: string) {
  return activateFirstPendingStep(deferralId);
}

/**
 * Advance workflow when a step (or a member of a parallel step) is completed.
 */
export async function afterApprovalAdvance(deferralId: string) {
  // Find current active step_order (lowest)
  const active = await db
    .select()
    .from(deferralApprovals)
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        eq(deferralApprovals.isActive, true),
      ),
    )
    .orderBy(asc(deferralApprovals.stepOrder));

  // If no active steps, activate first pending step (recovery mode)
  if (active.length === 0) {
    await activateFirstPendingStep(deferralId);
    return;
  }

  const currentStepOrder = active[0].stepOrder;

  // If anything in the current step_order is still PENDING, we can't advance.
  const stillPending = await db
    .select()
    .from(deferralApprovals)
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        eq(deferralApprovals.stepOrder, currentStepOrder),
        eq(deferralApprovals.status, "PENDING"),
      ),
    );

  if (stillPending.length > 0) return;

  // Deactivate the current step_order
  await db
    .update(deferralApprovals)
    .set({ isActive: false } as any)
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        eq(deferralApprovals.stepOrder, currentStepOrder),
      ),
    );

  // Find the next step_order that has any PENDING approvals
  const nextPending = await db
    .select()
    .from(deferralApprovals)
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        eq(deferralApprovals.status, "PENDING"),
      ),
    )
    .orderBy(asc(deferralApprovals.stepOrder));

  if (nextPending.length === 0) {
    // ✅ workflow complete
    await db
      .update(deferrals)
      .set({ status: "COMPLETED", updatedAt: new Date() } as any)
      .where(eq(deferrals.id, deferralId));

    // ✅ notify initiator ONLY when fully approved
    const d = await db
      .select({ initiatorUserId: deferrals.initiatorUserId })
      .from(deferrals)
      .where(eq(deferrals.id, deferralId))
      .limit(1);

    const initiatorUserId = d[0]?.initiatorUserId;
    if (initiatorUserId) {
      await notifyUser(
        initiatorUserId,
        "Deferral fully approved",
        "Your deferral has been fully approved and completed.",
        deferralId,
      );
    }

    return;
  }

  const nextOrder = nextPending[0].stepOrder;

  // Activate all approvals in nextOrder (parallel support)
  await db
    .update(deferralApprovals)
    .set({ isActive: true } as any)
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        eq(deferralApprovals.stepOrder, nextOrder),
      ),
    );

  // ✅ notify the newly-active step assignees
  await notifyAssigneesForStep(deferralId, nextOrder);
}

export async function notifyUser(
  userId: string,
  title: string,
  body: string,
  deferralId?: string | null,
) {
  await db.insert(notifications).values({
    id: randomUUID(),
    userId,
    deferralId: deferralId ?? null,
    title,
    body,
    isRead: false,
    // createdAt defaults in DB; readAt stays null
  } as any);
}
