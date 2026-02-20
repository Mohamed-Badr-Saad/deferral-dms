"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/src/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill } from "@/src/components/deferral/StatusPill";
import { USER_ROLE_LABELS } from "@/src/lib/constants";
import { toast } from "sonner";
import {
  GmDecisionPanel,
  type ApprovalStatus,
} from "@/src/components/deferral/GmDecisionPanel";
import { useRouter } from "next/navigation";

type Deferral = {
  id: string;
  deferralCode: string;
  status: string;
  workOrderNo: string;
  workOrderTitle: string;
  initiatorUserId: string;
  initiatorDepartment: string;

  equipmentTag: string;
  equipmentDescription: string;

  taskCriticality: string; // YES/NO
  safetyCriticality: string; // YES/NO

  lafdStartDate: string | null;
  lafdEndDate: string | null;

  description: string;
  justification: string;
  consequence: string;

  mitigations: string;

  // legacy single RAM fields (still in deferrals table)
  riskCategory: string;
  severity: number;
  likelihood: string;
  ramCell: string;
  ramConsequenceLevel: string;

  requiresTechnicalAuthority: boolean;
  requiresAdHoc: boolean;

  updatedAt: string;
  createdAt?: string;

  returnedAt?: string;
  returnedByRole?: string;
  returnedComment?: string;
};

type ApprovalRow = {
  approval: {
    id: string;
    deferralId: string;
    stepRole: string;
    stepOrder: number;
    status: "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";
    isActive: boolean;
    comment: string;
    signedAt: string | null;
  };
  deferral: {
    id: string;
    deferralCode: string;
    initiatorDepartment: string;
    status: string;
    updatedAt: string;
  };
};
type Profile = {
  id: string;
  role: string;
  name: string;
  department: string;
  position: string;
};

type ApiRes = {
  ok: boolean;
  pending: ApprovalRow[];
  history: ApprovalRow[];
  parallelCounts: Record<
    string,
    { total: number; approved: number; pending: number }
  >;
};

function roleLabel(role: string) {
  return (USER_ROLE_LABELS as any)[role] ?? role;
}

export default function ApprovalsPage() {
  const [data, setData] = useState<ApiRes | null>(null);
  const [loading, setLoading] = useState(true);

  // per-approval comment editing
  const [comment, setComment] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const router = useRouter();
  async function load() {
    setLoading(true);
    try {
      const p = await api<{ profile: Profile }>("/api/profile");
      setProfile(p.profile);
      const res = await api<ApiRes>("/api/approvals/my");
      setData(res);
    } catch (e: any) {
      toast("Error", {
        description: e.message ?? "Failed to load approvals",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = useMemo(() => data?.pending ?? [], [data]);
  const history = useMemo(() => data?.history ?? [], [data]);

  async function approve(approvalId: string) {
    setBusyId(approvalId);
    try {
      const res = await api<{ ok: boolean; warning?: string | null }>(
        `/api/approvals/${approvalId}/approve`,
        {
          method: "POST",
          json: { comment: (comment[approvalId] ?? "").trim() },
        },
      );

      if (res.warning) {
        toast("Signature missing", {
          description: res.warning,
        });
      } else {
        toast("Approved", {
          description: "Approval recorded successfully.",
        });
      }

      setComment((c) => ({ ...c, [approvalId]: "" }));
      await load();
    } catch (e: any) {
      toast("Error", {
        description: e.message ?? "Approve failed",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function refuse(approvalId: string) {
    const c = (comment[approvalId] ?? "").trim();
    if (c.length < 2) {
      toast("Validation error", {
        description: "Comment is required to refuse.",
      });
      return;
    }

    setBusyId(approvalId);
    try {
      await api<{ ok: boolean }>(`/api/approvals/${approvalId}/return`, {
        method: "POST",
        json: { comment: c, route: "TO_RELIABILITY_ENGINEER" },
      });

      toast("Rejected", {
        description:
          "Deferral rejected and returned to Reliability Engineer + Initiator.",
      });

      setComment((x) => ({ ...x, [approvalId]: "" }));
      await load();
    } catch (e: any) {
      toast("Error", {
        description: e.message ?? "Reject failed",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Approve, reject, and track your workflow tasks.
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">
            Approved by me ({history.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Loading...
              </CardContent>
            </Card>
          ) : pending.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No pending approvals.
              </CardContent>
            </Card>
          ) : (
            pending.map((row) => {
              const p = data?.parallelCounts?.[row.deferral.id];

              return (
                <Card key={row.approval.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle className="truncate">
                        {row.deferral.deferralCode}
                      </CardTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>
                          Step:{" "}
                          <span className="font-medium">
                            {roleLabel(row.approval.stepRole)}
                          </span>
                        </span>
                        <span>
                          Dept:{" "}
                          <span className="font-medium">
                            {row.deferral.initiatorDepartment}
                          </span>
                        </span>
                        <StatusPill status={row.deferral.status} />
                        <span>
                          Updated:{" "}
                          <span className="font-medium">
                            {new Date(row.deferral.updatedAt).toLocaleString()}
                          </span>
                        </span>
                      </div>

                      {p ? (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Parallel segment progress:{" "}
                          <span className="font-medium">
                            {p.approved}/{p.total}
                          </span>{" "}
                          completed
                        </div>
                      ) : null}
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
                          initialAdHoc={Boolean(
                            (row.deferral as any).requiresAdHoc,
                          )}
                          gmApprovalStatus={row.approval.status as any}
                          gmApprovalIsActive={Boolean(row.approval.isActive)}
                          canEdit={true}
                          onSaved={async () => {
                            await load();
                            router.refresh();
                          }}
                        />
                      )}
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        Comment (optional for approve, required for reject)
                      </div>
                      <Textarea
                        value={comment[row.approval.id] ?? ""}
                        onChange={(e) =>
                          setComment((c) => ({
                            ...c,
                            [row.approval.id]: e.target.value,
                          }))
                        }
                        placeholder="Add comment..."
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => approve(row.approval.id)}
                        disabled={busyId === row.approval.id}
                      >
                        {busyId === row.approval.id ? "Working..." : "Approve"}
                      </Button>

                      <Button
                        variant="destructive"
                        onClick={() => refuse(row.approval.id)}
                        disabled={busyId === row.approval.id}
                      >
                        {busyId === row.approval.id
                          ? "Working..."
                          : "Reject & Return"}
                      </Button>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Rejecting will mark the deferral as{" "}
                      <span className="font-medium">REJECTED</span> and return
                      it to the Reliability Engineer and the initiator.
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Loading...
              </CardContent>
            </Card>
          ) : history.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No approvals recorded yet.
              </CardContent>
            </Card>
          ) : (
            history.map((row) => (
              <Card key={row.approval.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>{row.deferral.deferralCode}</CardTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        Approved as:{" "}
                        <span className="font-medium">
                          {roleLabel(row.approval.stepRole)}
                        </span>
                      </span>
                      <span>
                        Dept:{" "}
                        <span className="font-medium">
                          {row.deferral.initiatorDepartment}
                        </span>
                      </span>
                      <StatusPill status={row.deferral.status} />
                      <span>
                        Signed at:{" "}
                        <span className="font-medium">
                          {row.approval.signedAt
                            ? new Date(row.approval.signedAt).toLocaleString()
                            : "—"}
                        </span>
                      </span>
                    </div>
                  </div>

                  <Button asChild variant="secondary">
                    <Link href={`/deferrals/${row.deferral.id}`}>Open</Link>
                  </Button>
                </CardHeader>

                <CardContent>
                  {row.approval.comment ? (
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {row.approval.comment}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No comment.
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
