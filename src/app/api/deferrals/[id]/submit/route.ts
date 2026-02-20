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
import { and, desc, eq } from "drizzle-orm";
import { buildApprovalSteps } from "@/src/lib/workflow";
import { activateFirstStep } from "@/src/lib/approval-progress";
import { computeRamCell, computeRamConsequence } from "@/src/lib/constants";

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
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

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

  // ✅ only initiator submits
  if (def.initiatorUserId !== profile.id) {
    return NextResponse.json({ message: "Permission denied" }, { status: 403 });
  }

  // ✅ allow submit from DRAFT or RETURNED
  if (!(def.status === "DRAFT" || def.status === "RETURNED")) {
    return NextResponse.json(
      {
        message: "Validation error",
        detail: "Only draft/returned can be submitted",
      },
      { status: 400 },
    );
  }

  try {
    let newCycle = 0;

    await db.transaction(async (tx) => {
      // 0) increment approval cycle
      newCycle = Number(def.approvalCycle ?? 0) + 1;

      // to mark old approvals as inactive (for safety, should not be active at this point)
      await tx
        .update(deferralApprovals)
        .set({ isActive: false } as any)
        .where(eq(deferralApprovals.deferralId, deferralId));

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
      // ✅ IMPORTANT: if this deferral was submitted before, reuse mapping
      const existingMapping = await tx
        .select()
        .from(workOrderDeferrals)
        .where(eq(workOrderDeferrals.deferralId, deferralId))
        .limit(1);

      let deferralNumber: 1 | 2 | 3;

      if (existingMapping[0]) {
        deferralNumber = Number(existingMapping[0].deferralNumber) as any;
      } else {
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
            {
              status: 400,
            },
          );
        }

        await tx.insert(workOrderDeferrals).values({
          id: randomUUID(),
          workOrderId,
          deferralId,
          deferralNumber: next,
        } as any);

        deferralNumber = next;
      }

      // 3) Compute RAM derived fields
      const severity = Number(def.severity ?? 1);
      const likelihood = String(def.likelihood ?? "A").toUpperCase();
      const ramCell = computeRamCell(severity, likelihood);
      const ramLevel = computeRamConsequence(severity, likelihood);

      // 4) Update deferral: set IN_APPROVAL, clear returned fields, set new cycle
      await tx
        .update(deferrals)
        .set({
          workOrderNo: parsed.data.workOrderNo,
          workOrderTitle: parsed.data.workOrderTitle ?? "",
          status: "IN_APPROVAL",
          approvalCycle: newCycle,
          returnedAt: null,
          returnedByRole: null,
          returnedComment: null,
          ramCell,
          ramConsequenceLevel: ramLevel,
          updatedAt: new Date(),
        } as any)
        .where(eq(deferrals.id, deferralId));

      // 5) Resolve gmGroup for department
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
          {
            status: 400,
          },
        );
      }

      // 6) Rebuild approvals from scratch for this NEW cycle
      // ✅ keep history: DO NOT delete old cycles
      const steps = buildApprovalSteps({
        deferralNumber,
        requiresTechnicalAuthority: Boolean(def.requiresTechnicalAuthority),
        requiresAdHoc: Boolean(def.requiresAdHoc),
      });

      for (const s of steps) {
        await tx.insert(deferralApprovals).values({
          id: randomUUID(),
          deferralId,
          cycle: newCycle,
          stepOrder: s.stepOrder,
          stepRole: s.stepRole,
          status: "PENDING",
          isActive: false,
          comment: "",
          signatureUrlSnapshot: "",
          signedByNameSnapshot: "",
          assignedUserId: null,
          targetDepartment: s.stepRole === "DEPARTMENT_HEAD" ? deptRaw : null,
          targetGmGroup: s.stepRole === "RESPONSIBLE_GM" ? gmGroup : null,
        } as any);
      }
    });

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
