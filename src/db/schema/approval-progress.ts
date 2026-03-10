import { db } from "@/src/db";
import {
  deferralApprovals,
  deferrals,
  notifications,
  users,
} from "@/src/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

async function getCurrentCycle(deferralId: string): Promise<number> {
  const d = await db
    .select({ cycle: deferrals.approvalCycle })
    .from(deferrals)
    .where(eq(deferrals.id, deferralId))
    .limit(1);

  return Number(d[0]?.cycle ?? 0);
}

/**
 * Notify all assignees for approvals at (deferralId, stepOrder) in the CURRENT cycle
 */
export async function notifyAssigneesForStep(
  deferralId: string,
  stepOrder: number,
) {
  const cycle = await getCurrentCycle(deferralId);

  const approvals = await db
    .select()
    .from(deferralApprovals)
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        eq(deferralApprovals.cycle, cycle),
        eq(deferralApprovals.stepOrder, stepOrder),
        eq(deferralApprovals.status, "PENDING"),
        eq(deferralApprovals.isActive, true),
      ),
    );

  if (approvals.length === 0) return;

  const userIds = new Set<string>();

  for (const a of approvals as any[]) {
    if (a.assignedUserId) {
      userIds.add(a.assignedUserId);
      continue;
    }

    const role = String(a.stepRole ?? "");
    const targetDept = a.targetDepartment as string | null;
    const targetGmGroup = a.targetGmGroup as string | null;

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
 * Activate all approvals in the smallest step_order that still has PENDING approvals (CURRENT cycle).
 */
export async function activateFirstPendingStep(deferralId: string) {
  const cycle = await getCurrentCycle(deferralId);

  const pending = await db
    .select()
    .from(deferralApprovals)
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        eq(deferralApprovals.cycle, cycle),
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
        eq(deferralApprovals.cycle, cycle),
        eq(deferralApprovals.stepOrder, first.stepOrder),
      ),
    );

  await notifyAssigneesForStep(deferralId, first.stepOrder);
}

export async function activateFirstStep(deferralId: string) {
  return activateFirstPendingStep(deferralId);
}

/**
 * Advance workflow in CURRENT cycle when a step is completed.
 */
export async function afterApprovalAdvance(deferralId: string) {
  const cycle = await getCurrentCycle(deferralId);

  const active = await db
    .select()
    .from(deferralApprovals)
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        eq(deferralApprovals.cycle, cycle),
        eq(deferralApprovals.isActive, true),
      ),
    )
    .orderBy(asc(deferralApprovals.stepOrder));

  if (active.length === 0) {
    await activateFirstPendingStep(deferralId);
    return;
  }

  const currentStepOrder = active[0].stepOrder;

  const stillPending = await db
    .select()
    .from(deferralApprovals)
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        eq(deferralApprovals.cycle, cycle),
        eq(deferralApprovals.stepOrder, currentStepOrder),
        eq(deferralApprovals.status, "PENDING"),
      ),
    );

  if (stillPending.length > 0) return;

  await db
    .update(deferralApprovals)
    .set({ isActive: false } as any)
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        eq(deferralApprovals.cycle, cycle),
        eq(deferralApprovals.stepOrder, currentStepOrder),
      ),
    );

  const nextPending = await db
    .select()
    .from(deferralApprovals)
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        eq(deferralApprovals.cycle, cycle),
        eq(deferralApprovals.status, "PENDING"),
      ),
    )
    .orderBy(asc(deferralApprovals.stepOrder));

  if (nextPending.length === 0) {
    await db
      .update(deferrals)
      .set({ status: "COMPLETED", updatedAt: new Date() } as any)
      .where(eq(deferrals.id, deferralId));

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

  await db
    .update(deferralApprovals)
    .set({ isActive: true } as any)
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        eq(deferralApprovals.cycle, cycle),
        eq(deferralApprovals.stepOrder, nextOrder),
      ),
    );

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
    deferralCodeSnapshot: deferralId
      ? ((
          await db
            .select({ code: deferrals.deferralCode })
            .from(deferrals)
            .where(eq(deferrals.id, deferralId))
            .limit(1)
        )?.[0]?.code ?? null)
      : null,
    equipmentTagSnapshot: deferralId
      ? ((
          await db
            .select({ equipmentTag: deferrals.equipmentTag })
            .from(deferrals)
            .where(eq(deferrals.id, deferralId))
            .limit(1)
        )?.[0]?.equipmentTag ?? null)
      : null,
  } as any);
}
