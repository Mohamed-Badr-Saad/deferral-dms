import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { deferrals, workOrderDeferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { and, eq, gt, sql } from "drizzle-orm";

const MANAGEMENT_ROLES = [
  "RELIABILITY_ENGINEER",
  "RELIABILITY_GM",
  "RESPONSIBLE_GM",
  "SOD",
  "DFGM",
  "TECHNICAL_AUTHORITY",
  "AD_HOC",
  "PLANNING_ENGINEER",
  "PLANNING_SUPERVISOR_ENGINEER",
  "ADMIN",
];

export async function GET() {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const isManagement = MANAGEMENT_ROLES.includes(profile.role);
  const now = new Date();

  // ── Department-level status counts ─────────────────────
  const deptRows = await db
    .select({
      department: deferrals.initiatorDepartment,
      status: deferrals.status,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(deferrals)
    .where(
      !isManagement
        ? eq(deferrals.initiatorDepartment, profile.department)
        : undefined,
    )
    .groupBy(deferrals.initiatorDepartment, deferrals.status);

  // Group into { [department]: { [status]: number } }
  const deptMap: Record<string, Record<string, number>> = {};
  for (const row of deptRows) {
    if (!deptMap[row.department]) deptMap[row.department] = {};
    deptMap[row.department][row.status] =
      (deptMap[row.department][row.status] ?? 0) + row.count;
  }

  const departments = Object.entries(deptMap).map(([department, counts]) => ({
    department,
    counts,
  }));

  // ── Rank counters: total (all-time) ────────────────────
  const rankWhere = !isManagement
    ? eq(deferrals.initiatorDepartment, profile.department)
    : undefined;

  const rankTotalRows = await db
    .select({
      deferralNumber: workOrderDeferrals.deferralNumber,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(workOrderDeferrals)
    .innerJoin(deferrals, eq(deferrals.id, workOrderDeferrals.deferralId))
    .where(rankWhere as any)
    .groupBy(workOrderDeferrals.deferralNumber);

  // ── Rank counters: active (lafdEndDate > now) ──────────
  const rankActiveRows = await db
    .select({
      deferralNumber: workOrderDeferrals.deferralNumber,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(workOrderDeferrals)
    .innerJoin(deferrals, eq(deferrals.id, workOrderDeferrals.deferralId))
    .where(
      rankWhere
        ? and(rankWhere as any, gt(deferrals.lafdEndDate, now))
        : gt(deferrals.lafdEndDate, now),
    )
    .groupBy(workOrderDeferrals.deferralNumber);

  const rankCounters: Record<number, { total: number; active: number }> = {
    1: { total: 0, active: 0 },
    2: { total: 0, active: 0 },
    3: { total: 0, active: 0 },
  };

  for (const r of rankTotalRows) {
    const n = Number(r.deferralNumber);
    if (n >= 1 && n <= 3) rankCounters[n].total = r.count;
  }
  for (const r of rankActiveRows) {
    const n = Number(r.deferralNumber);
    if (n >= 1 && n <= 3) rankCounters[n].active = r.count;
  }

  return NextResponse.json({ departments, rankCounters, isManagement }, { status: 200 });
}
