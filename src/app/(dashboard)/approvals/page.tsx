"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/src/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

import { StatusPill } from "@/src/components/deferral/StatusPill";
import { USER_ROLE_LABELS } from "@/src/lib/constants";
import { toast } from "sonner";

import { useRouter } from "next/navigation";

import { ApprovalRow, Profile, ApiRes } from "./components/types";
import { ApprovalCard } from "./components/ApprovalCard";
import { formatStepRole } from "@/src/lib/helper";

function roleLabel(role: string) {
  return (USER_ROLE_LABELS as any)[role] ?? role;
}

function isMitigationApproval(row: ApprovalRow, profile: Profile | null) {
  if (row.approval.stepRole !== "DEPARTMENT_HEAD") return false;
  if (!profile) return false;
  const target = (row.approval.targetDepartment ?? "").trim().toLowerCase();
  const initiatorDept = (row.deferral.initiatorDepartment ?? "")
    .trim()
    .toLowerCase();
  // If the approval target department is DIFFERENT from the initiator's department,
  // this DH is here because of a mitigation — not as the initiator's own DH
  return target !== "" && target !== initiatorDept;
}

export default function ApprovalsPage() {
  const [data, setData] = useState<ApiRes | null>(null);
  const [loading, setLoading] = useState(true);
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
      toast("Error", { description: e.message ?? "Failed to load approvals" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pending = useMemo(() => data?.pending ?? [], [data]);
  const history = useMemo(() => data?.history ?? [], [data]);

  // Split pending into department approvals and mitigation approvals
  const deptPending = useMemo(
    () => pending.filter((row) => !isMitigationApproval(row, profile)),
    [pending, profile],
  );

  const mitigationPending = useMemo(
    () => pending.filter((row) => isMitigationApproval(row, profile)),
    [pending, profile],
  );

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
        toast("Signature missing", { description: res.warning });
      } else {
        toast("Approved", { description: "Approval recorded successfully." });
      }

      setComment((c) => ({ ...c, [approvalId]: "" }));
      await load();
    } catch (e: any) {
      toast("Error", { description: e.message ?? "Approve failed" });
    } finally {
      setBusyId(null);
    }
  }

  async function returnForRevision(approvalId: string) {
    const c = (comment[approvalId] ?? "").trim();
    if (c.length < 2) {
      toast("Validation error", {
        description: "Comment is required to return the deferral.",
      });
      return;
    }

    setBusyId(approvalId);
    try {
      await api<{ ok: boolean }>(`/api/approvals/${approvalId}/return`, {
        method: "POST",
        json: { comment: c },
      });

      toast("Returned", {
        description: "Deferral returned to the initiator for revision.",
      });

      setComment((x) => ({ ...x, [approvalId]: "" }));
      await load();
    } catch (e: any) {
      toast("Error", { description: e.message ?? "Return failed" });
    } finally {
      setBusyId(null);
    }
  }

  async function rejectCompletely(approvalId: string) {
    const c = (comment[approvalId] ?? "").trim();
    if (c.length < 2) {
      toast("Validation error", {
        description: "Comment is required to reject the deferral completely.",
      });
      return;
    }

    setBusyId(approvalId);
    try {
      await api<{ ok: boolean }>(`/api/approvals/${approvalId}/reject`, {
        method: "POST",
        json: { comment: c },
      });

      toast("Rejected", {
        description: "Deferral rejected completely and cannot be resubmitted.",
      });

      setComment((x) => ({ ...x, [approvalId]: "" }));
      await load();
    } catch (e: any) {
      toast("Error", { description: e.message ?? "Reject failed" });
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

      <Tabs
        defaultValue={mitigationPending.length > 0 ? "mitigation" : "pending"}
      >
        <TabsList>
          <TabsTrigger value="pending">
            Department ({deptPending.length})
          </TabsTrigger>
          <TabsTrigger value="mitigation" className="relative">
            Mitigation ({mitigationPending.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            Approved by me ({history.length})
          </TabsTrigger>
        </TabsList>

        {/* DEPARTMENT APPROVALS */}
        <TabsContent value="pending" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Loading...
              </CardContent>
            </Card>
          ) : deptPending.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No pending department approvals.
              </CardContent>
            </Card>
          ) : (
            deptPending.map((row) => (
              <ApprovalCard
                key={row.approval.id}
                row={row}
                isMitigation={false}
                comment={comment[row.approval.id] ?? ""}
                busyId={busyId}
                profile={profile}
                parallelCounts={data?.parallelCounts?.[row.deferral.id]}
                onCommentChange={(id, val) =>
                  setComment((c) => ({ ...c, [id]: val }))
                }
                onApprove={approve}
                onReturn={returnForRevision}
                onReject={rejectCompletely}
                onSaved={async () => {
                  await load();
                  router.refresh();
                }}
              />
            ))
          )}
        </TabsContent>

        {/* MITIGATION APPROVALS */}
        <TabsContent value="mitigation" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Loading...
              </CardContent>
            </Card>
          ) : mitigationPending.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No pending mitigation approvals.
              </CardContent>
            </Card>
          ) : (
            <>
              {mitigationPending.map((row) => (
                <ApprovalCard
                  key={row.approval.id}
                  row={row}
                  isMitigation={true}
                  comment={comment[row.approval.id] ?? ""}
                  busyId={busyId}
                  profile={profile}
                  parallelCounts={data?.parallelCounts?.[row.deferral.id]}
                  onCommentChange={(id, val) =>
                    setComment((c) => ({ ...c, [id]: val }))
                  }
                  onApprove={approve}
                  onReturn={returnForRevision}
                  onReject={rejectCompletely}
                  onSaved={async () => {
                    await load();
                    router.refresh();
                  }}
                />
              ))}
            </>
          )}
        </TabsContent>

        {/* HISTORY */}
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
                          {roleLabel(formatStepRole(row.approval.stepRole))}
                        </span>
                      </span>
                      <span>
                        Dept:{" "}
                        <span className="font-medium">
                          {row.approval.targetDepartment ||
                            row.deferral.initiatorDepartment}
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
