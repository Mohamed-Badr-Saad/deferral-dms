import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { deferrals, workOrderDeferrals } from "@/src/db/schema";
import { getBusinessProfile, type BusinessProfile } from "@/src/lib/authz";
import { and, desc, eq, gte, ilike, inArray, lte } from "drizzle-orm";
import { STATUS_LABELS } from "@/src/lib/constants";

const QuerySchema = z.object({
  scope: z.enum(["active", "history", "all"]).optional().default("all"),
  department: z.string().optional().default(""),
  status: z.string().optional(),
  deferralCode: z.string().optional().default(""),
  workOrderNo: z.string().optional().default(""),
  equipmentTag: z.string().optional().default(""),
  updatedFrom: z.string().datetime().optional(),
  updatedTo: z.string().datetime().optional(),
  deferralRank: z.coerce.number().int().min(1).max(3).optional(),
});

const ACTIVE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "IN_APPROVAL",
  "APPROVED",
  "RETURNED",
] as const;
const HISTORY_STATUSES = [
  "COMPLETED",
  "REJECTED",
  "CLOSED",
  "DELETED",
  "EXPIRED",
] as const;

function scopeStatuses(scope: string) {
  if (scope === "active") return ACTIVE_STATUSES;
  if (scope === "history") return HISTORY_STATUSES;
  return [...ACTIVE_STATUSES, ...HISTORY_STATUSES];
}

function effectiveDepartmentFilter(
  profile: BusinessProfile,
  requestedDepartment: string,
) {
  if (profile.role === "ENGINEER_APPLICANT") {
    return String(profile.department ?? "").trim();
  }

  return String(requestedDepartment ?? "").trim();
}

function csvEscape(value: unknown) {
  const s = value == null ? "" : String(value);
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

function fmtDateTime(d: unknown) {
  if (!d) return "";
  return new Date(String(d)).toLocaleString();
}

function fmtDate(d: unknown) {
  if (!d) return "";
  return new Date(String(d)).toLocaleDateString();
}

export async function GET(req: Request) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    scope: url.searchParams.get("scope") ?? "all",
    department: url.searchParams.get("department") ?? "",
    status: url.searchParams.get("status")?.toUpperCase() ?? undefined,
    deferralCode: url.searchParams.get("deferralCode") ?? "",
    workOrderNo: url.searchParams.get("workOrderNo") ?? "",
    equipmentTag: url.searchParams.get("equipmentTag") ?? "",
    updatedFrom: url.searchParams.get("updatedFrom") ?? undefined,
    updatedTo: url.searchParams.get("updatedTo") ?? undefined,
    deferralRank: url.searchParams.get("deferralRank") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation error", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const f = parsed.data;
  const clauses: any[] = [];

  if (f.status) clauses.push(eq(deferrals.status, f.status as any));
  else clauses.push(inArray(deferrals.status, scopeStatuses(f.scope) as any));

  const effectiveDepartment = effectiveDepartmentFilter(profile, f.department);

  if (effectiveDepartment) {
    clauses.push(eq(deferrals.initiatorDepartment, effectiveDepartment));
  }
  if (f.deferralCode.trim()) {
    clauses.push(ilike(deferrals.deferralCode, `%${f.deferralCode.trim()}%`));
  }
  if (f.workOrderNo.trim()) {
    clauses.push(ilike(deferrals.workOrderNo, `%${f.workOrderNo.trim()}%`));
  }
  if (f.equipmentTag.trim()) {
    clauses.push(ilike(deferrals.equipmentTag, `%${f.equipmentTag.trim()}%`));
  }
  if (f.updatedFrom) {
    clauses.push(gte(deferrals.updatedAt, new Date(f.updatedFrom)));
  }
  if (f.updatedTo) {
    clauses.push(lte(deferrals.updatedAt, new Date(f.updatedTo)));
  }
  if (f.deferralRank) {
    clauses.push(eq(workOrderDeferrals.deferralNumber, f.deferralRank));
  }

  const whereClause = clauses.length ? and(...clauses) : undefined;

  const rows = await db
    .select({
      deferralCode: deferrals.deferralCode,
      status: deferrals.status,
      initiatorDepartment: deferrals.initiatorDepartment,
      workOrderNo: deferrals.workOrderNo,
      workOrderTitle: deferrals.workOrderTitle,
      equipmentTag: deferrals.equipmentTag,
      equipmentDescription: deferrals.equipmentDescription,
      taskCriticality: deferrals.taskCriticality,
      safetyCriticality: deferrals.safetyCriticality,
      originalLafd: deferrals.originalLafd,
      currentLafd: deferrals.lafdStartDate,
      newLafd: deferrals.lafdEndDate,
      description: deferrals.description,
      justification: deferrals.justification,
      consequence: deferrals.consequence,
      mitigations: deferrals.mitigations,
      createdAt: deferrals.createdAt,
      updatedAt: deferrals.updatedAt,
      deferralNumber: workOrderDeferrals.deferralNumber,
    })
    .from(deferrals)
    .leftJoin(
      workOrderDeferrals,
      eq(workOrderDeferrals.deferralId, deferrals.id),
    )
    .where(whereClause as any)
    .orderBy(desc(deferrals.updatedAt));

  const csvRows = rows.map((r) => ({
    "Deferral Code": r.deferralCode ?? "",
    Status: (STATUS_LABELS as any)[r.status] ?? r.status ?? "",
    Department: r.initiatorDepartment ?? "",
    "Deferral Rank": r.deferralNumber ?? "",
    "Work Order No": r.workOrderNo ?? "",
    "Work Order Title": r.workOrderTitle ?? "",
    "Equipment Full Code": r.equipmentTag ?? "",
    "Equipment Description": r.equipmentDescription ?? "",
    "Task Criticality": r.taskCriticality ?? "",
    "Safety Criticality": r.safetyCriticality ?? "",
    "Original LAFD": fmtDate(r.originalLafd),
    "Current LAFD": fmtDate(r.currentLafd),
    "New LAFD": fmtDate(r.newLafd),
    Description: r.description ?? "",
    Justification: r.justification ?? "",
    Consequence: r.consequence ?? "",
    Mitigations: r.mitigations ?? "",
    "Created At": fmtDateTime(r.createdAt),
    "Updated At": fmtDateTime(r.updatedAt),
  }));

  const csv = toCsv(csvRows);
  const fileName = `deferrals-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
