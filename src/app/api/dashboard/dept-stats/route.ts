import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { deferrals, workOrderDeferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { DEPARTMENTS, DEFERRAL_STATUS } from "@/src/lib/constants";
import { and, desc, eq, gt, ilike, sql } from "drizzle-orm";

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

function normalizeDepartment(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const CANONICAL_DEPARTMENT_BY_NORMALIZED = new Map(
  DEPARTMENTS.map((department) => [normalizeDepartment(department), department]),
);

function canonicalDepartmentName(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return CANONICAL_DEPARTMENT_BY_NORMALIZED.get(normalizeDepartment(trimmed)) ?? trimmed;
}

export async function GET() {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const isManagement = MANAGEMENT_ROLES.includes(profile.role);
  const now = new Date();
  const scopeDepartment = !isManagement
    ? canonicalDepartmentName(profile.department)
    : null;
  const visibleDepartments = isManagement
    ? [...DEPARTMENTS]
    : scopeDepartment
      ? [scopeDepartment]
      : [];
  const statusKeys = [...DEFERRAL_STATUS];
  const emptyStatusCounts = () =>
    Object.fromEntries(statusKeys.map((status) => [status, 0]));
  const departmentScopeWhere = scopeDepartment
    ? ilike(deferrals.initiatorDepartment, scopeDepartment)
    : undefined;

  // ── Department-level status counts ─────────────────────
  const deptRows = await db
    .select({
      department: deferrals.initiatorDepartment,
      status: deferrals.status,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(deferrals)
    .where(departmentScopeWhere as any)
    .groupBy(deferrals.initiatorDepartment, deferrals.status);

  // Group into { [department]: { [status]: number } }
  const deptMap: Record<string, Record<string, number>> = {};
  for (const department of visibleDepartments) {
    deptMap[department] = emptyStatusCounts();
  }

  for (const row of deptRows) {
    const departmentName = canonicalDepartmentName(row.department);
    if (!departmentName) continue;

    if (!deptMap[departmentName]) {
      deptMap[departmentName] = emptyStatusCounts();
    }
    deptMap[departmentName][row.status] =
      (deptMap[departmentName][row.status] ?? 0) + row.count;
  }

  const extraDepartments = Object.keys(deptMap).filter(
    (department) => !visibleDepartments.includes(department as any),
  );
  const orderedDepartments = [...visibleDepartments, ...extraDepartments];
  const departments = orderedDepartments.map((department) => ({
    department,
    counts: deptMap[department] ?? emptyStatusCounts(),
  }));

  // ── Rank counters: total (all-time) ────────────────────
  const rankWhere = departmentScopeWhere;

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

  const recent = await db
    .select({
      id: deferrals.id,
      deferralCode: deferrals.deferralCode,
      initiatorDepartment: deferrals.initiatorDepartment,
      status: deferrals.status,
      createdAt: deferrals.createdAt,
      updatedAt: deferrals.updatedAt,
      equipmentTag: deferrals.equipmentTag,
      deferralNumber: workOrderDeferrals.deferralNumber,
    })
    .from(deferrals)
    .leftJoin(
      workOrderDeferrals,
      eq(workOrderDeferrals.deferralId, deferrals.id),
    )
    .where(departmentScopeWhere as any)
    .orderBy(desc(deferrals.updatedAt), desc(deferrals.id))
    .limit(10);

  const normalizedRecent = recent.map((item) => ({
    ...item,
    initiatorDepartment: canonicalDepartmentName(item.initiatorDepartment),
  }));

  return NextResponse.json(
    {
      departments,
      rankCounters,
      isManagement,
      scopeDepartment,
      recent: normalizedRecent,
    },
    { status: 200 },
  );
}
