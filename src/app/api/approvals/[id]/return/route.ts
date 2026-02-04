import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { deferralApprovals, deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { and, eq, isNull } from "drizzle-orm";
import { activateFirstStep, notifyUser } from "@/src/lib/approval-progress";

const ReturnSchema = z.object({
  comment: z.string().min(2, "Comment is required"),
  route: z
    .enum(["TO_INITIATOR", "TO_RELIABILITY_ENGINEER"])
    .optional()
    .default("TO_RELIABILITY_ENGINEER"),
});

type Ctx = { params: Promise<{ id: string }> };

function canActOnApproval(profile: any, approval: any) {
  if (!profile || !approval) return false;
  if (approval.stepRole !== profile.role) return false;

  // Broadcast scope checks:
  if (
    approval.targetDepartment &&
    approval.targetDepartment !== profile.department
  ) {
    return false;
  }
  if (approval.targetGmGroup && approval.targetGmGroup !== profile.gmGroup) {
    return false;
  }

  return true;
}

export async function POST(req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const { id: approvalId } = await ctx.params;

  const body = await req.json();
  const parsed = ReturnSchema.safeParse(body);
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

  const approval = aRows[0];
  if (!approval) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  // State validation
  if (approval.status !== "PENDING") {
    return NextResponse.json(
      { message: "Validation error", detail: "Not pending" },
      { status: 400 },
    );
  }
  if (!approval.isActive) {
    return NextResponse.json(
      { message: "Validation error", detail: "This step is not active" },
      { status: 400 },
    );
  }

  // ✅ Broadcast authz: role + scope
  if (!canActOnApproval(profile, approval)) {
    return NextResponse.json({ message: "Permission denied" }, { status: 403 });
  }

  const canReturnToInitiator =
    profile.role === "RELIABILITY_ENGINEER" ||
    profile.role === "RELIABILITY_GM";

  if (parsed.data.route === "TO_INITIATOR" && !canReturnToInitiator) {
    return NextResponse.json({ message: "Permission denied" }, { status: 403 });
  }

  // ✅ Atomic update: only first reject wins
  const updated = await db
    .update(deferralApprovals)
    .set({
      status: "REJECTED",
      comment: parsed.data.comment,
      signedByUserId: profile.id,
      signedAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .where(
      and(
        eq(deferralApprovals.id, approvalId),
        eq(deferralApprovals.status, "PENDING"),
        eq(deferralApprovals.isActive, true),
        isNull(deferralApprovals.signedByUserId),
      ),
    )
    .returning({ id: deferralApprovals.id });

  if (updated.length === 0) {
    return NextResponse.json(
      { message: "Already handled by another user" },
      { status: 409 },
    );
  }

  const dRows = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, approval.deferralId))
    .limit(1);

  const def = dRows[0];
  if (!def) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Deferral is ALWAYS rejected (your rule)
  await db
    .update(deferrals)
    .set({ status: "REJECTED", updatedAt: new Date() } as any)
    .where(eq(deferrals.id, def.id));

  // Notify initiator always
  await notifyUser(
    def.initiatorUserId,
    "Deferral rejected",
    parsed.data.comment,
    def.id,
  );

  // If returned to initiator only, stop here
  if (parsed.data.route === "TO_INITIATOR") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Return to Reliability Engineer:
  // deactivate all approvals, reactivate RE step (or fallback activate first step)
  await db
    .update(deferralApprovals)
    .set({ isActive: false, updatedAt: new Date() } as any)
    .where(eq(deferralApprovals.deferralId, def.id));

  const reStep = await db
    .select()
    .from(deferralApprovals)
    .where(
      and(
        eq(deferralApprovals.deferralId, def.id),
        eq(deferralApprovals.stepRole, "RELIABILITY_ENGINEER"),
      ),
    )
    .limit(1);

  if (reStep[0]) {
    await db
      .update(deferralApprovals)
      .set({ isActive: true, updatedAt: new Date() } as any)
      .where(eq(deferralApprovals.id, reStep[0].id));
  } else {
    await activateFirstStep(def.id);
  }

  await notifyUser(
    def.initiatorUserId,
    "Returned to Reliability Engineer",
    `${profile.role}: ${parsed.data.comment}`,
    def.id,
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}
