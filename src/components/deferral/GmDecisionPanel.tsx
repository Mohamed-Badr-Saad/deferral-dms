"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/src/lib/api";
import { toast } from "sonner";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";

export function GmDecisionPanel(props: {
  deferralId: string;
  initialTA: boolean;
  initialAdHoc: boolean;

  // from approvals timeline
  gmApprovalStatus: ApprovalStatus | null;
  gmApprovalIsActive: boolean;

  // derived in parent typically: profile.role === RELIABILITY_GM
  canEdit: boolean;

  // call parent reload (re-fetch approvals + deferral)
  onSaved?: () => Promise<void>;
}) {
  const [ta, setTa] = useState(Boolean(props.initialTA));
  const [adHoc, setAdHoc] = useState(Boolean(props.initialAdHoc));
  const [busy, setBusy] = useState(false);

  const isLocked = useMemo(() => {
    // If GM approval doesn't exist, treat as locked (safer)
    if (!props.gmApprovalStatus) return true;

    // lock after GM acts (status changes from PENDING)
    if (props.gmApprovalStatus !== "PENDING") return true;

    // OPTIONAL: only allow editing when GM step is active (recommended)
    if (!props.gmApprovalIsActive) return true;

    return false;
  }, [props.gmApprovalStatus, props.gmApprovalIsActive]);

  const disabled = !props.canEdit || busy || isLocked;

  async function save() {
    if (disabled) {
      if (isLocked) {
        toast("Decision locked", {
          description:
            "You can only set TA/AD HOC while the Reliability GM approval step is active and still pending.",
        });
      }
      return;
    }

    setBusy(true);
    try {
      await api(`/api/deferrals/${props.deferralId}/gm-decision`, {
        method: "POST",
        json: { requiresTechnicalAuthority: ta, requiresAdHoc: adHoc },
      });

      toast("Saved", { description: "Reliability GM decision updated." });

      if (props.onSaved) await props.onSaved();
    } catch (e: any) {
      toast("Error", { description: e.message ?? "Failed to save" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Reliability GM Decision</CardTitle>

        {isLocked ? (
          <Badge variant="secondary">Locked</Badge>
        ) : (
          <Badge className="bg-emerald-100 text-emerald-900">Editable</Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3 text-xs text-muted-foreground">
          {isLocked ? (
            <div>
              Decision is locked. You can set TA / AD HOC only while the
              Reliability GM approval step is <b>active</b> and <b>pending</b>.
            </div>
          ) : (
            <div>
              Choose whether this deferral requires Technical Authority and/or
              AD HOC signatures. This must be decided before proceeding to the
              next approvals.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-1">
            <Label className="text-sm font-medium">
              Requires Technical Authority
            </Label>
            <div className="text-xs text-muted-foreground">
              If enabled, the deferral will be routed to Technical Authority for
              signature.
            </div>
          </div>
          <Switch
            checked={ta}
            onCheckedChange={setTa}
            disabled={disabled}
            className={`${disabled ? "opacity-50 cursor-not-allowed" : ""} ${ta ? "bg-blue-600" : ""}`}
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Requires AD HOC</Label>
            <div className="text-xs text-muted-foreground">
              If enabled, the deferral will be routed to AD HOC for signature.
            </div>
          </div>
          <Switch
            checked={adHoc}
            onCheckedChange={setAdHoc}
            disabled={disabled}
            className={`${disabled ? "opacity-50 cursor-not-allowed" : ""} ${adHoc ? "bg-blue-600" : ""}`}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={disabled}>
            {busy ? "Saving..." : "Save Decision"}
          </Button>

          {isLocked ? (
            <div className="text-xs text-muted-foreground">
              Locked after GM step becomes non-pending (or before step is
              active).
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Save updates the workflow timeline.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
