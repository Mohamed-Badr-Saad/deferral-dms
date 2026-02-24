// src/app/api/deferrals/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "@/src/db";
import { deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { computeRamCell, computeRamConsequence } from "@/src/lib/constants";

const ACTIVE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "IN_APPROVAL",
  "RETURNED",
] as const;
const HISTORY_STATUSES = ["COMPLETED", "APPROVED", "REJECTED"] as const;
const ALL_STATUSES = [...ACTIVE_STATUSES, ...HISTORY_STATUSES] as const;

const zNullableDateString = z.preprocess((v) => {
  if (v === "" || v === undefined) return null;
  return v;
}, z.string().datetime().nullable());

const CreateDeferralSchema = z.object({
  initiatorDepartment: z.string().min(1).optional(),
  workOrderNo: z.string().optional().default(""),
  workOrderTitle: z.string().optional().default(""),

  equipmentTag: z.string().optional().default(""),
  equipmentDescription: z.string().optional().default(""),
  safetyCriticality: z.string().optional().default(""),
  taskCriticality: z.string().optional().default(""),

  lafdStartDate: zNullableDateString.default(null),
  lafdEndDate: zNullableDateString.default(null),

  description: z.string().optional().default(""),
  justification: z.string().optional().default(""),
  consequence: z.string().optional().default(""),
  mitigations: z.string().optional().default(""),

  riskCategory: z.string().optional().default(""),

  severity: z.coerce.number().int().min(1).max(5).default(1),
  likelihood: z.string().optional().default("A"),
});

const GetQuerySchema = z.object({
  mode: z.enum(["items", "counts"]).optional().default("items"),
  scope: z.enum(["active", "history", "all"]).optional().default("active"),

  department: z.string().optional().default(""),
  status: z.enum(ALL_STATUSES).optional(),

  deferralCode: z.string().optional().default(""),
  workOrderNo: z.string().optional().default(""),
  equipmentTag: z.string().optional().default(""),

  updatedFrom: z.string().datetime().optional(),
  updatedTo: z.string().datetime().optional(),

  offset: z.coerce.number().int().min(0).optional().default(0),

  // no max cap, but still required for paging
  pageSize: z.coerce.number().int().min(1).optional().default(80),
});

function makeDeferralCode() {
  const s = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `WDDM-N-${s}`;
}

async function generateUniqueDeferralCode() {
  for (let i = 0; i < 10; i++) {
    const code = makeDeferralCode();
    const exists = await db
      .select({ id: deferrals.id })
      .from(deferrals)
      .where(eq(deferrals.deferralCode, code))
      .limit(1);

    if (!exists[0]) return code;
  }
  return `WDDM-N-${Date.now().toString().slice(-6)}`;
}

function scopeStatuses(scope: "active" | "history" | "all") {
  if (scope === "active") return ACTIVE_STATUSES as unknown as string[];
  if (scope === "history") return HISTORY_STATUSES as unknown as string[];
  return ALL_STATUSES as unknown as string[];
}

function buildWhereClause(args: {
  profile: any;
  scope: "active" | "history" | "all";

  department: string;
  status?: string;

  deferralCode: string;
  workOrderNo: string;
  equipmentTag: string;

  updatedFrom?: string;
  updatedTo?: string;
}) {
  const {
    profile,
    scope,
    department,
    status,
    deferralCode,
    workOrderNo,
    equipmentTag,
    updatedFrom,
    updatedTo,
  } = args;

  const clauses: any[] = [];

  // scope + optional single-status override
  if (status) {
    clauses.push(eq(deferrals.status, status as any));
  } else {
    clauses.push(inArray(deferrals.status, scopeStatuses(scope) as any));
  }

  // applicant sees only theirs
  if (profile.role === "ENGINEER_APPLICANT") {
    clauses.push(eq(deferrals.initiatorUserId, profile.id));
  }

  const dept = (department ?? "").trim();
  if (dept) clauses.push(eq(deferrals.initiatorDepartment, dept));

  const code = (deferralCode ?? "").trim();
  if (code) clauses.push(ilike(deferrals.deferralCode, `%${code}%`));

  const wo = (workOrderNo ?? "").trim();
  if (wo) clauses.push(ilike(deferrals.workOrderNo, `%${wo}%`));

  const tag = (equipmentTag ?? "").trim();
  if (tag) clauses.push(ilike(deferrals.equipmentTag, `%${tag}%`));

  if (updatedFrom)
    clauses.push(gte(deferrals.updatedAt, new Date(updatedFrom)));
  if (updatedTo) clauses.push(lte(deferrals.updatedAt, new Date(updatedTo)));

  return clauses.length ? and(...clauses) : undefined;
}


