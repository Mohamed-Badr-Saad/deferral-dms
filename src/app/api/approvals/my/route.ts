// src/app/api/approvals/my/route.ts
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { deferralApprovals, deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { and, eq, or, isNull, desc, asc, inArray } from "drizzle-orm";

const PARALLEL_ROLES = ["RESPONSIBLE_GM", "SOD", "DFGM"] as const;

export async function GET() {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const gmGroupScope = profile.gmGroup
    ? or(
        isNull(deferralApprovals.targetGmGroup),
        eq(deferralApprovals.targetGmGroup, profile.gmGroup),
      )
    : isNull(deferralApprovals.targetGmGroup);

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
        gmGroupScope,
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

  const pendingDeferralIds = Array.from(
    new Set(pendingRows.map((row) => row.deferral.id)),
  );

  if (pendingDeferralIds.length > 0) {
    const parallelRows = await db
      .select({
        deferralId: deferralApprovals.deferralId,
        status: deferralApprovals.status,
      })
      .from(deferralApprovals)
      .innerJoin(deferrals, eq(deferrals.id, deferralApprovals.deferralId))
      .where(
        and(
          inArray(deferralApprovals.deferralId, pendingDeferralIds),
          eq(deferralApprovals.cycle, deferrals.approvalCycle),
          inArray(deferralApprovals.stepRole, [...PARALLEL_ROLES]),
        ),
      );

    for (const row of parallelRows) {
      const defId = String(row.deferralId);
      parallelCounts[defId] ??= { total: 0, approved: 0, pending: 0 };
      parallelCounts[defId].total++;
      if (row.status === "APPROVED") parallelCounts[defId].approved++;
      if (row.status === "PENDING") parallelCounts[defId].pending++;
    }
  }

  return NextResponse.json(
    { ok: true, pending: pendingRows, history: historyRows, parallelCounts },
    { status: 200 },
  );
}
