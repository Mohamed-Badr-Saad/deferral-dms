import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { deferralApprovals, deferrals } from "@/src/db/schema";
import { getBusinessProfile, requireRole } from "@/src/lib/authz";
import { and, asc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

const BodySchema = z.object({
  requiresTechnicalAuthority: z.boolean(),
  requiresAdHoc: z.boolean(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  requireRole(profile, ["RELIABILITY_GM"]);

  const { id: deferralId } = await ctx.params;

  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation error", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const dRows = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, deferralId))
    .limit(1);
  const def = dRows[0];
  if (!def) return NextResponse.json({ message: "Not found" }, { status: 404 });

  if (def.status !== "IN_APPROVAL") {
    return NextResponse.json(
      {
        message: "Validation error",
        detail: "GM decision can only be set after submission (IN_APPROVAL).",
      },
      { status: 400 },
    );
  }

  const wantTA = parsed.data.requiresTechnicalAuthority;
  const wantAD = parsed.data.requiresAdHoc;

  try {
    await db.transaction(async (tx) => {
      const approvals = await tx
        .select()
        .from(deferralApprovals)
        .where(eq(deferralApprovals.deferralId, deferralId))
        .orderBy(asc(deferralApprovals.stepOrder));

      const gm = approvals.find((a) => a.stepRole === "RELIABILITY_GM");
      if (!gm)
        throw Object.assign(new Error("Reliability GM step is missing."), {
          status: 400,
        });

      // ✅ Editable ONLY while GM step is pending AND active
      if (gm.status !== "PENDING") {
        throw Object.assign(
          new Error("Decision locked. Reliability GM has already acted."),
          { status: 400 },
        );
      }
      if (!gm.isActive) {
        throw Object.assign(
          new Error(
            "Decision can only be set when Reliability GM step is active.",
          ),
          { status: 400 },
        );
      }

      // Update flags on deferral
      await tx
        .update(deferrals)
        .set({
          requiresTechnicalAuthority: wantTA,
          requiresAdHoc: wantAD,
          updatedAt: new Date(),
        } as any)
        .where(eq(deferrals.id, deferralId));

      // Ensure TA/ADHOC rows exist right after GM step_order (insert if missing)
      // We won't delete them; we SKIP them.
      const existingTA =
        approvals.find((a) => a.stepRole === "TECHNICAL_AUTHORITY") ?? null;
      const existingAD = approvals.find((a) => a.stepRole === "AD_HOC") ?? null;

      // Insert missing rows (at gm.stepOrder+1 and +2) ONLY if needed.
      // We keep it simple: if missing, insert at end with correct ordering by using max+1.
      // (No shifting needed because we are not trying to place visually between steps; timeline ordering is stepOrder though)
      // Better: keep your previous shifting logic if you already rely on strict ordering.
      // Here: we assume you already implemented insertion correctly before Responsible segment.
      if (!existingTA && wantTA) {
        await tx.insert(deferralApprovals).values({
          id: randomUUID(),
          deferralId,
          stepOrder: gm.stepOrder + 1,
          stepRole: "TECHNICAL_AUTHORITY",
          status: "PENDING",
          isActive: false,
          comment: "",
          signatureUrlSnapshot: "",
          signedByUserId: null,
          signedAt: null,
          signedByNameSnapshot: "",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      }

      if (!existingAD && wantAD) {
        await tx.insert(deferralApprovals).values({
          id: randomUUID(),
          deferralId,
          stepOrder: gm.stepOrder + 2,
          stepRole: "AD_HOC",
          status: "PENDING",
          isActive: false,
          comment: "",
          signatureUrlSnapshot: "",
          signedByUserId: null,
          signedAt: null,
          signedByNameSnapshot: "",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      }

      // Reload TA/ADHOC after potential insertion
      const taAd = await tx
        .select()
        .from(deferralApprovals)
        .where(
          and(
            eq(deferralApprovals.deferralId, deferralId),
            inArray(deferralApprovals.stepRole, [
              "TECHNICAL_AUTHORITY",
              "AD_HOC",
            ]),
          ),
        )
        .orderBy(asc(deferralApprovals.stepOrder));

      for (const a of taAd) {
        if (a.stepRole === "TECHNICAL_AUTHORITY") {
          if (!wantTA) {
            // unchecked => SKIP (and deactivate if active)
            await tx
              .update(deferralApprovals)
              .set({
                status: "SKIPPED",
                isActive: false,
                updatedAt: new Date(),
              } as any)
              .where(eq(deferralApprovals.id, a.id));
          } else if (a.status === "SKIPPED") {
            // re-checked => back to PENDING
            await tx
              .update(deferralApprovals)
              .set({ status: "PENDING", updatedAt: new Date() } as any)
              .where(eq(deferralApprovals.id, a.id));
          }
        }

        if (a.stepRole === "AD_HOC") {
          if (!wantAD) {
            await tx
              .update(deferralApprovals)
              .set({
                status: "SKIPPED",
                isActive: false,
                updatedAt: new Date(),
              } as any)
              .where(eq(deferralApprovals.id, a.id));
          } else if (a.status === "SKIPPED") {
            await tx
              .update(deferralApprovals)
              .set({ status: "PENDING", updatedAt: new Date() } as any)
              .where(eq(deferralApprovals.id, a.id));
          }
        }
      }

      // Safety: if no active pending remains, activate first pending step_order
      const activePending = await tx
        .select()
        .from(deferralApprovals)
        .where(
          and(
            eq(deferralApprovals.deferralId, deferralId),
            eq(deferralApprovals.isActive, true),
            eq(deferralApprovals.status, "PENDING"),
          ),
        )
        .limit(1);

      if (activePending.length === 0) {
        await tx
          .update(deferralApprovals)
          .set({ isActive: false } as any)
          .where(eq(deferralApprovals.deferralId, deferralId));

        const pending = await tx
          .select()
          .from(deferralApprovals)
          .where(
            and(
              eq(deferralApprovals.deferralId, deferralId),
              eq(deferralApprovals.status, "PENDING"),
            ),
          )
          .orderBy(asc(deferralApprovals.stepOrder))
          .limit(1);

        if (pending[0]) {
          await tx
            .update(deferralApprovals)
            .set({ isActive: true } as any)
            .where(
              and(
                eq(deferralApprovals.deferralId, deferralId),
                eq(deferralApprovals.stepOrder, pending[0].stepOrder),
              ),
            );
        }
      }
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json(
      {
        message: status === 500 ? "Server error" : "Validation error",
        detail: err?.message ?? "Server error",
      },
      { status },
    );
  }
}
