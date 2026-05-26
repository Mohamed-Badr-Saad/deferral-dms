"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DeferralFormSections from "./deferral-form-sections";
import DeferralActionDialogs from "./deferral-action-dialogs";
import ApprovalTimeline from "./approval-timeline";
import { DeferralDetail, MeResponse, MitigationRow } from "./types";

function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function DeferralDetailClient({ id }: { id: string }) {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<MeResponse["user"] | null>(null);
  const [deferral, setDeferral] = useState<DeferralDetail | null>(null);

  const [mitigationRows, setMitigationRows] = useState<MitigationRow[]>([
    { mitigationText: "", requiredDepartment: "" },
  ]);

  const [form, setForm] = useState({
    workOrderNo: "",
    workOrderTitle: "",
    equipmentTag: "",
    equipmentDescription: "",
    taskCriticality: "",
    safetyCriticality: "",
    originalLafd: "",
    lafdStartDate: "",
    lafdEndDate: "",
    description: "",
    justification: "",
    consequence: "",
  });

  const [deleteReason, setDeleteReason] = useState("");
  const [showSoftDeleteDialog, setShowSoftDeleteDialog] = useState(false);
  const [showHardDeleteDialog, setShowHardDeleteDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<null | {
    duplicateRank: number;
    message: string;
  }>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [deferralRes, meRes] = await Promise.all([
        fetch(`/api/deferrals/${id}`, { cache: "no-store" }),
        fetch(`/api/me`, { cache: "no-store" }),
      ]);

      const deferralData = await deferralRes.json().catch(() => ({}));
      const meData = await meRes.json().catch(() => ({}));

      if (!deferralRes.ok) {
        throw new Error(deferralData?.message ?? "Failed to load deferral");
      }
      if (!meRes.ok) {
        throw new Error(meData?.message ?? "Failed to load current user");
      }

      setDeferral(deferralData);
      setMe(meData.user ?? null);

      setForm({
        workOrderNo: deferralData.workOrderNo ?? "",
        workOrderTitle: deferralData.workOrderTitle ?? "",
        equipmentTag: deferralData.equipmentTag ?? "",
        equipmentDescription: deferralData.equipmentDescription ?? "",
        taskCriticality: deferralData.taskCriticality ?? "",
        safetyCriticality: deferralData.safetyCriticality ?? "",
        originalLafd: toDateInput(deferralData.originalLafd),
        lafdStartDate: toDateInput(deferralData.lafdStartDate),
        lafdEndDate: toDateInput(deferralData.lafdEndDate),
        description: deferralData.description ?? "",
        justification: deferralData.justification ?? "",
        consequence: deferralData.consequence ?? "",
      });

      setMitigationRows(
        Array.isArray(deferralData.mitigationRows) &&
          deferralData.mitigationRows.length > 0
          ? deferralData.mitigationRows.map((m: any) => ({
              id: m.id,
              mitigationText: m.mitigationText ?? "",
              requiredDepartment: m.requiredDepartment ?? "",
            }))
          : [{ mitigationText: "", requiredDepartment: "" }],
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to load page");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const isInitiator = useMemo(
    () => !!(me && deferral && me.id === deferral.initiatorId),
    [me, deferral],
  );

  const canEdit = useMemo(() => {
    if (!isInitiator || !deferral) return false;
    return ["DRAFT", "RETURNED"].includes(deferral.status);
  }, [isInitiator, deferral]);

  const addMitigationRow = () => {
    setMitigationRows((prev) => [
      ...prev,
      { mitigationText: "", requiredDepartment: "" },
    ]);
  };

  const removeMitigationRow = (index: number) => {
    setMitigationRows((prev) => {
      if (prev.length === 1)
        return [{ mitigationText: "", requiredDepartment: "" }];
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateMitigationRow = (
    index: number,
    field: keyof MitigationRow,
    value: string,
  ) => {
    setMitigationRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const buildPayload = () => ({
    ...form,
    mitigations: mitigationRows
      .map((m) => ({
        id: m.id,
        mitigationText: m.mitigationText.trim(),
        requiredDepartment: m.requiredDepartment.trim(),
      }))
      .filter((m) => m.mitigationText && m.requiredDepartment),
  });

  const saveDraft = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/deferrals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? "Failed to save deferral");

      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save deferral");
    } finally {
      setBusy(false);
    }
  };

  const submitDeferral = async (confirmDuplicate = false) => {
    setError(null);
    setBusy(true);
    try {
      const saveRes = await fetch(`/api/deferrals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        throw new Error(saveData?.message ?? "Failed to save before submit");
      }

      const res = await fetch(`/api/deferrals/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmDuplicate }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409 && data?.needsDuplicateConfirmation) {
        setDuplicateWarning({
          duplicateRank: data.duplicateRank,
          message: data.message,
        });
        return;
      }

      if (!res.ok) {
        throw new Error(data?.message ?? "Failed to submit deferral");
      }

      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to submit deferral");
    } finally {
      setBusy(false);
    }
  };

  const closeDeferral = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/deferrals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? "Failed to close deferral");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to close deferral");
    } finally {
      setBusy(false);
      setShowCloseDialog(false);
    }
  };

  const softDeleteDeferral = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/deferrals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "soft_delete", reason: deleteReason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data?.message ?? "Failed to delete deferral");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete deferral");
    } finally {
      setBusy(false);
      setShowSoftDeleteDialog(false);
    }
  };

  const hardDeleteDraft = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/deferrals/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? "Failed to delete draft");
      router.push("/dashboard/deferrals");
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete draft");
    } finally {
      setBusy(false);
      setShowHardDeleteDialog(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!deferral) {
    return (
      <div className="p-6 text-sm text-destructive">Deferral not found.</div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="break-words text-xl">
              {deferral.deferralCode}
            </CardTitle>
            <div className="mt-1 text-sm text-muted-foreground">
              Status: {deferral.status}
              {deferral.workOrderLink?.deferralNumber
                ? ` • Deferral #${deferral.workOrderLink.deferralNumber}`
                : ""}
            </div>
            {deferral.deleteReason && (
              <div className="mt-2 text-sm text-destructive">
                Delete reason: {deferral.deleteReason}
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            {isInitiator &&
              ["APPROVED", "COMPLETED"].includes(deferral.status) && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setShowCloseDialog(true)}
                >
                  Close deferral
                </Button>
              )}

            {isInitiator && deferral.status === "IN_APPROVAL" && (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setShowSoftDeleteDialog(true)}
              >
                Delete with reason
              </Button>
            )}

            {isInitiator && deferral.status === "DRAFT" && (
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => setShowHardDeleteDialog(true)}
              >
                Delete draft permanently
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <DeferralFormSections
            form={form}
            setForm={setForm}
            mitigationRows={mitigationRows}
            canEdit={canEdit}
            onAddMitigation={addMitigationRow}
            onRemoveMitigation={removeMitigationRow}
            onChangeMitigation={updateMitigationRow}
            onSave={saveDraft}
            onSubmit={() => submitDeferral(false)}
            busy={busy}
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Approval timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalTimeline approvals={deferral.approvals ?? []} />
        </CardContent>
      </Card>

      <DeferralActionDialogs
        duplicateWarning={duplicateWarning}
        onCloseDuplicate={() => setDuplicateWarning(null)}
        onConfirmDuplicate={() => submitDeferral(true)}
        showCloseDialog={showCloseDialog}
        onOpenCloseChange={setShowCloseDialog}
        onConfirmClose={closeDeferral}
        showSoftDeleteDialog={showSoftDeleteDialog}
        onOpenSoftDeleteChange={setShowSoftDeleteDialog}
        deleteReason={deleteReason}
        setDeleteReason={setDeleteReason}
        onConfirmSoftDelete={softDeleteDeferral}
        showHardDeleteDialog={showHardDeleteDialog}
        onOpenHardDeleteChange={setShowHardDeleteDialog}
        onConfirmHardDelete={hardDeleteDraft}
      />
    </div>
  );
}
