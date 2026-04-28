import { NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import {
  deferrals,
  deferralApprovals,
  deferralMitigations,
  notifications,
  users,
  workOrderDeferrals,
} from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { z } from "zod";

const MitigationInputSchema = z.object({
  id: z.string().optional(),
  mitigationText: z.string().trim().min(1, "Mitigation text is required"),
  requiredDepartment: z
    .string()
    .trim()
    .min(1, "Required department is required"),
});

const UpdateSchema = z.object({
  workOrderNo: z.string().trim().min(1).optional(),
  workOrderTitle: z.string().trim().min(1).optional(),
  equipmentTag: z.string().trim().min(1).optional(),
  equipmentDescription: z.string().trim().min(1).optional(),
  taskCriticality: z.string().trim().min(1).optional(),
  safetyCriticality: z.string().trim().min(1).optional(),
  originalLafd: z.string().optional(),
  lafdStartDate: z.string().optional(),
  lafdEndDate: z.string().optional(),
  description: z.string().trim().min(1).optional(),
  justification: z.string().trim().min(1).optional(),
  consequence: z.string().trim().min(1).optional(),
  mitigations: z.array(MitigationInputSchema).optional(),
  action: z.enum(["save", "close", "soft_delete"]).optional(),
  reason: z.string().trim().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

function addMonthsSafe(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function validateLafdWindow(
  originalLafd: Date | null,
  currentLafd: Date | null,
  newLafd: Date | null,
) {
  const base = currentLafd ?? originalLafd;
  if (!base || !newLafd) return null;

  if (newLafd.getTime() <= base.getTime()) {
    return "Deferred To (New LAFD) must be greater than Current LAFD.";
  }

  const max = addMonthsSafe(base, 6);
  if (newLafd.getTime() > max.getTime()) {
    return "Deferred To (New LAFD) cannot be more than 6 months from Current LAFD.";
  }

  return null;
}

async function getDeferralById(id: string) {
  const rows = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, id))
    .limit(1);

  return rows[0] ?? null;
}

async function getInitiatorById(userId: string) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return rows[0] ?? null;
}

async function getApprovals(deferralId: string) {
  const rows = await db
    .select({
      id: deferralApprovals.id,
      deferralId: deferralApprovals.deferralId,
      stepOrder: deferralApprovals.stepOrder,
      stepRole: deferralApprovals.stepRole,
      cycle: deferralApprovals.cycle,
      status: deferralApprovals.status,
      comment: deferralApprovals.comment,
      isActive: deferralApprovals.isActive,
      assignedUserId: deferralApprovals.assignedUserId,
      targetDepartment: deferralApprovals.targetDepartment,
      targetGmGroup: deferralApprovals.targetGmGroup,
      signedByUserId: deferralApprovals.signedByUserId,
      signatureUrlSnapshot: deferralApprovals.signatureUrlSnapshot,
      signedByNameSnapshot: deferralApprovals.signedByNameSnapshot,
      signedAt: deferralApprovals.signedAt,
      createdAt: deferralApprovals.createdAt,
      updatedAt: deferralApprovals.updatedAt,

      assignedUserName: users.name,
      assignedUserEmail: users.email,
      assignedUserRole: users.role,
      assignedUserDepartment: users.department,
    })
    .from(deferralApprovals)
    .leftJoin(users, eq(users.id, deferralApprovals.assignedUserId))
    .where(eq(deferralApprovals.deferralId, deferralId))
    .orderBy(asc(deferralApprovals.stepOrder), asc(deferralApprovals.cycle));

  return rows.map((a) => ({
    id: a.id,
    deferralId: a.deferralId,
    stepOrder: a.stepOrder,
    stepRole: a.stepRole,
    cycle: a.cycle,
    status: a.status,
    comment: a.comment,
    isActive: a.isActive,
    assignedUserId: a.assignedUserId,
    targetDepartment: a.targetDepartment,
    targetGmGroup: a.targetGmGroup,
    signedByUserId: a.signedByUserId,
    signatureUrlSnapshot: a.signatureUrlSnapshot,
    signedByNameSnapshot: a.signedByNameSnapshot,
    signedAt: a.signedAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    assignedUser: a.assignedUserId
      ? {
          id: a.assignedUserId,
          name: a.assignedUserName,
          email: a.assignedUserEmail,
          role: a.assignedUserRole,
          department: a.assignedUserDepartment,
        }
      : null,
  }));
}

async function getMitigations(deferralId: string) {
  const rows = await db
    .select()
    .from(deferralMitigations)
    .where(eq(deferralMitigations.deferralId, deferralId))
    .orderBy(asc(deferralMitigations.createdAt));

  return rows.map((m) => ({
    ...m,
    mitigationText: m.description,
  }));
}

async function getWorkOrderLink(deferralId: string) {
  const rows = await db
    .select()
    .from(workOrderDeferrals)
    .where(eq(workOrderDeferrals.deferralId, deferralId))
    .limit(1);

  return rows[0] ?? null;
}

async function markNotificationsFulfilled(deferralId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.deferralId, deferralId),
        isNull(notifications.readAt),
      ),
    );
}

