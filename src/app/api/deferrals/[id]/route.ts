import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { eq } from "drizzle-orm";
import { computeRamCell, computeRamConsequence } from "@/src/lib/constants";
import { canViewDeferral } from "@/src/lib/authz/deferralAccess";

const zNullableDateString = z.preprocess((v) => {
  if (v === "" || v === undefined) return null;
  return v;
}, z.string().datetime().nullable());

const PatchSchema = z.object({
  initiatorDepartment: z.string().min(1).optional(),
  equipmentTag: z.string().optional(),
  equipmentDescription: z.string().optional(),
  safetyCriticality: z.string().optional(),
  taskCriticality: z.string().optional(),
  workOrderNo: z.string().optional(),
  workOrderTitle: z.string().optional(),
  // ✅ ADD THESE
  lafdStartDate: zNullableDateString.optional(),
  lafdEndDate: zNullableDateString.optional(),

  description: z.string().optional(),
  justification: z.string().optional(),
  consequence: z.string().optional(),
  mitigations: z.string().optional(),

  riskCategory: z.string().optional(),
  severity: z.coerce.number().int().min(1).max(5).optional(),
  likelihood: z.string().optional(),

  requiresTechnicalAuthority: z.boolean().optional(),
  requiresAdHoc: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id || id === "undefined") {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, id))
    .limit(1);

  const item = rows[0] ?? null;
  if (!item)
    return NextResponse.json({ message: "Not found" }, { status: 404 });

  return NextResponse.json({ item }, { status: 200 });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id || id === "undefined") {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation error", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const rows = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, id))
    .limit(1);

  const item = rows[0];
  if (!item)
    return NextResponse.json({ message: "Not found" }, { status: 404 });

  // Only initiator can edit draft
const access = await canViewDeferral(id, profile.id);
if (!access.ok) {
  return NextResponse.json(
    { message: access.reason === "not_found" ? "Not found" : "Permission denied" },
    { status: access.reason === "not_found" ? 404 : 403 },
  );
}
  if (!["DRAFT", "REVISION_REQUIRED"].includes(item.status)) {
    return NextResponse.json(
      { message: "Validation error", detail: "Only drafts can be edited" },
      { status: 400 },
    );
  }

  const next: any = {
    ...parsed.data,
    updatedAt: new Date(),
  };

  // ✅ Convert ISO -> Date for DB columns
  if ("lafdStartDate" in parsed.data) {
    next.lafdStartDate = parsed.data.lafdStartDate
      ? new Date(parsed.data.lafdStartDate)
      : null;
  }
  if ("lafdEndDate" in parsed.data) {
    next.lafdEndDate = parsed.data.lafdEndDate
      ? new Date(parsed.data.lafdEndDate)
      : null;
  }

  // If severity/likelihood changed, recompute RAM derived fields
  const nextSeverity = parsed.data.severity ?? item.severity ?? 1;
  const nextLikelihood = (
    parsed.data.likelihood ??
    item.likelihood ??
    "A"
  ).toUpperCase();

  if (
    parsed.data.severity !== undefined ||
    parsed.data.likelihood !== undefined
  ) {
    next.ramCell = computeRamCell(Number(nextSeverity), String(nextLikelihood));
    next.ramConsequenceLevel = computeRamConsequence(
      Number(nextSeverity),
      String(nextLikelihood),
    );
    next.severity = Number(nextSeverity);
    next.likelihood = String(nextLikelihood);
  }

  await db.update(deferrals).set(next).where(eq(deferrals.id, id));

  const out = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, id))
    .limit(1);

  return NextResponse.json({ item: out[0] }, { status: 200 });
}
