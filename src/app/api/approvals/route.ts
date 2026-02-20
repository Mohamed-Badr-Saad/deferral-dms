import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { deferralApprovals, deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { and, eq, or, isNull, inArray } from "drizzle-orm";

const PARALLEL_ROLES = ["RESPONSIBLE_GM", "SOD", "DFGM"] as const;

export async function GET() {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const rows = await db
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
        // ✅ only current cycle approvals should ever show up
        eq(deferrals.approvalCycle, deferralApprovals.cycle),

        or(
          eq(deferralApprovals.assignedUserId, profile.id),
          and(
            isNull(deferralApprovals.assignedUserId),
            eq(deferralApprovals.stepRole, profile.role),
          ),
        ),
      ),
    );

  // ✅ compute parallel progress ONLY for current cycle for returned deferrals
  const deferralIds = Array.from(new Set(rows.map((r) => r.deferral.id)));
  let parallelCounts: Record<
    string,
    { total: number; approved: number; pending: number }
  > = {};

  if (deferralIds.length > 0) {
    const parallelRows = await db
      .select({
        deferralId: deferralApprovals.deferralId,
        status: deferralApprovals.status,
      })
      .from(deferralApprovals)
      .innerJoin(deferrals, eq(deferrals.id, deferralApprovals.deferralId))
      .where(
        and(
          inArray(deferralApprovals.deferralId, deferralIds as any),
          // ✅ current cycle only
          eq(deferralApprovals.cycle, deferrals.approvalCycle),
          inArray(deferralApprovals.stepRole as any, PARALLEL_ROLES as any),
        ),
      );

    parallelCounts = parallelRows.reduce(
      (acc, r: any) => {
        const id = String(r.deferralId);
        acc[id] ??= { total: 0, approved: 0, pending: 0 };
        acc[id].total++;
        if (r.status === "APPROVED") acc[id].approved++;
        if (r.status === "PENDING") acc[id].pending++;
        return acc;
      },
      {} as Record<
        string,
        { total: number; approved: number; pending: number }
      >,
    );
  }

  return NextResponse.json({ items: rows, parallelCounts }, { status: 200 });
}
