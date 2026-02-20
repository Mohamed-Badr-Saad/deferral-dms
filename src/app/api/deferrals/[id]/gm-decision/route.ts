// src/app/api/deferrals/[id]/gm-decision/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { deferralApprovals, deferrals } from "@/src/db/schema";
import { getBusinessProfile, requireRole } from "@/src/lib/authz";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
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

  const body = await req.json().catch(() => ({}));
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
  const def = dRows[0] as any;
  if (!def) return NextResponse.json({ message: "Not found" }, { status: 404 });

  if (def.status !== "IN_APPROVAL") {
    return NextResponse.json(
      {
        message: "Validation error",
        detail: "GM decision can only be set in IN_APPROVAL.",
      },
      { status: 400 },
    );
  }

  const cycle = Number(def.approvalCycle ?? 0);
  const wantTA = Boolean(parsed.data.requiresTechnicalAuthority);
  const wantAD = Boolean(parsed.data.requiresAdHoc);

  try {
    await db.transaction(async (tx) => {
      // load approvals for CURRENT cycle only
      const approvals = await tx
        .select()
        .from(deferralApprovals)
        .where(
          and(
            eq(deferralApprovals.deferralId, deferralId),
            eq(deferralApprovals.cycle, cycle),
          ),
        )
        .orderBy(asc(deferralApprovals.stepOrder));

      const gm = approvals.find((a: any) => a.stepRole === "RELIABILITY_GM");
      if (!gm)
        throw Object.assign(new Error("Reliability GM step is missing."), {
          status: 400,
        });

      // must be active & pending
      if (gm.status !== "PENDING" || !gm.isActive) {
        throw Object.assign(
          new Error(
            "Decision can only be set when Reliability GM step is ACTIVE and PENDING.",
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

      // Find responsible segment (first step role among RESP/SOD/DFGM)
      const responsible = approvals.find((a: any) =>
        ["RESPONSIBLE_GM", "SOD", "DFGM"].includes(String(a.stepRole)),
      );

      // If no responsible yet, we still insert right after GM.
      const insertBaseOrder = gm.stepOrder + 1;

      const needInsertRoles: string[] = [];
      if (wantTA) needInsertRoles.push("TECHNICAL_AUTHORITY");
      if (wantAD) needInsertRoles.push("AD_HOC");

      // Check existing TA/AD within CURRENT cycle
      const existing = new Map<string, any>();
      for (const a of approvals as any[]) existing.set(String(a.stepRole), a);

      const missing: string[] = needInsertRoles.filter((r) => !existing.get(r));

      // If we need to insert missing steps, we must shift stepOrder to make space.
      // Shift all steps with stepOrder >= insertBaseOrder by +missingCount
      if (missing.length > 0) {
        await tx
          .update(deferralApprovals)
          .set({
            stepOrder: sql`${deferralApprovals.stepOrder} + ${missing.length}`,
            updatedAt: new Date(),
          } as any)
          .where(
            and(
              eq(deferralApprovals.deferralId, deferralId),
              eq(deferralApprovals.cycle, cycle),
              sql`${deferralApprovals.stepOrder} >= ${insertBaseOrder}`,
            ),
          );

        // Insert missing roles sequentially after GM
        let order = insertBaseOrder;
        for (const role of missing) {
          await tx.insert(deferralApprovals).values({
            id: randomUUID(),
            deferralId,
            cycle,
            stepOrder: order++,
            stepRole: role as any,
            status: "PENDING",
            isActive: false,
            comment: "",
            signatureUrlSnapshot: "",
            signedByUserId: null,
            signedAt: null,
            signedByNameSnapshot: "",
            assignedUserId: null,
            targetDepartment: null,
            targetGmGroup: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any);
        }
      }

      // If user unchecked TA/AD and row exists in current cycle => mark SKIPPED
      const taAd = await tx
        .select()
        .from(deferralApprovals)
        .where(
          and(
            eq(deferralApprovals.deferralId, deferralId),
            eq(deferralApprovals.cycle, cycle),
            inArray(deferralApprovals.stepRole, [
              "TECHNICAL_AUTHORITY",
              "AD_HOC",
            ]),
          ),
        )
        .orderBy(asc(deferralApprovals.stepOrder));

      for (const a of taAd as any[]) {
        if (a.stepRole === "TECHNICAL_AUTHORITY") {
          if (!wantTA) {
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
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json(
      {
        message: status === 500 ? "Server error" : "Validation error",
        detail: err?.message ?? "",
      },
      { status },
    );
  }
}
