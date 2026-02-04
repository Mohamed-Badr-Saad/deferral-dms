import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { deferralApprovals, deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { and, eq, or, isNull, desc, asc } from "drizzle-orm";

function normalizeDepartment(input: string) {
  return (input ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export async function GET() {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const myDeptNorm = normalizeDepartment(profile.department ?? "");

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
        eq(deferralApprovals.stepRole, profile.role),

        // ✅ Department scope (if present)
        or(
          isNull(deferralApprovals.targetDepartment),
          eq(deferralApprovals.targetDepartment, profile.department),
        ),

        // ✅ GM group scope (if present)
        // If user's gmGroup is null and a target exists, this will NOT match (correct behavior).
        or(
          isNull(deferralApprovals.targetGmGroup),
          eq(deferralApprovals.targetGmGroup, profile.gmGroup),
        ),
      ),
    )
    .orderBy(desc(deferrals.updatedAt), asc(deferralApprovals.stepOrder));

  // ✅ History = signed by me (kept as-is)
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

  for (const row of pendingRows) {
    const defId = row.deferral.id;

    const sameDef = await db
      .select({
        status: deferralApprovals.status,
      })
      .from(deferralApprovals)
      .where(eq(deferralApprovals.deferralId, defId));

    const total = sameDef.length;
    const approved = sameDef.filter((x) => x.status === "APPROVED").length;
    const pending = sameDef.filter((x) => x.status === "PENDING").length;

    parallelCounts[defId] = { total, approved, pending };
  }

  return NextResponse.json(
    { ok: true, pending: pendingRows, history: historyRows, parallelCounts },
    { status: 200 },
  );
}
