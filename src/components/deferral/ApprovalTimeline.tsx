"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/src/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignatureStamp } from "@/src/components/deferral/SignatureStamp";
import { USER_ROLE_LABELS } from "@/src/lib/constants";

type Approval = {
  id: string;
  deferralId: string;
  stepOrder: number;
  stepRole: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";
  isActive: boolean;
  comment: string;
  signedAt: string | null;
  signatureUrlSnapshot: string;
  signedByNameSnapshot?: string; // new field
};

type ApiResponse = {
  approvals: Approval[];
  parallelCounts: { total: number; approved: number; pending: number };
  counts: { total: number; approved: number; rejected: number; pending: number; active: number };
};

const PARALLEL_GROUP = new Set(["RESPONSIBLE_GM", "SOD", "DFGM"]);

function roleLabel(role: string) {
  return (USER_ROLE_LABELS as any)[role] ?? role;
}

export function ApprovalTimeline({ deferralId }: { deferralId: string }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const res = await api<ApiResponse>(`/api/deferrals/${deferralId}/approvals`);
      setData(res);
    } catch (e: any) {
      setErr(e.message ?? "Failed to load approvals");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferralId]);

  const { parallel, normal } = useMemo(() => {
    const approvals = data?.approvals ?? [];
    return {
      parallel: approvals.filter((a) => PARALLEL_GROUP.has(a.stepRole)),
      normal: approvals.filter((a) => !PARALLEL_GROUP.has(a.stepRole)),
    };
  }, [data]);

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
            {/* Normal steps */}
            <div className="space-y-3">
              {normal.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-lg border p-4 ${
                    a.isActive ? "border-foreground/30" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{roleLabel(a.stepRole)}</div>
                        <Badge variant="outline">{a.status}</Badge>
                        {a.isActive && <Badge>Active</Badge>}
                      </div>
                      {a.comment ? (
                        <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
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

            {/* Parallel group (only show if exists) */}
            {parallel.length > 0 && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Parallel Sign-off Group</div>
                  <div className="text-xs text-muted-foreground">
                    {data.parallelCounts.approved}/{data.parallelCounts.total} completed
                  </div>
                </div>

                {parallel.map((a) => (
                  <div key={a.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{roleLabel(a.stepRole)}</div>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