async function buildDeferralResponse(id: string) {
  const deferral = await getDeferralById(id);
  if (!deferral) return null;

  const [initiator, approvals, mitigationRows, workOrderLink] =
    await Promise.all([
      getInitiatorById(deferral.initiatorUserId),
      getApprovals(id),
      getMitigations(id),
      getWorkOrderLink(id),
    ]);

  return {
    ...deferral,
    initiator,
    approvals,
    mitigationRows,
    workOrderLink,
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id || id === "undefined") {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  const payload = await buildDeferralResponse(id);

  if (!payload) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item: payload }, { status: 200 });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id || id === "undefined") {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = UpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation error", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const item = await getDeferralById(id);
  if (!item) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (item.initiatorUserId !== profile.id) {
    return NextResponse.json({ message: "Permission denied" }, { status: 403 });
  }

  if (!(item.status === "DRAFT" || item.status === "RETURNED")) {
    return NextResponse.json(
      {
        message: "Validation error",
        detail: "Only drafts/returned can be edited",
      },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const next: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.workOrderNo !== undefined) next.workOrderNo = data.workOrderNo;
  if (data.workOrderTitle !== undefined)
    next.workOrderTitle = data.workOrderTitle;
  if (data.equipmentTag !== undefined) next.equipmentTag = data.equipmentTag;
  if (data.equipmentDescription !== undefined)
    next.equipmentDescription = data.equipmentDescription;
  if (data.taskCriticality !== undefined)
    next.taskCriticality = data.taskCriticality;
  if (data.safetyCriticality !== undefined)
    next.safetyCriticality = data.safetyCriticality;
  if (data.description !== undefined) next.description = data.description;
  if (data.justification !== undefined) next.justification = data.justification;
  if (data.consequence !== undefined) next.consequence = data.consequence;

  if (data.originalLafd !== undefined) {
    next.originalLafd = data.originalLafd ? new Date(data.originalLafd) : null;
  }
  if (data.lafdStartDate !== undefined) {
    next.lafdStartDate = data.lafdStartDate
      ? new Date(data.lafdStartDate)
      : null;
  }
  if (data.lafdEndDate !== undefined) {
    next.lafdEndDate = data.lafdEndDate ? new Date(data.lafdEndDate) : null;
  }

  const effectiveOriginal =
    "originalLafd" in next ? next.originalLafd : item.originalLafd;
  const effectiveCurrent =
    "lafdStartDate" in next ? next.lafdStartDate : item.lafdStartDate;
  const effectiveNew =
    "lafdEndDate" in next ? next.lafdEndDate : item.lafdEndDate;

  const lafdErr = validateLafdWindow(
    effectiveOriginal ? new Date(effectiveOriginal as string | Date) : null,
    effectiveCurrent ? new Date(effectiveCurrent as string | Date) : null,
    effectiveNew ? new Date(effectiveNew as string | Date) : null,
  );

  if (lafdErr) {
    return NextResponse.json(
      { message: "Validation error", detail: lafdErr },
      { status: 400 },
    );
  }

  const nextSeverity = item.severity ?? 1;
  const nextLikelihood = String(item.likelihood ?? "A").toUpperCase();

  if (
    data.taskCriticality !== undefined ||
    data.safetyCriticality !== undefined
  ) {
    next.severity = nextSeverity;
    next.likelihood = nextLikelihood;
  }

  await db.update(deferrals).set(next).where(eq(deferrals.id, id));

  if (data.mitigations !== undefined) {
    await db
      .delete(deferralMitigations)
      .where(eq(deferralMitigations.deferralId, id));

    if (data.mitigations.length > 0) {
      await db.insert(deferralMitigations).values(
        data.mitigations.map((m) => ({
          id: crypto.randomUUID(),
          deferralId: id,
          description: m.mitigationText.trim(),
          requiredDepartment: m.requiredDepartment.trim(),
        })),
      );
    }
  }

  const payload = await buildDeferralResponse(id);

  return NextResponse.json({ item: payload }, { status: 200 });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id || id === "undefined") {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  const item = await getDeferralById(id);

  if (!item) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (item.initiatorUserId !== profile.id) {
    return NextResponse.json({ message: "Permission denied" }, { status: 403 });
  }

  if (item.status !== "DRAFT") {
    return NextResponse.json(
      { message: "Validation error", detail: "Only drafts can be deleted" },
      { status: 400 },
    );
  }

  await db
    .delete(deferralApprovals)
    .where(eq(deferralApprovals.deferralId, id));
  await db
    .delete(deferralMitigations)
    .where(eq(deferralMitigations.deferralId, id));
  await db.delete(notifications).where(eq(notifications.deferralId, id));
  await db
    .delete(workOrderDeferrals)
    .where(eq(workOrderDeferrals.deferralId, id));
  await db.delete(deferrals).where(eq(deferrals.id, id));

  return NextResponse.json({ ok: true }, { status: 200 });
}
