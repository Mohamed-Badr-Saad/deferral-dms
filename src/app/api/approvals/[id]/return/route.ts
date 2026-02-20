import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { deferralApprovals, deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { and, eq } from "drizzle-orm";
import { notifyUser } from "@/src/lib/approval-progress";

const BodySchema = z.object({
  comment: z.string().min(3, "Comment is required"),
});

type Ctx = { params: Promise<{ id: string }> };

function canActOnApproval(profile: any, approval: any) {
  if (approval.assignedUserId && approval.assignedUserId === profile.id)
    return true;

  if (String(profile.role) !== String(approval.stepRole)) return false;

  if (approval.targetDepartment) {
    if (
      String(profile.department ?? "").trim() !==
      String(approval.targetDepartment ?? "").trim()
    ) {
      return false;
    }
  }

  if (approval.targetGmGroup) {
    if (
      String((profile as any).gmGroup ?? "") !==
      String(approval.targetGmGroup ?? "")
    ) {
      return false;
    }
  }

  return true;
}

export async function POST(req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const { id: approvalId } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation error", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const aRows = await db
    .select()
    .from(deferralApprovals)
    .where(eq(deferralApprovals.id, approvalId))
    .limit(1);

  const approval = aRows[0] as any;
  if (!approval) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const dRows = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, approval.deferralId))
    .limit(1);

  const def = dRows[0] as any;
  if (!def) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  // ✅ must be current cycle (or resolve to current)
  const currentCycle = Number(def.approvalCycle ?? 0);

  let effectiveApproval = approval;

  if (Number(approval.cycle ?? 0) !== currentCycle) {
    // find matching approval in latest cycle
    const latest = await db
      .select()
      .from(deferralApprovals)
      .where(
        and(
          eq(deferralApprovals.deferralId, def.id),
          eq(deferralApprovals.cycle, currentCycle),
          eq(deferralApprovals.stepRole, approval.stepRole),
          eq(deferralApprovals.stepOrder, approval.stepOrder),
        ),
      )
      .limit(1);

    if (!latest[0]) {
      return NextResponse.json(
        {
          message: "Validation error",
          detail:
            "This approval belongs to an old cycle and no matching approval exists in the latest cycle.",
        },
        { status: 400 },
      );
    }

    effectiveApproval = latest[0] as any;
  }

  if (def.status !== "IN_APPROVAL") {
    return NextResponse.json(
      { message: "Validation error", detail: "Deferral is not in approval." },
      { status: 400 },
    );
  }

  if (!effectiveApproval.isActive || effectiveApproval.status !== "PENDING") {
    return NextResponse.json(
      {
        message: "Validation error",
        detail: "Approval is not active/pending, it is from the old cycle.",
      },
      { status: 400 },
    );
  }

  if (!canActOnApproval(profile, effectiveApproval)) {
    return NextResponse.json({ message: "Permission denied" }, { status: 403 });
  }

  // ✅ Transaction: mark current approval rejected + deactivate cycle + return deferral
  await db.transaction(async (tx) => {
    // IMPORTANT FIX: use effectiveApproval.id not approvalId
    await tx
      .update(deferralApprovals)
      .set({
        status: "REJECTED",
        comment: parsed.data.comment,
        isActive: false,
        updatedAt: new Date(),
        signedAt: new Date(), // optional: keep for audit
        signedByUserId: profile.id,
        signedByNameSnapshot: profile.name ?? "",
      } as any)
      .where(eq(deferralApprovals.id, effectiveApproval.id));

    // deactivate all approvals in this cycle
    await tx
      .update(deferralApprovals)
      .set({ isActive: false, updatedAt: new Date() } as any)
      .where(
        and(
          eq(deferralApprovals.deferralId, def.id),
          eq(deferralApprovals.cycle, currentCycle),
        ),
      );

    // return deferral to initiator
    await tx
      .update(deferrals)
      .set({
        status: "RETURNED",
        returnedAt: new Date(),
        returnedByRole: String(effectiveApproval.stepRole ?? ""),
        returnedComment: parsed.data.comment,
        updatedAt: new Date(),
      } as any)
      .where(eq(deferrals.id, def.id));
  });

  // ✅ notify initiator
  await notifyUser(
    def.initiatorUserId,
    "Deferral returned for revision",
    `${effectiveApproval.stepRole} returned your deferral. Comment: ${parsed.data.comment}`,
    def.id,
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}