export async function GET(req: Request) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const url = new URL(req.url);

  const parsed = GetQuerySchema.safeParse({
    mode: (url.searchParams.get("mode") ?? "items").toLowerCase(),
    scope: (url.searchParams.get("scope") ?? "active").toLowerCase(),

    department: url.searchParams.get("department") ?? "",
    status: url.searchParams.get("status")?.toUpperCase() ?? undefined,

    deferralCode: url.searchParams.get("deferralCode") ?? "",
    workOrderNo: url.searchParams.get("workOrderNo") ?? "",
    equipmentTag: url.searchParams.get("equipmentTag") ?? "",

    updatedFrom: url.searchParams.get("updatedFrom") ?? undefined,
    updatedTo: url.searchParams.get("updatedTo") ?? undefined,

    offset: url.searchParams.get("offset") ?? undefined,

    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation error", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    mode,
    scope,
    department,
    status,
    deferralCode,
    workOrderNo,
    equipmentTag,
    updatedFrom,
    updatedTo,
    offset,
    pageSize,
  } = parsed.data;

  const baseWhere = buildWhereClause({
    profile,
    scope,
    department,
    status,
    deferralCode,
    workOrderNo,
    equipmentTag,
    updatedFrom,
    updatedTo,
  });

  if (mode === "counts") {
    // 1️⃣ Group by status (what you already have)
    const rows = await db
      .select({
        status: deferrals.status,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(deferrals)
      .where(baseWhere as any)
      .groupBy(deferrals.status);

    const byStatus: Record<string, number> = {};
    for (const s of ALL_STATUSES) byStatus[s] = 0;
    for (const r of rows) {
      byStatus[String(r.status)] = Number(r.count ?? 0);
    }

    // 2️⃣ NEW: total matched (full filtered count)
    const totalRow = await db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(deferrals)
      .where(baseWhere as any);

    const totalMatched = Number(totalRow?.[0]?.count ?? 0);

    return NextResponse.json(
      {
        byStatus,
        totals: {
          active: ACTIVE_STATUSES.reduce(
            (sum, s) => sum + (byStatus[s] ?? 0),
            0,
          ),
          history: HISTORY_STATUSES.reduce(
            (sum, s) => sum + (byStatus[s] ?? 0),
            0,
          ),
          all:
            ACTIVE_STATUSES.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0) +
            HISTORY_STATUSES.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0),
        },

        totalMatched, // ✅ THIS is what your frontend needs
      },
      { status: 200 },
    );
  }

  const rows = await db
  .select()
  .from(deferrals)
  .where(baseWhere as any)
  .orderBy(desc(deferrals.updatedAt), desc(deferrals.id))
  .limit(pageSize)
  .offset(offset);

const nextOffset = rows.length === pageSize ? offset + pageSize : null;

return NextResponse.json(
  {
    items: rows,
    nextOffset,
  },
  { status: 200 },
);
}

export async function POST(req: Request) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  if (profile.role !== "ENGINEER_APPLICANT" && profile.role !== "ADMIN") {
    return NextResponse.json({ message: "Permission denied" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CreateDeferralSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Validation error",
        issues: parsed.error.flatten(),
        received: body,
      },
      { status: 400 },
    );
  }

  const initiatorDepartment = (
    parsed.data.initiatorDepartment ??
    profile.department ??
    ""
  ).trim();

  if (!initiatorDepartment) {
    return NextResponse.json(
      {
        message: "Validation error",
        detail:
          "initiatorDepartment is required (or profile.department must exist).",
      },
      { status: 400 },
    );
  }

  const likelihood = String(parsed.data.likelihood ?? "A").toUpperCase();
  const severity = Number(parsed.data.severity ?? 1);

  const id = randomUUID();

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const code =
        attempt === 0 ? await generateUniqueDeferralCode() : makeDeferralCode();

      await db.insert(deferrals).values({
        id,
        deferralCode: code,
        initiatorUserId: profile.id,
        initiatorDepartment,
        workOrderNo: parsed.data.workOrderNo,
        workOrderTitle: parsed.data.workOrderTitle,

        equipmentTag: parsed.data.equipmentTag,
        equipmentDescription: parsed.data.equipmentDescription,
        safetyCriticality: parsed.data.safetyCriticality,
        taskCriticality: parsed.data.taskCriticality,

        lafdStartDate: parsed.data.lafdStartDate
          ? new Date(parsed.data.lafdStartDate)
          : null,
        lafdEndDate: parsed.data.lafdEndDate
          ? new Date(parsed.data.lafdEndDate)
          : null,

        description: parsed.data.description,
        justification: parsed.data.justification,
        consequence: parsed.data.consequence,
        mitigations: parsed.data.mitigations,

        riskCategory: parsed.data.riskCategory,
        severity,
        likelihood,

        ramCell: computeRamCell(severity, likelihood),
        ramConsequenceLevel: computeRamConsequence(severity, likelihood),

        requiresTechnicalAuthority: false,
        requiresAdHoc: false,

        status: "DRAFT",
        updatedAt: new Date(),
      } as any);

      const out = await db
        .select()
        .from(deferrals)
        .where(eq(deferrals.id, id))
        .limit(1);

      return NextResponse.json({ item: out[0] }, { status: 201 });
    } catch (e: any) {
      const msg = String(e?.message ?? "").toLowerCase();
      if (msg.includes("deferral_code") || msg.includes("unique")) continue;
      throw e;
    }
  }

  return NextResponse.json(
    {
      message: "Server error",
      detail: "Failed to generate unique deferral code",
    },
    { status: 500 },
  );
}
