import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

import { db } from "@/src/db";
import { deferrals, deferralRisks } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { computeRamCell, computeRamConsequence } from "@/src/lib/constants";
import { canViewDeferral } from "@/src/lib/authz/deferralAccess";

type Ctx = { params: Promise<{ id: string }> };

const CategoryEnum = z.enum(["PEOPLE", "ASSET", "ENVIRONMENT", "REPUTATION"]);

const RiskItemSchema = z.object({
  category: CategoryEnum,
  severity: z.coerce.number().int().min(1).max(5),
  likelihood: z.string().min(1),
  justification: z.string().optional().default(""),
});

const UpsertSchema = z.object({
  items: z.array(RiskItemSchema).min(1),
});

function normalizeLikelihood(input: string) {
  return String(input ?? "A")
    .trim()
    .toUpperCase();
}

export async function GET(_req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const { id: deferralId } = await ctx.params;

  const d = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, deferralId))
    .limit(1);
  const def = d[0];
  if (!def) return NextResponse.json({ message: "Not found" }, { status: 404 });



  const items = await db
    .select()
    .from(deferralRisks)
    .where(eq(deferralRisks.deferralId, deferralId));

  return NextResponse.json({ items }, { status: 200 });
}

export async function PUT(req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const { id: deferralId } = await ctx.params;

  const d = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, deferralId))
    .limit(1);
  const def = d[0];
  if (!def) return NextResponse.json({ message: "Not found" }, { status: 404 });

  // ✅ only initiator edits, only draft
 const access = await canViewDeferral(deferralId, profile.id);
if (!access.ok) {
  return NextResponse.json(
    { message: access.reason === "not_found" ? "Not found" : "Permission denied" },
    { status: access.reason === "not_found" ? 404 : 403 },
  );
}

  if (!(def.status === "DRAFT" || def.status === "RETURNED")) {
    return NextResponse.json(
      { message: "Validation error", detail: "Only drafts can be edited" },
      { status: 400 },
    );
  }

  const body = await req.json();
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation error", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await db.transaction(async (tx) => {
    for (const it of parsed.data.items) {
      const severity = Number(it.severity);
      const likelihood = normalizeLikelihood(it.likelihood);
      const ramCell = computeRamCell(severity, likelihood);
      const ramLevel = computeRamConsequence(severity, likelihood);

      // try update existing (unique index on deferral_id + category)
      const updated = await tx
        .update(deferralRisks)
        .set({
          severity,
          likelihood,
          ramCell,
          ramConsequenceLevel: ramLevel,
          justification: it.justification ?? "",
          updatedAt: new Date(),
        } as any)
        .where(
          and(
            eq(deferralRisks.deferralId, deferralId),
            eq(deferralRisks.category, it.category as any),
          ),
        );

      // drizzle update doesn't easily give affected rowcount cross-driver
      // so we do a read check; cheap (4 max categories)
      const exists = await tx
        .select({ id: deferralRisks.id })
        .from(deferralRisks)
        .where(
          and(
            eq(deferralRisks.deferralId, deferralId),
            eq(deferralRisks.category, it.category as any),
          ),
        )
        .limit(1);

      if (!exists[0]) {
        await tx.insert(deferralRisks).values({
          id: randomUUID(),
          deferralId,
          category: it.category as any,
          severity,
          likelihood,
          ramCell,
          ramConsequenceLevel: ramLevel,
          justification: it.justification ?? "",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      }
    }

    // bump parent updatedAt (nice UX)
    await tx
      .update(deferrals)
      .set({ updatedAt: new Date() } as any)
      .where(eq(deferrals.id, deferralId));
  });

  const items = await db
    .select()
    .from(deferralRisks)
    .where(eq(deferralRisks.deferralId, deferralId));

  return NextResponse.json({ ok: true, items }, { status: 200 });
}
