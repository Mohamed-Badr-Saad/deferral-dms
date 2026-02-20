// src/app/api/approvals/my/route.ts
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { deferralApprovals, deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { and, eq, or, isNull, desc, asc, inArray } from "drizzle-orm";

function normalizeDepartment(input: string) {
  return (input ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

const PARALLEL_ROLES = ["RESPONSIBLE_GM", "SOD", "DFGM"] as const;

export async function GET() {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const pendingRows = await db
    .select({
      approval: deferralApprovals,
      deferral: deferrals,
    })
    .from(deferralApprovals)
    .innerJoin(deferrals, eq(deferrals.id, deferralApprovals.deferralId))
    .where(
      and(
        eq(deferralApprovals.status, "PENDING"),
        eq(deferralApprovals.isActive, true),

        // ✅ must be CURRENT cycle only
        eq(deferrals.approvalCycle, deferralApprovals.cycle),

        eq(deferralApprovals.stepRole, profile.role),

        // ✅ Department scope (if present)
        or(
          isNull(deferralApprovals.targetDepartment),
          eq(deferralApprovals.targetDepartment, profile.department),
        ),

        // ✅ GM group scope (if present)
        or(
          isNull(deferralApprovals.targetGmGroup),
          eq(deferralApprovals.targetGmGroup, profile.gmGroup),
        ),
      ),
    )
    .orderBy(desc(deferrals.updatedAt), asc(deferralApprovals.stepOrder));

  const historyRows = await db
    .select({
      approval: deferralApprovals,
      deferral: deferrals,
    })
    .from(deferralApprovals)
    .innerJoin(deferrals, eq(deferrals.id, deferralApprovals.deferralId))
    .where(
      and(
        eq(deferralApprovals.status, "APPROVED"),
        eq(deferralApprovals.signedByUserId, profile.id),
      ),
    )
    .orderBy(desc(deferralApprovals.signedAt));

  const parallelCounts: Record<
    string,
    { total: number; approved: number; pending: number }
  > = {};

  // Only compute for deferrals that are currently shown as pending cards
  for (const row of pendingRows) {
    const defId = row.deferral.id;
    const cycle = Number((row.deferral as any).approvalCycle ?? 0);

    // Count only PARALLEL segment roles and only in CURRENT cycle
    const seg = await db
      .select({ status: deferralApprovals.status })
      .from(deferralApprovals)
      .where(
        and(
          eq(deferralApprovals.deferralId, defId),
          eq(deferralApprovals.cycle, cycle),
          inArray(deferralApprovals.stepRole, PARALLEL_ROLES as any),
        ),
      );

    if (seg.length > 0) {
      const total = seg.length;
      const approved = seg.filter((x: any) => x.status === "APPROVED").length;
      const pending = seg.filter((x: any) => x.status === "PENDING").length;
      parallelCounts[defId] = { total, approved, pending };
    }
  }

  return NextResponse.json(
    { ok: true, pending: pendingRows, history: historyRows, parallelCounts },
    { status: 200 },
  );
}
