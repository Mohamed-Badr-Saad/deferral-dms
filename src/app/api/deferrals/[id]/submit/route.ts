import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/src/db";
import {
  deferrals,
  workOrders,
  workOrderDeferrals,
  deferralApprovals,
  deferralMitigations,
  notifications,
  responsibleGmMappings,
  users,
} from "@/src/db/schema";
import { getBusinessProfile, requireRole } from "@/src/lib/authz";
import { and, asc, desc, eq, ilike, inArray } from "drizzle-orm";
import { buildApprovalSteps } from "@/src/lib/workflow";
import { activateFirstStep } from "@/src/lib/approval-progress";
import { computeRamCell, computeRamConsequence } from "@/src/lib/constants";

const SubmitSchema = z.object({
  workOrderNo: z.string().min(1),
  workOrderTitle: z.string().optional().default(""),
  confirmDuplicate: z.boolean().optional().default(false),
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

  const confirmDuplicate = parsed.data.confirmDuplicate;

  const defRows = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, deferralId))
    .limit(1);
  const def = defRows[0];
  if (!def) return NextResponse.json({ message: "Not found" }, { status: 404 });

  if (def.initiatorUserId !== profile.id) {
    return NextResponse.json({ message: "Permission denied" }, { status: 403 });
  }

  if (!(def.status === "DRAFT" || def.status === "RETURNED")) {
    return NextResponse.json(
      {
        message: "Validation error",
        detail: "Only draft/returned can be submitted",
      },
      { status: 400 },
    );
  }

  const mitigationRows = await db
    .select()
    .from(deferralMitigations)
    .where(eq(deferralMitigations.deferralId, deferralId))
    .orderBy(asc(deferralMitigations.createdAt));

  if (mitigationRows.length === 0) {
    return NextResponse.json(
      { message: "At least one mitigation is required before submitting." },
      { status: 400 },
    );
  }

  try {
    let newCycle = 0;

    await db.transaction(async (tx) => {
      newCycle = Number(def.approvalCycle ?? 0) + 1;

      await tx
        .update(deferralApprovals)
        .set({ isActive: false } as any)
        .where(eq(deferralApprovals.deferralId, deferralId));

      // Find or create work order
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

      // Determine deferral number (1..3)
      const existingMapping = await tx
        .select()
        .from(workOrderDeferrals)
        .where(eq(workOrderDeferrals.deferralId, deferralId))
        .limit(1);
      let priorMappingsForWorkOrder: Array<{ deferralId: string | null }> = [];

      let deferralNumber: 1 | 2 | 3;

      if (existingMapping[0]) {
        deferralNumber = Number(existingMapping[0].deferralNumber) as any;
      } else {
        const existingMappings = await tx
          .select()
          .from(workOrderDeferrals)
          .where(eq(workOrderDeferrals.workOrderId, workOrderId))
          .orderBy(desc(workOrderDeferrals.deferralNumber));
        priorMappingsForWorkOrder = existingMappings.map((row) => ({
          deferralId: row.deferralId,
        }));

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

        if (next >= 2 && !confirmDuplicate) {
          const dupErr = new Error("DUPLICATE_CONFIRMATION_REQUIRED") as any;
          dupErr.status = 409;
          dupErr.duplicateRank = next;
          dupErr.humanMessage =
            next === 2
              ? "A previous deferral already exists for this work order. Confirm to create a second deferral."
              : "Previous deferrals already exist for this work order. Confirm to create another deferral.";
          throw dupErr;
        }

        await tx.insert(workOrderDeferrals).values({
          id: randomUUID(),
          workOrderId,
          deferralId,
          deferralNumber: next,
        } as any);

        deferralNumber = next;
      }

      // Compute RAM
      const severity = Number(def.severity ?? 1);
      const likelihood = String(def.likelihood ?? "A").toUpperCase();
      const ramCell = computeRamCell(severity, likelihood);
      const ramLevel = computeRamConsequence(severity, likelihood);

      // Update deferral status
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

      // Resolve GM group
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

      // Build base approval steps
      const steps = buildApprovalSteps({
        deferralNumber,
        requiresTechnicalAuthority: Boolean(def.requiresTechnicalAuthority),
        requiresAdHoc: Boolean(def.requiresAdHoc),
      });

      // Find the stepOrder of the initiator DH step (stepOrder 1 = first step)
      const dhStep = steps.find((s) => s.stepRole === "DEPARTMENT_HEAD");
      const dhOrder = dhStep?.stepOrder ?? 1;

      // Collect mitigation departments that differ from initiator department
      const mitigationDepts = [
        ...new Set(
          mitigationRows
            .map((m) => m.requiredDepartment?.trim())
            .filter((d): d is string => !!d)
            .filter(
              (d) => normalizeDepartment(d) !== normalizeDepartment(deptRaw),
            ),
        ),
      ];

      // Shift all steps AFTER the initiator DH step up by 1 to make room for mitigation DHs
      const mitigationShift = mitigationDepts.length > 0 ? 1 : 0;

      const adjustedSteps = steps.map((s) => ({
        ...s,
        stepOrder:
          s.stepOrder > dhOrder ? s.stepOrder + mitigationShift : s.stepOrder,
      }));

      // Insert adjusted base steps
      for (const s of adjustedSteps) {
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

      // Insert ALL mitigation DH steps at the SAME stepOrder (parallel)
      for (let i = 0; i < mitigationDepts.length; i++) {
        await tx.insert(deferralApprovals).values({
          id: randomUUID(),
          deferralId,
          cycle: newCycle,
          stepOrder: dhOrder + 1, // same order = parallel
          stepRole: "DEPARTMENT_HEAD",
          status: "PENDING",
          isActive: false,
          comment: "",
          signatureUrlSnapshot: "",
          signedByNameSnapshot: "",
          assignedUserId: null,
          targetDepartment: mitigationDepts[i],
          targetGmGroup: null,
        } as any);
      }

      // If the initiator fulfilled an expiry reminder by creating the next
      // deferral for the same work order, clear the old expiry notifications.
      if (!existingMapping[0] && deferralNumber >= 2) {
        const priorDeferralIds = priorMappingsForWorkOrder
          .map((row) => String(row.deferralId ?? ""))
          .filter(Boolean);

        if (priorDeferralIds.length > 0) {
          await tx
            .update(notifications)
            .set({ isRead: true, readAt: new Date() } as any)
            .where(
              and(
                inArray(notifications.deferralId, priorDeferralIds as any),
                ilike(notifications.title, "Deferral expiring soon:%"),
              ) as any,
            );
        }
      }
    });

    await activateFirstStep(deferralId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    if (
      err?.status === 409 &&
      err?.message === "DUPLICATE_CONFIRMATION_REQUIRED"
    ) {
      return NextResponse.json(
        {
          needsDuplicateConfirmation: true,
          duplicateRank: err.duplicateRank,
          message: err.humanMessage,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        message: err?.status === 403 ? "Permission denied" : "Server error",
        detail: err?.message ?? "Server error",
      },
      { status: err?.status ?? 500 },
    );
  }
}
