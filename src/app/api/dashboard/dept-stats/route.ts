import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { and, eq, gt, sql, inArray } from "drizzle-orm";
import { workOrderDeferrals } from "@/src/db/schema"; // adjust import path

const ALL_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "INAPPROVAL",
  "RETURNED",
  "REJECTED",
  "APPROVED",
  "COMPLETED",
  "CLOSED",
  "DELETED",
  "EXPIRED",
] as const;

// Roles that see ALL departments (higher management)
const MANAGEMENT_ROLES = [
  "RELIABILITYENGINEER",
  "RELIABILITYGM",
  "RESPONSIBLEGM",
  "SOD",
  "DFGM",
  "TECHNICALAUTHORITY",
  "ADHOC",
  "PLANNINGENGINEER",
  "PLANNINGSUPERVISORENGINEER",
  "ADMIN",
];

export async function GET() {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const isManagement = MANAGEMENT_ROLES.includes(profile.role);
  const now = new Date();

  // ── 1. Department-level status counts ─────────────────────────
  const deptWhere = !isManagement
    ? eq(deferrals.initiatorDepartment, profile.department)
    : undefined;

  const deptRows = await db
    .select({
      department: deferrals.initiatorDepartment,
      status: deferrals.status,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(deferrals)
    .where(deptWhere as any)
    .groupBy(deferrals.initiatorDepartment, deferrals.status);

  // Group into { [department]: { [status]: number } }
  const deptMap: Record<string, Record<string, number>> = {};
  for (const row of deptRows) {
    if (!deptMap[row.department]) {
      deptMap[row.department] = {};
      for (const s of ALL_STATUSES) deptMap[row.department][s] = 0;
    }
    deptMap[row.department][row.status] = row.count;
  }

  const departments = Object.entries(deptMap).map(([department, counts]) => ({
    department,
    counts,
  }));

  // ── 2. Deferral rank counters (1st / 2nd / 3rd) ───────────────
  // Total count per rank
  const rankTotalRows = await db
    .select({
      deferralNumber: workOrderDeferrals.deferralNumber,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(workOrderDeferrals)
    .innerJoin(deferrals, eq(deferrals.id, workOrderDeferrals.deferralId))
    .where(deptWhere ? and(deptWhere as any) : undefined)
    .groupBy(workOrderDeferrals.deferralNumber);

  // Active count per rank: lafdEndDate > now (LAFD hasn't elapsed)
  const rankActiveRows = await db
    .select({
      deferralNumber: workOrderDeferrals.deferralNumber,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(workOrderDeferrals)
    .innerJoin(deferrals, eq(deferrals.id, workOrderDeferrals.deferralId))
    .where(
      deptWhere
        ? and(deptWhere as any, gt(deferrals.lafdEndDate, now))
        : gt(deferrals.lafdEndDate, now),
    )
    .groupBy(workOrderDeferrals.deferralNumber);

  const rankCounters: Record<number, { total: number; active: number }> = {
    1: { total: 0, active: 0 },
    2: { total: 0, active: 0 },
    3: { total: 0, active: 0 },
  };

  for (const row of rankTotalRows) {
    const n = Number(row.deferralNumber);
    if (n >= 1 && n <= 3) rankCounters[n].total = row.count;
  }
  for (const row of rankActiveRows) {
    const n = Number(row.deferralNumber);
    if (n >= 1 && n <= 3) rankCounters[n].active = row.count;
  }

  return NextResponse.json(
    { departments, rankCounters, isManagement },
    { status: 200 },
  );
}
