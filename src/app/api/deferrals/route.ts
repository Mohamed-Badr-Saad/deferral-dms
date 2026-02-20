// src/app/api/deferrals/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "@/src/db";
import { deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { and, desc, eq, inArray } from "drizzle-orm";
import { computeRamCell, computeRamConsequence } from "@/src/lib/constants";

const ACTIVE_STATUSES = ["DRAFT", "SUBMITTED", "IN_APPROVAL", "RETURNED"] as const;
const HISTORY_STATUSES = ["COMPLETED", "APPROVED", "REJECTED"] as const;

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

  // IMPORTANT: coerce to number (form input gives strings)
  severity: z.coerce.number().int().min(1).max(5).default(1),
  likelihood: z.string().optional().default("A"),
});

function makeDeferralCode() {
  // 6 chars base36, uppercase => ~2.1B combos
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
  // fallback if extremely unlucky
  return `WDDM-N-${Date.now().toString().slice(-6)}`;
}

export async function GET(req: Request) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") ?? "active").toLowerCase();

  const statuses =
    scope === "history"
      ? (HISTORY_STATUSES as unknown as string[])
      : (ACTIVE_STATUSES as unknown as string[]);

  const whereClause =
    profile.role === "ENGINEER_APPLICANT"
      ? and(
          inArray(deferrals.status, statuses),
          eq(deferrals.initiatorUserId, profile.id),
        )
      : inArray(deferrals.status, statuses);

  const rows = await db
    .select()
    .from(deferrals)
    .where(whereClause as any)
    .orderBy(desc(deferrals.updatedAt))
    .limit(500);

  return NextResponse.json({ items: rows }, { status: 200 });
}

export async function POST(req: Request) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  // allow admin to create draft too
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

  // ✅ retry a few times if code collision ever happens
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      // prefer a DB-checked code
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
      // if it's a unique constraint on deferral_code, retry
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
