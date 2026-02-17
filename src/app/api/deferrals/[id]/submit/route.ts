// src/app/api/deferrals/[id]/submit/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/src/db";
import {
  deferrals,
  workOrders,
  workOrderDeferrals,
  deferralApprovals,
  responsibleGmMappings,
} from "@/src/db/schema";
import { getBusinessProfile, requireRole } from "@/src/lib/authz";
import { eq, desc } from "drizzle-orm";
import { buildApprovalSteps } from "@/src/lib/workflow";
import { activateFirstStep } from "@/src/lib/approval-progress";
import { computeRamCell, computeRamConsequence } from "@/src/lib/constants";
import { canViewDeferral } from "@/src/lib/authz/deferralAccess";

const SubmitSchema = z.object({
  workOrderNo: z.string().min(1),
  workOrderTitle: z.string().optional().default(""),
});

type Ctx = { params: Promise<{ id: string }> };

function normalizeDepartment(input: string) {
  return (input ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export async function POST(req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  // ✅ include ADMIN
  requireRole(profile, ["ENGINEER_APPLICANT", "ADMIN"]);

  const { id: deferralId } = await ctx.params;

  const body = await req.json();
  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation error", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const defRows = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, deferralId))
    .limit(1);

  const def = defRows[0];
  if (!def) return NextResponse.json({ message: "Not found" }, { status: 404 });

  // ✅ still only initiator can submit their draft
  if (def.initiatorUserId !== profile.id) {
    return NextResponse.json({ message: "Permission denied" }, { status: 403 });
  }
  if (!["DRAFT", "REVISION_REQUIRED"].includes(def.status)) {
    return NextResponse.json(
      { message: "Validation error", detail: "Only drafts can be submitted" },
      { status: 400 },
    );
  }

  try {
    await db.transaction(async (tx) => {
      // 1) Find or create work order
      const woExisting = await tx
        .select()
        .from(workOrders)
        .where(eq(workOrders.workOrderNo, parsed.data.workOrderNo))
        .limit(1);

      const workOrderId = woExisting[0]?.id ?? randomUUID();
      if (!woExisting[0]) {
        await tx.insert(workOrders).values({
          id: workOrderId,
          workOrderNo: parsed.data.workOrderNo,
          title: parsed.data.workOrderTitle ?? "",
        } as any);
      }

      // 2) Determine deferral number (1..3)
      const existingMappings = await tx
        .select()
        .from(workOrderDeferrals)
        .where(eq(workOrderDeferrals.workOrderId, workOrderId))
        .orderBy(desc(workOrderDeferrals.deferralNumber));

      const next = (Number(existingMappings[0]?.deferralNumber ?? 0) + 1) as
        | 1
        | 2
        | 3;

      if (next > 3) {
        throw Object.assign(
          new Error("This work order already has 3 deferrals"),
          { status: 400 },
        );
      }

      await tx.insert(workOrderDeferrals).values({
        id: randomUUID(),
        workOrderId,
        deferralId,
        deferralNumber: next,
      } as any);

      // 3) Compute RAM derived fields
      const severity = Number(def.severity ?? 1);
      const likelihood = String(def.likelihood ?? "A").toUpperCase();
      const ramCell = computeRamCell(severity, likelihood);
      const ramLevel = computeRamConsequence(severity, likelihood);

      await tx
        .update(deferrals)
        .set({
          workOrderNo: parsed.data.workOrderNo,
          workOrderTitle: parsed.data.workOrderTitle ?? "",
          status: "IN_APPROVAL",
          ramCell,
          ramConsequenceLevel: ramLevel,
          updatedAt: new Date(),
        } as any)
        .where(eq(deferrals.id, deferralId));

      // 4) Resolve scopes (department + mapped gmGroup)
      const deptRaw = (def.initiatorDepartment ?? "").trim();
      const deptNorm = normalizeDepartment(deptRaw);

      const mappingExact = await tx
        .select({
          department: responsibleGmMappings.department,
          gmGroup: responsibleGmMappings.gmGroup,
        })
        .from(responsibleGmMappings)
        .where(eq(responsibleGmMappings.department, deptRaw))
        .limit(1);

      let gmGroup = mappingExact[0]?.gmGroup ?? null;

      if (!gmGroup) {
        const allMappings = await tx
          .select({
            department: responsibleGmMappings.department,
            gmGroup: responsibleGmMappings.gmGroup,
          })
          .from(responsibleGmMappings);

        const found = allMappings.find(
          (m) => normalizeDepartment(String(m.department ?? "")) === deptNorm,
        );
        gmGroup = found?.gmGroup ?? null;
      }

      if (!gmGroup) {
        throw Object.assign(
          new Error(`No responsible GM mapping for department="${deptRaw}"`),
          { status: 400 },
        );
      }

      // 5) Insert approvals (broadcast-to-group using scopes)
      const steps = buildApprovalSteps({
        deferralNumber: next,
        requiresTechnicalAuthority: Boolean(def.requiresTechnicalAuthority),
        requiresAdHoc: Boolean(def.requiresAdHoc),
      });

      for (const s of steps) {
        await tx.insert(deferralApprovals).values({
          id: randomUUID(),
          deferralId,
          stepOrder: s.stepOrder,
          stepRole: s.stepRole,
          status: "PENDING",
          isActive: false,
          comment: "",
          signatureUrlSnapshot: "",
          signedByNameSnapshot: "",
          assignedUserId: null, // broadcast mode
          targetDepartment: s.stepRole === "DEPARTMENT_HEAD" ? deptRaw : null,
          targetGmGroup: s.stepRole === "RESPONSIBLE_GM" ? gmGroup : null,
        } as any);
      }
    });

    // ✅ activates first step and notifies approvers
    await activateFirstStep(deferralId);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        message: err?.status === 403 ? "Permission denied" : "Server error",
        detail: err?.message ?? "Server error",
      },
      { status: err?.status ?? 500 },
    );
  }
}
