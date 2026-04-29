"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/src/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignatureStamp } from "@/src/components/deferral/SignatureStamp";
import { formatStepRole } from "@/src/lib/helper";

type Approval = {
  id: string;
  deferralId: string;
  stepOrder: number;
  stepRole: string;
  status: "PENDING" | "APPROVED" | "RETURNED" | "REJECTED" | "SKIPPED";
  isActive: boolean;
  comment: string;
  signedAt: string | null;
  signatureUrlSnapshot: string;
  signedByNameSnapshot?: string; // new field
  targetDepartment?: string | null;
};

type ApiResponse = {
  approvals: Approval[];
  parallelCounts: { total: number; approved: number; pending: number };
  counts: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    active: number;
  };
};

const PARALLEL_GROUP = new Set(["RESPONSIBLE_GM", "SOD", "DFGM"]);

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function ApprovalTimeline({
  deferralId,
  initiatorDepartment,
}: {
  deferralId: string;
  initiatorDepartment?: string | null;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const res = await api<ApiResponse>(
        `/api/deferrals/${deferralId}/approvals`,
      );
      setData(res);
    } catch (e: any) {
      setErr(e.message ?? "Failed to load approvals");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferralId]);

  const sections = useMemo(() => {
    const approvals = data?.approvals ?? [];
    const parallel: Approval[] = [];
    const initiatorDepartmentHead: Approval[] = [];
    const mitigationApprovals: Approval[] = [];
    const reliabilityEngineer: Approval[] = [];
    const reliabilityGm: Approval[] = [];
    const optionalAuthorities: Approval[] = [];
    const planningEngineer: Approval[] = [];
    const planningSupervisor: Approval[] = [];
    const other: Approval[] = [];

    const initiatorDept = normalizeText(initiatorDepartment);

    for (const approval of approvals) {
      if (PARALLEL_GROUP.has(approval.stepRole)) {
        parallel.push(approval);
        continue;
      }

      if (approval.stepRole === "DEPARTMENT_HEAD") {
        const targetDept = normalizeText(approval.targetDepartment);
        const isMitigation =
          targetDept !== "" &&
          initiatorDept !== "" &&
          targetDept !== initiatorDept;

        if (isMitigation) {
          mitigationApprovals.push(approval);
        } else {
          initiatorDepartmentHead.push(approval);
        }
        continue;
      }

      if (approval.stepRole === "RELIABILITY_ENGINEER") {
        reliabilityEngineer.push(approval);
        continue;
      }

      if (approval.stepRole === "RELIABILITY_GM") {
        reliabilityGm.push(approval);
        continue;
      }

      if (
        approval.stepRole === "TECHNICAL_AUTHORITY" ||
        approval.stepRole === "AD_HOC"
      ) {
        optionalAuthorities.push(approval);
        continue;
      }

      if (approval.stepRole === "PLANNING_ENGINEER") {
        planningEngineer.push(approval);
        continue;
      }

      if (approval.stepRole === "PLANNING_SUPERVISOR_ENGINEER") {
        planningSupervisor.push(approval);
        continue;
      }

      other.push(approval);
    }

    return {
      initiatorDepartmentHead,
      mitigationApprovals,
      reliabilityEngineer,
      reliabilityGm,
      optionalAuthorities,
      parallel,
      planningEngineer,
      planningSupervisor,
      other,
    };
  }, [data, initiatorDepartment]);

  function renderApprovalRow(
    approval: Approval,
    options?: {
      contextLabel?: string;
    },
  ) {
    return (
      <div
        key={approval.id}
        className={`rounded-lg border p-4 ${
          approval.isActive ? "border-foreground/30" : "border-border"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="font-medium">
                {formatStepRole(approval.stepRole)}
                {options?.contextLabel ? (
                  <div className="text-xs text-muted-foreground">
                    {options.contextLabel}
                  </div>
                ) : null}
                {approval.targetDepartment ? (
                  <div className="text-xs text-muted-foreground">
                    {approval.targetDepartment}
                  </div>
                ) : null}
                {approval.signedByNameSnapshot ? (
                  <div className="text-xs text-muted-foreground">
                    by {approval.signedByNameSnapshot}
                  </div>
                ) : null}
              </div>
              <Badge variant="outline">{approval.status}</Badge>
              {approval.isActive && <Badge>Active</Badge>}
            </div>
            {approval.comment ? (
              <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                {approval.comment}
              </div>
            ) : null}
          </div>

          {approval.status === "APPROVED" ? (
            <SignatureStamp
              signatureUrl={approval.signatureUrlSnapshot}
              signerName={approval.signedByNameSnapshot ?? ""}
              signedAt={approval.signedAt}
            />
          ) : (
            <div className="text-xs text-muted-foreground">
              {approval.status === "PENDING" ? "Awaiting action" : "—"}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <CardTitle>Approval Timeline</CardTitle>
        {data?.parallelCounts?.total ? (
          <div className="text-xs text-muted-foreground">
            Parallel sign-offs:{" "}
            <span className="font-medium">
              {data.parallelCounts.approved}/{data.parallelCounts.total}
            </span>{" "}
            completed
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        {err && <div className="text-sm text-destructive">{err}</div>}

        {!data ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <>
            <div className="space-y-3">
              {sections.initiatorDepartmentHead.map((approval) =>
                renderApprovalRow(approval),
              )}

              {sections.mitigationApprovals.length > 0 ? (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="font-medium">Mitigation Approvals</div>
                  {sections.mitigationApprovals.map((approval) =>
                    renderApprovalRow(approval, {
                      contextLabel: "Related to mitigation",
                    }),
                  )}
                </div>
              ) : null}

              {sections.reliabilityEngineer.map((approval) =>
                renderApprovalRow(approval),
              )}

              {sections.reliabilityGm.map((approval) =>
                renderApprovalRow(approval),
              )}

              {sections.optionalAuthorities.map((approval) =>
                renderApprovalRow(approval),
              )}
            </div>

            {sections.parallel.length > 0 && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Parallel Sign-off Group</div>
                  <div className="text-xs text-muted-foreground">
                    {data.parallelCounts.approved}/{data.parallelCounts.total}{" "}
                    completed
                  </div>
                </div>

                {sections.parallel.map((a) => (
                  <div key={a.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">
                            {formatStepRole(a.stepRole)}
                          </div>
                          <Badge variant="outline">{a.status}</Badge>
                          {a.isActive && <Badge>Active</Badge>}
                        </div>
                        {a.comment ? (
                          <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                            {a.comment}
                          </div>
                        ) : null}
                      </div>

                      {a.status === "APPROVED" ? (
                        <SignatureStamp
                          signatureUrl={a.signatureUrlSnapshot}
                          signerName={a.signedByNameSnapshot ?? ""}
                          signedAt={a.signedAt}
                        />
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {a.status === "PENDING" ? "Awaiting action" : "—"}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {sections.planningEngineer.map((approval) =>
                renderApprovalRow(approval),
              )}

              {sections.planningSupervisor.map((approval) =>
                renderApprovalRow(approval),
              )}

              {sections.other.map((approval) => renderApprovalRow(approval))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
