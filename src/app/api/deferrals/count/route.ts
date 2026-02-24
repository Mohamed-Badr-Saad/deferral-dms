// src/app/api/deferrals/count/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { and, eq, inArray, ilike, gte, lte, or, sql } from "drizzle-orm";

const ACTIVE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "IN_APPROVAL",
  "RETURNED",
  
] as const;
const HISTORY_STATUSES = ["COMPLETED", "APPROVED", "REJECTED"] as const;
const ALL_STATUSES = [...ACTIVE_STATUSES, ...HISTORY_STATUSES] as const;

const QuerySchema = z.object({
  scope: z.enum(["active", "history", "all"]).optional().default("active"),
  q: z.string().optional().default(""),
  department: z.string().optional().default(""),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    scope: (url.searchParams.get("scope") ?? "active").toLowerCase(),
    q: url.searchParams.get("q") ?? "",
    department: url.searchParams.get("department") ?? "",
    createdFrom: url.searchParams.get("createdFrom") ?? undefined,
    createdTo: url.searchParams.get("createdTo") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation error", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { scope, q, department, createdFrom, createdTo } = parsed.data;

  const statuses =
    scope === "history"
      ? (HISTORY_STATUSES as unknown as string[])
      : scope === "all"
        ? (ALL_STATUSES as unknown as string[])
        : (ACTIVE_STATUSES as unknown as string[]);

  const clauses: any[] = [];
  clauses.push(inArray(deferrals.status, statuses));

  if (profile.role === "ENGINEER_APPLICANT") {
    clauses.push(eq(deferrals.initiatorUserId, profile.id));
  }

  if (department.trim())
    clauses.push(eq(deferrals.initiatorDepartment, department.trim()));
  if (createdFrom)
    clauses.push(gte(deferrals.createdAt, new Date(createdFrom)));
  if (createdTo) clauses.push(lte(deferrals.createdAt, new Date(createdTo)));

  const needle = q.trim();
  if (needle) {
    const like = `%${needle}%`;
    clauses.push(
      or(
        ilike(deferrals.deferralCode, like),
        ilike(deferrals.initiatorDepartment, like),
        ilike(deferrals.equipmentTag, like),
      ),
    );
  }

  const whereClause = clauses.length ? and(...clauses) : undefined;

  // group-by status
  const rows = await db
    .select({
      status: deferrals.status,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(deferrals)
    .where(whereClause as any)
    .groupBy(deferrals.status);

  const byStatus: Record<string, number> = {};
  for (const s of ALL_STATUSES) byStatus[s] = 0;
  for (const r of rows) byStatus[String(r.status)] = Number(r.count ?? 0);

  const activeTotal = ACTIVE_STATUSES.reduce(
    (sum, s) => sum + (byStatus[s] ?? 0),
    0,
  );
  const historyTotal = HISTORY_STATUSES.reduce(
    (sum, s) => sum + (byStatus[s] ?? 0),
    0,
  );
  const allTotal = activeTotal + historyTotal;

  return NextResponse.json(
    { byStatus, activeTotal, historyTotal, allTotal },
    { status: 200 },
  );
}
