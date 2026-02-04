"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/src/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusPill } from "@/src/components/deferral/StatusPill";
import { ApprovalTimeline } from "@/src/components/deferral/ApprovalTimeline";
import { toast } from "sonner";
import { SubmitDeferralDialog } from "@/src/components/deferral/SubmitDeferralDialog";
import {
  GmDecisionPanel,
  type ApprovalStatus,
} from "@/src/components/deferral/GmDecisionPanel";

type Deferral = {
  id: string;
  deferralCode: string;
  status: string;
  initiatorUserId: string;
  initiatorDepartment: string;
  equipmentTag: string;
  equipmentDescription: string;
  taskCriticality: string;
  safetyCriticality: string;
  lafdStartDate: string | null;
  lafdEndDate: string | null;
  description: string;
  justification: string;
  consequence: string;
  riskCategory: string;
  severity: number;
  likelihood: string;
  ramCell: string;
  ramConsequenceLevel: string;
  mitigations: string;
  requiresTechnicalAuthority: boolean;
  requiresAdHoc: boolean;
  updatedAt: string;
};

type Profile = { id: string; role: string; name: string };

type ApprovalRow = {
  id: string;
  deferralId: string;
  stepOrder: number;
  stepRole: string;
  status: ApprovalStatus;
  isActive: boolean;
  comment: string;
  signedAt: string | null;
};

export default function DeferralDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [item, setItem] = useState<Deferral | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const deferralId = params?.id;

  const canEditDraft = useMemo(() => {
    if (!item || !profile) return false;
    return item.status === "DRAFT" && item.initiatorUserId === profile.id;
  }, [item, profile]);

  const gmApproval = useMemo(() => {
    return approvals.find((a) => a.stepRole === "RELIABILITY_GM") ?? null;
  }, [approvals]);

  const gmApprovalStatus = gmApproval?.status ?? null;
  const gmApprovalIsActive = Boolean(gmApproval?.isActive);

  async function load() {
    if (!deferralId) return;
    setLoading(true);
    try {
      const p = await api<{ profile: Profile }>("/api/profile");
      setProfile(p.profile);

      const d = await api<{ item: Deferral }>(`/api/deferrals/${deferralId}`);
      setItem(d.item);

      // approvals only relevant when not draft
      if (d.item.status !== "DRAFT") {
        // Expected response shape: { approvals: ApprovalRow[] }
        const a = await api<{ approvals: ApprovalRow[] }>(
          `/api/deferrals/${deferralId}/approvals`,
        );
        setApprovals(a.approvals ?? []);
      } else {
        setApprovals([]);
      }
    } catch (e: any) {
      toast("Error", {
        description: e.message ?? "Failed to load",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferralId]);

  async function submitDraft() {
    if (!item) return;
    setBusy(true);
    try {
      const workOrderNo = prompt("Enter Work Order Number (required):") ?? "";
      if (!workOrderNo.trim()) {
        toast("Validation error", {
          description: "Work Order Number is required",
        });
        return;
      }
      const workOrderTitle = prompt("Work Order Title (optional):") ?? "";

      await api(`/api/deferrals/${item.id}/submit`, {
        method: "POST",
        json: {
          workOrderNo: workOrderNo.trim(),
          workOrderTitle: workOrderTitle.trim(),
        },
      });

      toast("Submitted", {
        description: "Deferral submitted into the workflow.",
      });
      await load();
      router.refresh();
    } catch (e: any) {
      toast("Server error", {
        description: e.message ?? "Submit failed",
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    );
  }

  if (!item) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Not found.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold truncate">
            {item.deferralCode}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusPill status={item.status} />
            <span>
              Department:{" "}
              <span className="font-medium">{item.initiatorDepartment}</span>
            </span>
            <span>
              Last update:{" "}
              <span className="font-medium">
                {new Date(item.updatedAt).toLocaleString()}
              </span>
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {canEditDraft && (
            <Button asChild variant="secondary">
              <Link href={`/deferrals/${item.id}?edit=1`}>Edit</Link>
            </Button>
          )}

          {canEditDraft && (
            <SubmitDeferralDialog
              disabled={busy}
              onSubmit={async ({ workOrderNo, workOrderTitle }) => {
                await api(`/api/deferrals/${item.id}/submit`, {
                  method: "POST",
                  json: { workOrderNo, workOrderTitle },
                });
                toast("Submitted", {
                  description: "Deferral submitted into the workflow.",
                });
                await load();
                router.refresh();
              }}
            />
          )}
        </div>
      </div>

      {/* Form summary */}
      <Card>
        <CardHeader>
          <CardTitle>Deferral Details</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Equipment Tag</div>
              <div className="font-medium">{item.equipmentTag || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                Equipment Description
              </div>
              <div className="font-medium">
                {item.equipmentDescription || "—"}
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">
                Task Criticality
              </div>
              <div className="font-medium">{item.taskCriticality || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                Safety Criticality
              </div>
              <div className="font-medium">{item.safetyCriticality || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">LAFD</div>
              <div className="font-medium">
                {item.lafdStartDate
                  ? new Date(item.lafdStartDate).toLocaleDateString()
                  : "—"}{" "}
                →{" "}
                {item.lafdEndDate
                  ? new Date(item.lafdEndDate).toLocaleDateString()
                  : "—"}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground">Description</div>
              <div className="whitespace-pre-wrap">
                {item.description || "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Justification</div>
              <div className="whitespace-pre-wrap">
                {item.justification || "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Consequence</div>
              <div className="whitespace-pre-wrap">
                {item.consequence || "—"}
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">Risk Category</div>
              <div className="font-medium">{item.riskCategory || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Severity</div>
              <div className="font-medium">{item.severity ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Likelihood</div>
              <div className="font-medium">{item.likelihood || "—"}</div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <div className="text-xs text-muted-foreground">RAM Cell</div>
                <div className="font-medium">{item.ramCell || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Consequence Level
                </div>
                <div className="font-medium">
                  {item.ramConsequenceLevel || "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Requires</div>
                <div className="font-medium">
                  {item.requiresTechnicalAuthority ? "TA " : ""}
                  {item.requiresAdHoc ? "AD HOC" : ""}
                  {!item.requiresTechnicalAuthority && !item.requiresAdHoc
                    ? "None"
                    : ""}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Mitigations</div>
            <div className="whitespace-pre-wrap">{item.mitigations || "—"}</div>
          </div>
        </CardContent>
      </Card>

      {/* GM Decision Panel (locked based on GM approval status/isActive) */}
      {profile?.role === "RELIABILITY_GM" && item.status !== "DRAFT" && (
        <GmDecisionPanel
          deferralId={item.id}
          initialTA={Boolean(item.requiresTechnicalAuthority)}
          initialAdHoc={Boolean(item.requiresAdHoc)}
          gmApprovalStatus={gmApprovalStatus}
          gmApprovalIsActive={gmApprovalIsActive}
          canEdit={true}
          onSaved={async () => {
            await load();
            router.refresh();
          }}
        />
      )}

      {/* Approval Timeline */}
      {item.status !== "DRAFT" && <ApprovalTimeline deferralId={item.id} />}
    </div>
  );
}
