import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { and, eq, inArray, or } from "drizzle-orm";

import { db } from "@/src/db";
import {
  deferrals,
  deferralRisks,
  deferralApprovals,
  users,
} from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import {
  DeferralPdfDoc,
  type PdfApprovalRow,
  type PdfRiskRow,
  type PdfDeferral,
} from "@/src/lib/pdf/DeferralPdf";
import { canViewDeferral } from "@/src/lib/authz/deferralAccess";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const { id: deferralId } = await ctx.params;
  if (!deferralId || deferralId === "undefined") {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  const dRows = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, deferralId))
    .limit(1);
  const d = dRows[0];
  if (!d) return NextResponse.json({ message: "Not found" }, { status: 404 });

  // ✅ permissions: initiator OR involved in approvals (assigned/signed)
  const aMine = await db
    .select({ id: deferralApprovals.id })
    .from(deferralApprovals)
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        or(
          eq(deferralApprovals.assignedUserId, profile.id),
          eq(deferralApprovals.signedByUserId, profile.id),
        ),
      ),
    )
    .limit(1);

  const access = await canViewDeferral(deferralId, profile.id);
  if (!access.ok) {
    return NextResponse.json(
      {
        message:
          access.reason === "not_found" ? "Not found" : "Permission denied",
      },
      { status: access.reason === "not_found" ? 404 : 403 },
    );
  }

  // Initiator user info
  const initiatorRows = await db
    .select({ name: users.name, position: users.position })
    .from(users)
    .where(eq(users.id, d.initiatorUserId))
    .limit(1);

  const initiator = initiatorRows[0] ?? { name: "—", position: "—" };

  // Risks
  const riskRowsDb = await db
    .select()
    .from(deferralRisks)
    .where(eq(deferralRisks.deferralId, deferralId));

  const risks: PdfRiskRow[] = riskRowsDb.map((r: any) => ({
    category: r.category,
    severity: Number(r.severity ?? 1),
    likelihood: String(r.likelihood ?? "A"),
    justification: String(r.justification ?? ""),
  }));

  // Approvals
  const approvalsDb = await db
    .select()
    .from(deferralApprovals)
    .where(eq(deferralApprovals.deferralId, deferralId));

  const signedIds = approvalsDb
    .map((a: any) => a.signedByUserId)
    .filter(Boolean) as string[];

  const signedUsers =
    signedIds.length === 0
      ? []
      : await db
          .select({ id: users.id, position: users.position, name: users.name })
          .from(users)
          .where(inArray(users.id, signedIds));

  const posById = new Map(signedUsers.map((u) => [u.id, u.position]));
  const nameById = new Map(signedUsers.map((u) => [u.id, u.name]));

  const approvals: PdfApprovalRow[] = approvalsDb
    .sort((a: any, b: any) => Number(a.stepOrder) - Number(b.stepOrder))
    .map((a: any) => ({
      stepOrder: Number(a.stepOrder),
      stepRole: String(a.stepRole),
      status: String(a.status),

      signerName:
        String(a.signedByNameSnapshot || "") ||
        (a.signedByUserId ? (nameById.get(a.signedByUserId) ?? "—") : "—"),

      signerPosition: a.signedByUserId
        ? (posById.get(a.signedByUserId) ?? "—")
        : "—",

      signedAt: a.signedAt ? new Date(a.signedAt) : null,
      comment: String(a.comment ?? ""),
    }));

  const deferral: PdfDeferral = {
    deferralCode: d.deferralCode,

    initiatorName: initiator.name,
    initiatorPosition: initiator.position,
    initiatorDepartment: d.initiatorDepartment,

    workOrderNo: d.workOrderNo || "",
    workOrderTitle: d.workOrderTitle || "",

    equipmentTag: d.equipmentTag || "",
    equipmentDescription: d.equipmentDescription || "",

    safetyCriticality: d.safetyCriticality || "",
    taskCriticality: d.taskCriticality || "",

    lafdStartDate: d.lafdStartDate ? new Date(d.lafdStartDate) : null,
    lafdEndDate: d.lafdEndDate ? new Date(d.lafdEndDate) : null,

    createdAt: d.createdAt ? new Date(d.createdAt) : null,

    description: d.description || "",
    justification: d.justification || "",
    consequence: d.consequence || "",
    mitigations: d.mitigations || "",
  };

  // ✅ NO JSX here (avoids your parse error)
  const element = React.createElement(DeferralPdfDoc, {
    deferral,
    risks,
    approvals,
  });
  const pdf = await renderToBuffer(element);

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${d.deferralCode}.pdf"`,
    },
  });
}
