import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { deferralApprovals, deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { and, eq, isNull } from "drizzle-orm";
import { afterApprovalAdvance, notifyUser } from "@/src/lib/approval-progress";

const ApproveSchema = z.object({
  comment: z.string().optional().default(""),
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
  const parsed = ApproveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation error", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Load approval
  const aRows = await db
    .select()
    .from(deferralApprovals)
    .where(eq(deferralApprovals.id, approvalId))
    .limit(1);

  const approval = aRows[0];
  if (!approval) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  // Must be pending + active
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

  const signatureSnapshot = profile.signatureUrl ?? "";
  const signedByNameSnapshot = profile.name ?? "";

  // ✅ Atomic update: only first approver wins
  const updated = await db
    .update(deferralApprovals)
    .set({
      status: "APPROVED",
      comment: parsed.data.comment,
      signedByUserId: profile.id,
      signatureUrlSnapshot: signatureSnapshot,
      signedByNameSnapshot,
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

  // notify initiator
  const dRows = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, approval.deferralId))
    .limit(1);

  const def = dRows[0];
  if (def) {
    await notifyUser(
      def.initiatorUserId,
      "Approval completed",
      `${profile.role} approved.`,
      def.id,
    );
  }

  await afterApprovalAdvance(approval.deferralId);

  return NextResponse.json(
    {
      ok: true,
      warning: signatureSnapshot
        ? null
        : "No signature uploaded. Your name will be used instead.",
    },
    { status: 200 },
  );
}
