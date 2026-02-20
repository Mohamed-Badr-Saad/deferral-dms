import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { deferralApprovals, deferrals, users } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { afterApprovalAdvance, notifyUser } from "@/src/lib/approval-progress";
import { and, eq } from "drizzle-orm";

const BodySchema = z.object({
  comment: z.string().optional().default(""),
});

type Ctx = { params: Promise<{ id: string }> };

function canActOnApproval(profile: any, approval: any) {
  // Direct assignment
  if (approval.assignedUserId && approval.assignedUserId === profile.id)
    return true;

  // Broadcast role must match
  if (String(profile.role) !== String(approval.stepRole)) return false;

  // Scoped by dept
  if (approval.targetDepartment) {
    if (
      String(profile.department ?? "").trim() !==
      String(approval.targetDepartment ?? "").trim()
    ) {
      return false;
    }
  }

  // Scoped by gmGroup
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
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

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
  if (!approval)
    return NextResponse.json({ message: "Not found" }, { status: 404 });

  const dRows = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, approval.deferralId))
    .limit(1);

  const def = dRows[0] as any;
  if (!def) return NextResponse.json({ message: "Not found" }, { status: 404 });

  // ✅ must be current cycle (or resolve to current)
  const currentCycle = Number(def.approvalCycle ?? 0);

  let effectiveApproval = approval;

  if (Number(approval.cycle ?? 0) !== currentCycle) {
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
            "This approval is from an old cycle and no matching approval exists in the latest cycle.",
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
      { message: "Validation error", detail: "Approval is not active/pending, it is from the old cycle." },
      { status: 400 },
    );
  }

  if (!canActOnApproval(profile, effectiveApproval)) {
    return NextResponse.json({ message: "Permission denied" }, { status: 403 });
  }

  // snapshot signer info
  const u = await db
    .select({ name: users.name, signatureUrl: users.signatureUrl })
    .from(users)
    .where(eq(users.id, profile.id))
    .limit(1);

  const signerName = u[0]?.name ?? profile.name ?? "";
  const signatureUrl = (u[0] as any)?.signatureUrl ?? "";

  await db
    .update(deferralApprovals)
    .set({
      status: "APPROVED",
      comment: parsed.data.comment ?? "",
      signedByUserId: profile.id,
      signedByNameSnapshot: signerName,
      signatureUrlSnapshot: signatureUrl,
      signedAt: new Date(),
      updatedAt: new Date(),
      isActive: false, // optional safety: step finished
    } as any)
    .where(eq(deferralApprovals.id, effectiveApproval.id));

  await afterApprovalAdvance(def.id);

  await notifyUser(
    def.initiatorUserId,
    "Approval update",
    `${effectiveApproval.stepRole} approved your deferral.`,
    def.id,
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}