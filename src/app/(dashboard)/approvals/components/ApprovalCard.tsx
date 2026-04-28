import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { ApprovalRow, Profile, ApiRes } from "./types";
import { Badge } from "@/components/ui/badge";
import { USER_ROLE_LABELS } from "@/src/lib/constants";
import { StatusPill } from "@/src/components/deferral/StatusPill";
import {
  GmDecisionPanel,
  type ApprovalStatus,
} from "@/src/components/deferral/GmDecisionPanel";
import { formatStepRole } from "@/src/lib/helper";

export function ApprovalCard({
  row,
  isMitigation = false,
  comment,
  busyId,
  profile,
  parallelCounts,
  onCommentChange,
  onApprove,
  onRefuse,
  onSaved,
}: {
  row: ApprovalRow;
  isMitigation?: boolean;
  comment: string;
  busyId: string | null;
  profile: Profile | null;
  parallelCounts?: { total: number; approved: number; pending: number };
  onCommentChange: (id: string, value: string) => void;
  onApprove: (id: string) => void;
  onRefuse: (id: string) => void;
  onSaved: () => Promise<void>;
}) {
  const p = parallelCounts;

  return (
    <Card className={isMitigation ? "border-amber-300/60" : undefined}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="truncate">
              {row.deferral.deferralCode}
            </CardTitle>
            {isMitigation && (
              <Badge
                variant="outline"
                className="text-amber-600 border-amber-400"
              >
                Mitigation Approval
              </Badge>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              Role:{" "}
              <span className="font-medium">
                {formatStepRole(row.approval.stepRole)}
              </span>
            </span>
            {isMitigation && row.approval.targetDepartment && (
              <span>
                Dept:{" "}
                <span className="font-medium text-amber-600">
                  {row.approval.targetDepartment}
                </span>
              </span>
            )}
            {!isMitigation && (
              <span>
                Dept:{" "}
                <span className="font-medium">
                  {row.deferral.initiatorDepartment}
                </span>
              </span>
            )}
            <StatusPill status={row.deferral.status} />
            <span>
              Updated:{" "}
              <span className="font-medium">
                {new Date(row.deferral.updatedAt).toLocaleString()}
              </span>
            </span>
          </div>

          {isMitigation && (
            <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
              ⚠ Your attention is required as a mitigation department head for{" "}
              <strong>{row.approval.targetDepartment}</strong>. Please review
              the deferral and approve or reject the associated mitigation.
            </div>
          )}

          {p && (
            <div className="mt-2 text-xs text-muted-foreground">
              Parallel segment progress:{" "}
              <span className="font-medium">
                {p.approved}/{p.total}
              </span>{" "}
              completed
            </div>
          )}
        </div>

        <Button asChild variant="secondary">
          <Link href={`/deferrals/${row.deferral.id}`}>Open</Link>
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {profile?.role === "RELIABILITY_GM" &&
          row.approval.stepRole === "RELIABILITY_GM" && (
            <GmDecisionPanel
              deferralId={row.deferral.id}
              initialTA={Boolean(
                (row.deferral as any).requiresTechnicalAuthority,
              )}
              initialAdHoc={Boolean((row.deferral as any).requiresAdHoc)}
              gmApprovalStatus={row.approval.status as any}
              gmApprovalIsActive={Boolean(row.approval.isActive)}
              canEdit={true}
              onSaved={onSaved}
            />
          )}

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Comment (optional for approve, required for reject)
          </div>
          <Textarea
            value={comment}
            onChange={(e) => onCommentChange(row.approval.id, e.target.value)}
            placeholder="Add comment..."
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => onApprove(row.approval.id)}
            disabled={busyId === row.approval.id}
          >
            {busyId === row.approval.id ? "Working..." : "Approve"}
          </Button>

          <Button
            variant="destructive"
            onClick={() => onRefuse(row.approval.id)}
            disabled={busyId === row.approval.id}
          >
            {busyId === row.approval.id ? "Working..." : "Reject & Return"}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          Rejecting will mark the deferral as{" "}
          <span className="font-medium">REJECTED</span> and return it to the
          Reliability Engineer and the initiator.
        </div>
      </CardContent>
    </Card>
  );
}
