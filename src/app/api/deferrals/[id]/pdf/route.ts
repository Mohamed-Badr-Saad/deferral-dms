// src/app/deferral/[id]/pdf/route.ts (or src/app/api/deferrals/[id]/pdf/route.ts based on your app)
// Keep your current path, just replace the file content.

import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  deferrals,
  deferralRisks,
  deferralApprovals,
  deferralMitigations,
  users,
} from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import {
  DeferralPdfDoc,
  type PdfApprovalRow,
  type PdfMitigationRow,
  type PdfRiskRow,
  type PdfDeferral,
} from "@/src/lib/pdf/DeferralPdf";

type Ctx = { params: Promise<{ id: string }> };

async function fetchAsDataUri(
  req: Request,
  url: string,
): Promise<string | null> {
  try {
    if (!url) return null;

    const origin = new URL(req.url).origin;
    const absolute = url.startsWith("http") ? url : `${origin}${url}`;

    const cookie = req.headers.get("cookie") ?? "";
    const res = await fetch(absolute, {
      headers: cookie ? { cookie } : undefined,
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "image/png";
    const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${contentType};base64,${b64}`;
  } catch {
    return null;
  }
}

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

  // ✅ Allow ANY authenticated user to export/print any deferral
  // (You asked: "I also want any one to be able to print any deferral")

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
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        eq(deferralApprovals.cycle, d.approvalCycle), // ONLY LAST CYCLE
      ),
    );

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

  // Build approvals rows + signature fetch
  const approvalsSorted = approvalsDb.sort(
    (a: any, b: any) => Number(a.stepOrder) - Number(b.stepOrder),
  );

  const approvals: PdfApprovalRow[] = await Promise.all(
    approvalsSorted.map(async (a: any) => {
      const signerName =
        String(a.signedByNameSnapshot || "") ||
        (a.signedByUserId ? (nameById.get(a.signedByUserId) ?? "—") : "—");

      const signerPosition = a.signedByUserId
        ? (posById.get(a.signedByUserId) ?? "—")
        : "—";

      const sigUrl = String(a.signatureUrlSnapshot ?? "");
      const signatureDataUri = sigUrl
        ? await fetchAsDataUri(_req, sigUrl)
        : null;

      return {
        stepOrder: Number(a.stepOrder),
        stepRole: String(a.stepRole),
        status: String(a.status),

        signerName,
        signerPosition,

        signedAt: a.signedAt ? new Date(a.signedAt) : null,
        comment: String(a.comment ?? ""),

        // ✅ NEW
        signatureDataUri,
      };
    }),
  );

  const normalizeDepartment = (value: string | null | undefined) =>
    String(value ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  const initiatorDeptKey = normalizeDepartment(d.initiatorDepartment);

  const approvalByDepartment = new Map<string, PdfApprovalRow>();
  approvalsSorted.forEach((a: any, index: number) => {
    if (String(a.stepRole) !== "DEPARTMENT_HEAD") return;
    const deptKey = normalizeDepartment(a.targetDepartment);
    if (!deptKey) return;
    if (!approvalByDepartment.has(deptKey)) {
      approvalByDepartment.set(deptKey, approvals[index]);
    }
  });

  const approvalsForTable = approvals.filter((_, index) => {
    const rawApproval = approvalsSorted[index];
    if (String(rawApproval.stepRole) !== "DEPARTMENT_HEAD") return true;

    const deptKey = normalizeDepartment(rawApproval.targetDepartment);
    return !deptKey || deptKey === initiatorDeptKey;
  });

  const mitigationRowsDb = await db
    .select()
    .from(deferralMitigations)
    .where(eq(deferralMitigations.deferralId, deferralId))
    .orderBy(asc(deferralMitigations.createdAt));

  const mitigationRows: PdfMitigationRow[] = mitigationRowsDb.map((m) => {
    const approval = approvalByDepartment.get(
      normalizeDepartment(m.requiredDepartment),
    );

    return {
      mitigationText: String(m.description ?? ""),
      requiredDepartment: String(m.requiredDepartment ?? ""),
      signatureDataUri: approval?.signatureDataUri ?? null,
      approverName: approval?.signerName ?? "",
      signedAt: approval?.signedAt ?? null,
      comment: approval?.comment ?? "",
    };
  });

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

  const element = React.createElement(DeferralPdfDoc, {
    deferral,
    risks,
    mitigationRows,
    approvals: approvalsForTable,
  }) as Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(element);
  const body = new Uint8Array(pdf);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // ✅ inline makes browser print workflow nicer
      "Content-Disposition": `inline; filename="${d.deferralCode}.pdf"`,
    },
  });
}
