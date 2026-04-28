"use client";

import { Badge } from "@/components/ui/badge";
import { ApprovalRow } from "./types";

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function ApprovalTimeline({
  approvals,
}: {
  approvals: ApprovalRow[];
}) {
  if (!approvals?.length) {
    return (
      <div className="text-sm text-muted-foreground">No approvals yet.</div>
    );
  }

  return (
    <div className="space-y-3">
      {approvals.map((approval) => (
        <div key={approval.id} className="rounded-xl border p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">
                {approval.sequenceNo}.{" "}
                {approval.approver?.name ??
                  approval.approver?.email ??
                  "Unknown approver"}
              </div>
              <div className="text-sm text-muted-foreground">
                {approval.approver?.role ?? "—"}
                {approval.approver?.department
                  ? ` • ${approval.approver.department}`
                  : ""}
              </div>
            </div>

            <Badge variant="outline">{approval.decision}</Badge>
          </div>

          <div className="text-sm text-muted-foreground">
            Acted at: {fmtDateTime(approval.actedAt)}
          </div>

          {approval.comment && (
            <div className="text-sm">
              <span className="font-medium">Comment:</span> {approval.comment}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
