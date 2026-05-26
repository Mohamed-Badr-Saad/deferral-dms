"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/src/lib/api";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { toast } from "sonner";
import { StatusPill } from "@/src/components/deferral/StatusPill";
import { ApprovalTimeline } from "@/src/components/deferral/ApprovalTimeline";
import { SubmitDeferralDialog } from "@/src/components/deferral/SubmitDeferralDialog";
import { GmDecisionPanel } from "@/src/components/deferral/GmDecisionPanel";
import { UploadCloud, Save } from "lucide-react";
import { WorkOrderHistoryTab } from "@/src/components/deferral/WorkOrderHistoryTab";
import { addDaysIso, formatStepRole } from "@/src/lib/helper";
import {
  Deferral,
  Profile,
  ApprovalRow,
  RiskRow,
  Attachment,
  DuplicateDialogState,
} from "./components/types";
import { DEPARTMENTS } from "@/src/lib/constants";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EQUIPMENT_FULL_CODE_RE = /^([^/]+\/){4}[^/]+$/;

const SEVERITY_OPTIONS = [
  { v: 1, label: "1 - Slight" },
  { v: 2, label: "2 - Minor" },
  { v: 3, label: "3 - Moderate" },
  { v: 4, label: "4 - Major" },
  { v: 5, label: "5 - Massive" },
];

const LIKELIHOOD_OPTIONS = [
  { v: "A", label: "A - Never heard of in industry" },
  { v: "B", label: "B - Heard of in industry" },
  {
    v: "C",
    label: "C - Happened in the organisation OR >1/year in the industry",
  },
  {
    v: "D",
    label: "D - Happened at the location OR >1/year in the organisation",
  },
  { v: "E", label: "E - >1/year at the location" },
];

type ViewTab =
  | "details"
  | "approvals"
  | "history"
  | "deferralHistory"
  | "print";

const VIEW_TABS = new Set<string>([
  "details",
  "approvals",
  "history",
  "deferralHistory",
  "print",
]);

type EditableMitigationRow = {
  id?: string;
  mitigationText: string;
  requiredDepartment: string;
};

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function toIsoDateInput(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function fromIsoDateInput(v: string) {
  if (!v) return null;
  const d = new Date(v + "T00:00:00.000Z");
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function validateEquipmentCode(v: string) {
  return EQUIPMENT_FULL_CODE_RE.test((v ?? "").trim());
}

function normalizeText(input: string | null | undefined) {
  return String(input ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function canActOnApproval(approval: ApprovalRow, profile: Profile | null) {
  if (!profile) return false;
  if (!approval.isActive || approval.status !== "PENDING") return false;

  if (approval.assignedUserId && approval.assignedUserId === profile.id) {
    return true;
  }

  if (String(profile.role) !== String(approval.stepRole)) return false;

  if (
    approval.targetDepartment &&
    normalizeText(approval.targetDepartment) !== normalizeText(profile.department)
  ) {
    return false;
  }

  if (
    approval.targetGmGroup &&
    String(approval.targetGmGroup) !== String(profile.gmGroup ?? "")
  ) {
    return false;
  }

  return true;
}

function useDebouncedCallback<T extends (...args: any[]) => void>(
  fn: T,
  waitMs: number,
) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (t.current) clearTimeout(t.current);
    t.current = null;
  }, []);

  const flush = useCallback(
    (...args: Parameters<T>) => {
      cancel();
      fn(...args);
    },
    [cancel, fn],
  );

  const call = useCallback(
    (...args: Parameters<T>) => {
      cancel();
      t.current = setTimeout(() => fn(...args), waitMs);
    },
    [cancel, fn, waitMs],
  );

  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  return { call, cancel, flush };
}

export default function DeferralDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const deferralId = params?.id;

  const [item, setItem] = useState<Deferral | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workOrderNo, setWorkOrderNo] = useState("");
  const [workOrderTitle, setWorkOrderTitle] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<null | {
    duplicateRank: number;
    message: string;
    blocked: boolean;
  }>(null);

  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);

  // edit mode
  const initialEdit = (searchParams.get("edit") ?? "") === "1";
  const [editMode, setEditMode] = useState<boolean>(false);

  const canEditDraft = useMemo(() => {
    if (!item || !profile) return false;
    return (
      (item.status === "DRAFT" || item.status === "RETURNED") &&
      item.initiatorUserId === profile.id
    );
  }, [item, profile]);
  const isInitiator = useMemo(() => {
    if (!item || !profile) return false;
    return item.initiatorUserId === profile.id;
  }, [item, profile]);
  useEffect(() => {
    if (editMode && !canEditDraft) {
      setEditMode(false);
      window.history.replaceState(null, "", `/deferrals/${deferralId}`);
    }
  }, [editMode, canEditDraft, deferralId]);

  useEffect(() => {
    if (initialEdit && canEditDraft) setEditMode(true);
  }, [initialEdit, canEditDraft]);
  const [activeTab, setActiveTab] = useState<string>("basic");

  // editable fields (local)
  const [equipmentTag, setEquipmentTag] = useState("");
  const [equipmentDescription, setEquipmentDescription] = useState("");
  const [safetyCriticality, setSafetyCriticality] = useState<"YES" | "NO">(
    "NO",
  );
  const [taskCriticality, setTaskCriticality] = useState<"YES" | "NO">("NO");
  const [originalLafd, setOriginalLafd] = useState<string>("");
  const [lafdCurrent, setLafdCurrent] = useState<string>(""); // yyyy-mm-dd
  const [lafdDeferredTo, setLafdDeferredTo] = useState<string>(""); // yyyy-mm-dd
  const [lafdAddMonths, setLafdAddMonths] = useState<number>(0);

  const [description, setDescription] = useState("");
  const [justification, setJustification] = useState("");
  const [consequence, setConsequence] = useState("");
  const [mitigationRows, setMitigationRows] = useState<EditableMitigationRow[]>(
    [{ mitigationText: "", requiredDepartment: "" }],
  );

  const [duplicateInfo, setDuplicateInfo] =
    useState<DuplicateDialogState>(null);

  const [confirmDuplicate, setConfirmDuplicate] = useState(false);

  const woCheck = useDebouncedCallback(async (workOrderNo: string) => {
    const trimmed = workOrderNo.trim();
    if (!trimmed) {
      setDuplicateInfo(null);
      setConfirmDuplicate(false);
      return;
    }

    try {
      const check = await api<{
        exists: boolean;
        duplicateRank: number;
        existingCount: number;
        needsConfirmation: boolean;
        blocked: boolean;
        message: string;
      }>("/api/deferrals/check-work-order", {
        method: "POST",
        json: {
          workOrderNo,
          deferralId: deferralId ?? item?.id ?? null,
        },
      });

      if (check.blocked || check.needsConfirmation) {
        setDuplicateInfo({
          source: "change",
          duplicateRank: check.duplicateRank,
          existingCount: check.existingCount,
          needsConfirmation: check.needsConfirmation,
          blocked: check.blocked,
          message: check.message,
          workOrderNo: trimmed,
          workOrderTitle,
        });
        return;
      }
      setDuplicateInfo(null);
    } catch (e: any) {
      console.error(e);
    }
  }, 500);

  async function handleWorkOrderBlur(nextWorkOrderNo: string) {
    if (!item?.id) return;

    const res = await fetch("/api/deferrals/check-work-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workOrderNo: nextWorkOrderNo,
        deferralId: item.id,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;

    if (data.blocked || data.needsConfirmation) {
      setDuplicateInfo({
        source: "change",
        duplicateRank: data.duplicateRank,
        existingCount: data.existingCount ?? 0,
        needsConfirmation: Boolean(data.needsConfirmation),
        blocked: Boolean(data.blocked),
        message: data.message ?? "",
        workOrderNo: nextWorkOrderNo,
        workOrderTitle: workOrderTitle ?? "",
      });
    } else {
      setDuplicateInfo(null);
    }
  }

  const [riskRows, setRiskRows] = useState<RiskRow[]>([]);
  const [riskSaving, setRiskSaving] = useState(false);
  const riskRowsRef = useRef<RiskRow[]>([]);
  useEffect(() => {
    riskRowsRef.current = riskRows;
  }, [riskRows]);

  // --- Risk save queue ---
  const pendingRiskRef = useRef(false);

  const saveRisksNow = useCallback(
    async (silent?: boolean) => {
      if (!deferralId) return;

      setRiskSaving(true);
      try {
        const payload = {
          items: (riskRowsRef.current ?? []).map((r) => ({
            category: r.category,
            severity: r.severity,
            likelihood: r.likelihood,
            justification: r.justification ?? "",
          })),
        };

        const res = await api<{ items: RiskRow[] }>(
          `/api/deferrals/${deferralId}/risks`,
          { method: "PUT", json: payload },
        );

        setRiskRows((res.items ?? []) as any);
        pendingRiskRef.current = false;
        if (!silent) toast.success("Risks saved");
      } catch (e: any) {
        if (!silent) toast.error(e?.message ?? "Failed to save risks");
      } finally {
        setRiskSaving(false);
      }
    },
    [deferralId],
  );

  const queueRisksSave = useCallback(() => {
    if (!canEditDraft) return; // ✅ ADD
    pendingRiskRef.current = true;
  }, [canEditDraft]);

  const flushRisksSave = useCallback(async () => {
    if (!pendingRiskRef.current) return;
    await saveRisksNow(true);
  }, [saveRisksNow]);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>("details");

  const [pendingSubmit, setPendingSubmit] = useState<{
    workOrderNo: string;
    workOrderTitle: string;
  } | null>(null);

  const [deferralHistory, setDeferralHistory] = useState<
    {
      cycle: number;
      stepRole: string;
      status: "RETURNED" | "REJECTED";
      comment: string;
      signedAt: string | null;
      signedByNameSnapshot: string;
    }[]
  >([]);
  const [histLoading, setHistLoading] = useState(false);

  const loadDeferralHistory = useCallback(async () => {
    if (!deferralId) return;
    setHistLoading(true);
    try {
      const res = await api<{ items: any[] }>(
        `/api/deferrals/${deferralId}/history`,
      );
      setDeferralHistory(res.items ?? []);
    } finally {
      setHistLoading(false);
    }
  }, [deferralId]);

  useEffect(() => {
    if (!deferralId) return;
    void loadDeferralHistory();
  }, [deferralId, loadDeferralHistory]);

  const gmApproval = useMemo(() => {
    return approvals.find((a) => a.stepRole === "RELIABILITY_GM") ?? null;
  }, [approvals]);

  const gmApprovalStatus = gmApproval?.status ?? null;
  const gmApprovalIsActive = Boolean(gmApproval?.isActive);
  const [approvalComment, setApprovalComment] = useState("");
  const [approvalBusy, setApprovalBusy] = useState<
    "approve" | "return" | "reject" | null
  >(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [recordActionBusy, setRecordActionBusy] = useState<
    "close" | "softDelete" | "hardDelete" | null
  >(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showSoftDeleteDialog, setShowSoftDeleteDialog] = useState(false);
  const [showHardDeleteDialog, setShowHardDeleteDialog] = useState(false);

  const myActiveApproval = useMemo(() => {
    if (!item || !["IN_APPROVAL", "APPROVED"].includes(item.status)) {
      return null;
    }
    return approvals.find((a) => canActOnApproval(a, profile)) ?? null;
  }, [approvals, item, profile]);
  const canCloseDeferral = isInitiator
    ? item?.status === "COMPLETED"
    : false;
  const canSoftDeleteDeferral = isInitiator && item?.status === "IN_APPROVAL";
  const canHardDeleteDraft = isInitiator && item?.status === "DRAFT";

  const hydrateLocalFromItem = useCallback((d: Deferral) => {
    setWorkOrderNo(d.workOrderNo ?? ""); // ✅ ADD
    setWorkOrderTitle(d.workOrderTitle ?? ""); // ✅ ADD

    setEquipmentTag(d.equipmentTag ?? "");
    setEquipmentDescription(d.equipmentDescription ?? "");
    setSafetyCriticality(
      ((d.safetyCriticality || "NO").toUpperCase() as any) ?? "NO",
    );
    setTaskCriticality(
      ((d.taskCriticality || "NO").toUpperCase() as any) ?? "NO",
    );

    setOriginalLafd(toIsoDateInput((d as any).originalLafd ?? d.lafdStartDate));
    setLafdCurrent(toIsoDateInput(d.lafdStartDate));
    setLafdDeferredTo(toIsoDateInput(d.lafdEndDate));
    setLafdAddMonths(0);

    setDescription(d.description ?? "");
    setJustification(d.justification ?? "");
    setConsequence(d.consequence ?? "");
    setMitigationRows(
      Array.isArray(d.mitigationRows) && d.mitigationRows.length > 0
        ? d.mitigationRows.map((m: any) => ({
            id: m.id,
            mitigationText: m.mitigationText ?? m.description ?? "",
            requiredDepartment: m.requiredDepartment ?? "",
          }))
        : [{ mitigationText: "", requiredDepartment: "" }],
    );
  }, []);

  const deferredMin = lafdCurrent ? addDaysIso(lafdCurrent, 1) : undefined;

  const load = useCallback(async () => {
    if (!deferralId) return;
    setLoading(true);
    try {
      const p = await api<{ profile: Profile }>("/api/profile");
      setProfile(p.profile);

      const d = await api<{ item: Deferral }>(`/api/deferrals/${deferralId}`);
      setItem(d.item);
      hydrateLocalFromItem(d.item);

      const a = await api<{ approvals: ApprovalRow[] }>(
        `/api/deferrals/${deferralId}/approvals`,
      );
      setApprovals(a.approvals ?? []);
    } catch (e: any) {
      toast("Error", { description: e.message ?? "Failed to load" });
    } finally {
      setLoading(false);
    }
  }, [deferralId, hydrateLocalFromItem]);

  useEffect(() => {
    void load();
  }, [load]);

  function getMissingFields(d: Deferral | null, risks: RiskRow[]) {
    const missing: string[] = [];
    if (!d) return ["Deferral not loaded"];

    if (!(d.workOrderNo ?? "").trim()) missing.push("Work Order Number");

    const tag = (d.equipmentTag ?? "").trim();
    if (!tag) missing.push("Equipment Full Code");
    else if (!validateEquipmentCode(tag))
      missing.push("Equipment Full Code (format)");

    if (!(d.equipmentDescription ?? "").trim())
      missing.push("Equipment Description");

    if (!d.lafdStartDate) missing.push("Current LAFD");
    if (!d.lafdEndDate) missing.push("Deferred To (New LAFD)");

    if (!(d.description ?? "").trim()) missing.push("Description");
    if (!(d.justification ?? "").trim()) missing.push("Justification");
    if (!(d.consequence ?? "").trim()) missing.push("Consequence");
    if (
      !mitigationRows.some(
        (m) => m.mitigationText.trim() && m.requiredDepartment.trim(),
      )
    ) {
      missing.push("Mitigations");
    }
    if (!Array.isArray(risks) || risks.length === 0)
      missing.push("Associated Risk (RAM)");

    return missing;
  }

  // ---------- PATCH helper + save queue ----------
  const pendingPatchRef = useRef<any>({});

  const patchNow = useCallback(
    async (payload: any, silent?: boolean) => {
      if (!deferralId) return false;
      if (!canEditDraft) return false; // ✅ ADD

      setSaving(true);
      try {
        const res = await api<{ item: Deferral }>(
          `/api/deferrals/${deferralId}`,
          {
            method: "PATCH",
            json: payload,
          },
        );
        setItem(res.item);
        if (!silent) toast.success("Saved");
        return true;
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to save");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [deferralId, canEditDraft],
  );

  const queuePatch = useCallback(
    (partial: any) => {
      if (!canEditDraft) return; // ✅ ADD

      pendingPatchRef.current = { ...pendingPatchRef.current, ...partial };
    },
    [canEditDraft],
  );

  const serializeMitigationRows = useCallback(
    (rows: EditableMitigationRow[]) =>
      rows
        .map((row) => ({
          mitigationText: row.mitigationText.trim(),
          requiredDepartment: row.requiredDepartment.trim(),
        }))
        .filter((row) => row.mitigationText && row.requiredDepartment),
    [],
  );

  const updateMitigationRows = useCallback(
    (
      updater:
        | EditableMitigationRow[]
        | ((prev: EditableMitigationRow[]) => EditableMitigationRow[]),
    ) => {
      setMitigationRows((prev) => {
        const next =
          typeof updater === "function"
            ? updater(prev)
            : updater;

        queuePatch({ mitigations: serializeMitigationRows(next) });
        return next;
      });
    },
    [queuePatch, serializeMitigationRows],
  );

  const flushPatch = useCallback(async () => {
    const payload = pendingPatchRef.current;
    if (Object.keys(payload).length === 0) return;
    const saved = await patchNow(payload, true);
    if (saved) pendingPatchRef.current = {};
  }, [patchNow]);

  // ---------- Risks ----------
  const loadRisks = useCallback(async () => {
    if (!deferralId) return;
    try {
      const res = await api<{ items: RiskRow[] }>(
        `/api/deferrals/${deferralId}/risks`,
      );
      if (res.items?.length) setRiskRows(res.items);
      else {
        // default 4 categories
        setRiskRows([
          {
            category: "PEOPLE",
            severity: 1,
            likelihood: "A",
            ramCell: "1A",
            ramConsequenceLevel: "",
            justification: "",
          },
          {
            category: "ASSET",
            severity: 1,
            likelihood: "A",
            ramCell: "1A",
            ramConsequenceLevel: "",
            justification: "",
          },
          {
            category: "ENVIRONMENT",
            severity: 1,
            likelihood: "A",
            ramCell: "1A",
            ramConsequenceLevel: "",
            justification: "",
          },
          {
            category: "REPUTATION",
            severity: 1,
            likelihood: "A",
            ramCell: "1A",
            ramConsequenceLevel: "",
            justification: "",
          },
        ]);
      }
    } catch {
      // if route not ready yet, still keep UI usable
      setRiskRows([
        {
          category: "PEOPLE",
          severity: 1,
          likelihood: "A",
          ramCell: "1A",
          ramConsequenceLevel: "",
          justification: "",
        },
        {
          category: "ASSET",
          severity: 1,
          likelihood: "A",
          ramCell: "1A",
          ramConsequenceLevel: "",
          justification: "",
        },
        {
          category: "ENVIRONMENT",
          severity: 1,
          likelihood: "A",
          ramCell: "1A",
          ramConsequenceLevel: "",
          justification: "",
        },
        {
          category: "REPUTATION",
          severity: 1,
          likelihood: "A",
          ramCell: "1A",
          ramConsequenceLevel: "",
          justification: "",
        },
      ]);
    }
  }, [deferralId]);

  const saveRisks = useCallback(async () => {
    if (!deferralId) return;
    if (!canEditDraft) return; // ✅ ADD
    setRiskSaving(true);
    try {
      const payload = {
        items: riskRows.map((r) => ({
          category: r.category,
          severity: r.severity,
          likelihood: r.likelihood,
          justification: r.justification ?? "",
        })),
      };
      const res = await api<{ items: RiskRow[] }>(
        `/api/deferrals/${deferralId}/risks`,
        {
          method: "PUT",
          json: payload,
        },
      );
      setRiskRows(res.items ?? []);
      pendingRiskRef.current = false;
      toast.success("Risks saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save risks");
    } finally {
      setRiskSaving(false);
    }
  }, [deferralId, riskRows, canEditDraft]);

  // ---------- Attachments ----------
  const loadAttachments = useCallback(async () => {
    if (!deferralId) return;
    setAttLoading(true);
    try {
      const res = await api<{ items: Attachment[] }>(
        `/api/deferrals/${deferralId}/attachments`,
      );
      setAttachments(res.items ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load attachments");
    } finally {
      setAttLoading(false);
    }
  }, [deferralId]);

  const uploadAttachments = useCallback(
    async (files: FileList | null) => {
      if (!deferralId || !files || files.length === 0) return;
      if (!canEditDraft) return; // ✅ ADD

      const tooBig = Array.from(files).find((f) => f.size > 25 * 1024 * 1024);
      if (tooBig) {
        toast.error("File too large", {
          description: "Max file size is 25MB.",
        });
        return;
      }

      const form = new FormData();
      for (const f of Array.from(files)) form.append("files", f);

      try {
        const res = await fetch(`/api/deferrals/${deferralId}/attachments`, {
          method: "POST",
          body: form,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(json?.message ?? "Upload failed", {
            description: json?.detail ?? "Server error",
          });
          return;
        }
        toast.success("Uploaded");
        await loadAttachments();
      } catch {
        toast.error("Upload failed");
      }
    },
    [deferralId, loadAttachments, canEditDraft],
  );

  // load extra resources
  useEffect(() => {
    if (!deferralId) return;
    void loadAttachments();
    void loadRisks();
  }, [deferralId, loadAttachments, loadRisks]);

  // ---------- Tab change: auto-save before leaving tab ----------
  const onTabChange = useCallback(
    async (next: string) => {
      if (!editMode) {
        setActiveTab(next);
        return;
      }
      if (!canEditDraft) {
        // ✅ ADD
        setActiveTab(next);
        return;
      }
      await flushRisksSave();
      await flushPatch();
      setActiveTab(next);
    },
    [editMode, flushPatch, flushRisksSave, canEditDraft],
  );

  const onViewTabChange = useCallback(
    async (next: string) => {
      if (editMode && canEditDraft) {
        await flushRisksSave();
        await flushPatch();
      }
      if (VIEW_TABS.has(next)) setViewTab(next as ViewTab);
    },
    [editMode, canEditDraft, flushPatch, flushRisksSave],
  );

  // ---------- Dates helpers ----------
  function applyAddMonths(months: number) {
    setLafdAddMonths(months);
    if (!lafdCurrent) return;
    const current = new Date(lafdCurrent + "T00:00:00Z");
    const next = addMonths(current, months);
    const max = addMonths(current, 6);
    if (months > 6 || next.getTime() > max.getTime()) {
      toast.error("Maximum deferred period is 6 months.");
      return;
    }
    setLafdDeferredTo(next.toISOString().slice(0, 10));
    // queue patch
    queuePatch({
      originalLafd: fromIsoDateInput(originalLafd),
      lafdStartDate: fromIsoDateInput(lafdCurrent),
      lafdEndDate: fromIsoDateInput(next.toISOString().slice(0, 10)),
    });
  }

  // ---------- Submit ----------
  const [busy, setBusy] = useState(false);
  async function submitViaDialog(
    wNo: string,
    wTitle: string,
    confirmDuplicate = false,
  ) {
    if (!item) return;

    setBusy(true);
    try {
      await flushRisksSave();
      await flushPatch();

      const res = await fetch(`/api/deferrals/${item.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderNo: wNo,
          workOrderTitle: wTitle,
          confirmDuplicate,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast("Error", {
          description: data?.detail ?? data?.message ?? "Submit failed",
        });
        return;
      }

      // Clear any duplicate dialog state once submit succeeds
      setDuplicateInfo(null);
      setPendingSubmit(null);

      toast("Submitted", {
        description: "Deferral submitted into the workflow.",
      });

      await load();
      router.refresh();
    } catch (e: any) {
      toast("Server error", {
        description: e?.message ?? "Submit failed",
      });
    } finally {
      setBusy(false);
    }
  }

  async function approveCurrentApproval() {
    if (!myActiveApproval) return;

    setApprovalBusy("approve");
    try {
      await api(`/api/approvals/${myActiveApproval.id}/approve`, {
        method: "POST",
        json: { comment: approvalComment.trim() },
      });

      toast.success("Approved");
      setApprovalComment("");
      await load();
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Approve failed");
    } finally {
      setApprovalBusy(null);
    }
  }

  async function returnCurrentApproval() {
    if (!myActiveApproval) return;

    const comment = approvalComment.trim();
    if (comment.length < 3) {
      toast.warning("Comment required", {
        description: "Add a reason before returning this deferral.",
      });
      return;
    }

    setApprovalBusy("return");
    try {
      await api(`/api/approvals/${myActiveApproval.id}/return`, {
        method: "POST",
        json: { comment },
      });

      toast.success("Returned for revision", {
        description: "The deferral was sent back to the initiator.",
      });
      setApprovalComment("");
      await load();
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Return failed");
    } finally {
      setApprovalBusy(null);
    }
  }

  async function rejectCurrentApproval() {
    if (!myActiveApproval) return;

    const comment = approvalComment.trim();
    if (comment.length < 3) {
      toast.warning("Comment required", {
        description: "Add a reason before rejecting this deferral completely.",
      });
      return;
    }

    setApprovalBusy("reject");
    try {
      await api(`/api/approvals/${myActiveApproval.id}/reject`, {
        method: "POST",
        json: { comment },
      });

      toast.success("Deferral rejected", {
        description: "The deferral was rejected completely and cannot be resubmitted.",
      });
      setApprovalComment("");
      await load();
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Reject failed");
    } finally {
      setApprovalBusy(null);
    }
  }

  async function closeDeferral() {
    if (!item) return;

    setRecordActionBusy("close");
    try {
      await api(`/api/deferrals/${item.id}/close`, {
        method: "POST",
      });

      toast.success("Deferral closed");
      setShowCloseDialog(false);
      await load();
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to close deferral");
    } finally {
      setRecordActionBusy(null);
    }
  }

  async function softDeleteDeferral() {
    if (!item) return;

    const reason = deleteReason.trim();
    if (reason.length < 3) {
      toast.warning("Reason required", {
        description: "Add a short reason before deleting the in-approval deferral.",
      });
      return;
    }

    setRecordActionBusy("softDelete");
    try {
      await api(`/api/deferrals/${item.id}/soft-delete`, {
        method: "POST",
        json: { reason },
      });

      toast.success("Deferral marked as deleted");
      setDeleteReason("");
      setShowSoftDeleteDialog(false);
      await load();
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to mark deferral as deleted");
    } finally {
      setRecordActionBusy(null);
    }
  }

  async function hardDeleteDraft() {
    if (!item) return;

    setRecordActionBusy("hardDelete");
    try {
      await api(`/api/deferrals/${item.id}`, {
        method: "DELETE",
      });

      toast.success("Draft deleted");
      router.push("/deferrals");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete draft");
    } finally {
      setRecordActionBusy(null);
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

  const initiatorName = item.initiator?.name || "—";
  const initiatorPosition = item.initiator?.position || "—";
  const initiatorDepartment =
    item.initiator?.department || item.initiatorDepartment || "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold">
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

          {item.deletedReason && (
            <div className="mt-2 text-sm text-destructive">
              Delete reason: {item.deletedReason}
            </div>
          )}

          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <div>
              Initiator Name:{" "}
              <span className="font-medium">{initiatorName}</span>
            </div>
            <div>
              Job Title:{" "}
              <span className="font-medium">{initiatorPosition}</span>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          {canEditDraft && (
            <Button
              variant={editMode ? "secondary" : "default"}
              className="w-full sm:w-auto"
              onClick={async () => {
                if (editMode) {
                  await flushRisksSave();
                  await flushPatch();
                }
                setEditMode((v) => !v);
                const url = editMode
                  ? `/deferrals/${item.id}`
                  : `/deferrals/${item.id}?edit=1`;
                window.history.replaceState(null, "", url);
              }}
            >
              {editMode ? "Stop Editing" : "Edit"}
            </Button>
          )}

          {canCloseDeferral && (
            <Button
              onClick={() => setShowCloseDialog(true)}
              disabled={recordActionBusy !== null}
              className="w-full bg-red-500 hover:bg-red-400 sm:w-auto"
            >
              Close deferral
            </Button>
          )}

          {canSoftDeleteDeferral && (
            <Button
              onClick={() => setShowSoftDeleteDialog(true)}
              disabled={recordActionBusy !== null}
              className="w-full bg-red-500 hover:bg-red-400 sm:w-auto"
            >
              Delete with reason
            </Button>
          )}

          {canHardDeleteDraft && (
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={() => setShowHardDeleteDialog(true)}
              disabled={recordActionBusy !== null}
            >
              Delete draft permanently
            </Button>
          )}

          {canEditDraft && (
            <SubmitDeferralDialog
              disabled={busy}
              initialWorkOrderNo={editMode ? workOrderNo : item.workOrderNo}
              initialWorkOrderTitle={
                editMode ? workOrderTitle : item.workOrderTitle
              }
              validateBeforeOpen={() =>
                getMissingFields(
                  editMode
                    ? {
                        ...item,
                        workOrderNo,
                        workOrderTitle,
                        equipmentTag,
                        equipmentDescription,
                        originalLafd: fromIsoDateInput(originalLafd),
                        lafdStartDate: fromIsoDateInput(lafdCurrent),
                        lafdEndDate: fromIsoDateInput(lafdDeferredTo),
                        description,
                        justification,
                        consequence,
                      }
                    : item,
                  riskRows,
                )
              }
              onValidationFailed={(missing) => {
                toast.warning("Missing required details", {
                  description: missing.join(" • "),
                });
              }}
              onSubmit={async ({ workOrderNo, workOrderTitle }) => {
                const mitigationPayload =
                  serializeMitigationRows(mitigationRows);

                await api(`/api/deferrals/${item.id}`, {
                  method: "PATCH",
                  json: { mitigations: mitigationPayload },
                });

                const checkRes = await fetch(
                  `/api/deferrals/check-work-order`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      workOrderNo,
                      deferralId: item.id,
                    }),
                  },
                );

                const checkData = await checkRes.json().catch(() => ({}));

                if (!checkRes.ok) {
                  throw new Error(
                    checkData?.detail ??
                      checkData?.message ??
                      "Failed to validate work order",
                  );
                }

                if (checkData?.blocked || checkData?.needsConfirmation) {
                  setPendingSubmit({ workOrderNo, workOrderTitle });
                  setDuplicateInfo({
                    source: "submit",
                    duplicateRank: checkData.duplicateRank,
                    existingCount: checkData.existingCount ?? 0,
                    needsConfirmation: Boolean(checkData.needsConfirmation),
                    blocked: Boolean(checkData.blocked),
                    message: checkData.message ?? "",
                    workOrderNo,
                    workOrderTitle,
                  });

                  throw new Error("__duplicate_warning__");
                }

                await submitViaDialog(workOrderNo, workOrderTitle, false);
              }}
            />
          )}

          {!canEditDraft &&
            (item.status === "DRAFT" || item.status === "RETURNED") && (
              <Button asChild variant="secondary">
                <Link href="/deferrals">Back</Link>
              </Button>
            )}
        </div>
      </div>

      {myActiveApproval &&
        profile?.role === "RELIABILITY_GM" &&
        myActiveApproval.stepRole === "RELIABILITY_GM" && (
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

      {myActiveApproval && (
        <Card className="border-amber-300/70">
          <CardHeader>
            <CardTitle className="text-base">Your Approval Action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>
                Role:{" "}
                <span className="font-medium text-foreground">
                  {formatStepRole(myActiveApproval.stepRole)}
                </span>
              </span>
              {myActiveApproval.targetDepartment && (
                <span>
                  Department:{" "}
                  <span className="font-medium text-foreground">
                    {myActiveApproval.targetDepartment}
                  </span>
                </span>
              )}
            </div>

            <Textarea
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              placeholder="Add a comment. (Required when returning/rejecting the deferral)"
              rows={3}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={approveCurrentApproval}
                disabled={approvalBusy !== null}
              >
                {approvalBusy === "approve" ? "Working..." : "Approve"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={returnCurrentApproval}
                disabled={approvalBusy !== null}
              >
                {approvalBusy === "return" ? "Working..." : "Return to Initiator"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={rejectCurrentApproval}
                disabled={approvalBusy !== null}
              >
                {approvalBusy === "reject" ? "Working..." : "Reject Completely"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/************* */}

      <Tabs
        value={viewTab}
        onValueChange={(v) => void onViewTabChange(v)}
        className="w-full"
      >
        <div className="w-full overflow-x-auto pb-1">
          <TabsList className="h-auto w-max min-w-full justify-start gap-1 p-1">
            <TabsTrigger value="details" className="h-9 flex-none px-4">
              Details
            </TabsTrigger>
            <TabsTrigger value="approvals" className="h-9 flex-none px-4">
              Approvals
            </TabsTrigger>
            <TabsTrigger value="history" className="h-9 flex-none gap-2 px-4">
              Work Order History
              {historyCount > 0 && (
                <Badge variant="secondary" className="h-5 px-2 rounded-full">
                  {historyCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="deferralHistory"
              className="h-9 flex-none px-4"
            >
              Deferral History
            </TabsTrigger>
            <TabsTrigger value="print" className="h-9 flex-none px-4">
              Print
            </TabsTrigger>
          </TabsList>
        </div>

        {/* DETAILS TAB */}
        <TabsContent value="details" className="mt-4 space-y-6">
          {/* READ MODE (simple summary) */}
          {!editMode && (
            <Card>
              <CardHeader>
                <CardTitle>Deferral Details</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Work Order No
                    </div>
                    <div className="font-medium">{item.workOrderNo || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Work Order Title
                    </div>
                    <div className="font-medium">
                      {item.workOrderTitle || "—"}
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Equipment Full Code
                    </div>
                    <div className="font-medium">
                      {item.equipmentTag || "—"}
                    </div>
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
                {/*criticality */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Task Criticality
                    </div>
                    <div className="font-medium">
                      {item.taskCriticality || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Safety Criticality
                    </div>
                    <div className="font-medium">
                      {item.safetyCriticality || "—"}
                    </div>
                  </div>
                </div>
                {/**LAFD dates */}
                <Separator />
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Original LAFD
                    </div>
                    <div className="font-medium">
                      {item.originalLafd
                        ? new Date(item.originalLafd).toLocaleDateString()
                        : "—"}{" "}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Current LAFD
                    </div>
                    <div className="font-medium">
                      {item.lafdStartDate
                        ? new Date(item.lafdStartDate).toLocaleDateString()
                        : "—"}{" "}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      New LAFD
                    </div>
                    <div className="font-medium">
                      {item.lafdEndDate
                        ? new Date(item.lafdEndDate).toLocaleDateString()
                        : "—"}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Description
                    </div>
                    <div className="whitespace-pre-wrap">
                      {item.description || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Justification
                    </div>
                    <div className="whitespace-pre-wrap">
                      {item.justification || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Consequence
                    </div>
                    <div className="whitespace-pre-wrap">
                      {item.consequence || "—"}
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="text-sm font-medium mb-2">
                    Associated Risk (RAM)
                  </div>

                  {riskRows.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No per-category risks saved yet. Showing legacy RAM fields
                      above.
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {riskRows.map((r) => (
                        <div
                          key={r.category}
                          className="rounded-xl border bg-background p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="font-medium">{r.category}</div>
                            <div className="text-sm text-muted-foreground">
                              Cell:{" "}
                              <span className="font-medium text-foreground">
                                {r.ramCell || "—"}
                              </span>
                              {"  "}• Level:{" "}
                              <span className="font-medium text-foreground">
                                {r.ramConsequenceLevel || "—"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div>
                              <div className="text-xs text-muted-foreground">
                                Severity
                              </div>
                              <div className="font-medium">
                                {r.severity ?? "—"}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">
                                Likelihood
                              </div>
                              <div className="font-medium">
                                {r.likelihood ?? "—"}
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <div className="text-xs text-muted-foreground">
                                Justification
                              </div>
                              <div className="whitespace-pre-wrap">
                                {r.justification || "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Separator />

                <div className="rounded-lg border p-4">
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Requires TA or AD HOC
                      </div>
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
                  <div className="text-xs text-muted-foreground">
                    Mitigations
                  </div>
                  {Array.isArray(item.mitigationRows) &&
                  item.mitigationRows.length > 0 ? (
                    <div className="space-y-2 mt-1">
                      {item.mitigationRows.map((m: any, i: number) => (
                        <div
                          key={m.id ?? i}
                          className="rounded-lg border p-3 text-sm"
                        >
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            {m.requiredDepartment || "No department"}
                          </div>
                          <div className="whitespace-pre-wrap">
                            {m.mitigationText || m.description || "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">—</div>
                  )}
                </div>

                <Separator />

                <div>
                  <div className="text-sm font-medium mb-2">Attachments</div>
                  {attLoading ? (
                    <div className="text-sm text-muted-foreground">
                      Loading…
                    </div>
                  ) : attachments.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No attachments.
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {attachments.map((a) => (
                        <a
                          key={a.id}
                          href={a.filePath}
                          target="_blank"
                          rel="noreferrer"
                          className="block min-w-0 max-w-full rounded-xl border bg-background px-4 py-3 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="min-w-0">
                              <div className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">
                                {a.fileName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {a.fileType} •{" "}
                                {(a.fileSize / (1024 * 1024)).toFixed(2)} MB
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground sm:whitespace-nowrap">
                              {new Date(a.uploadedAt).toLocaleString()}
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* EDIT MODE (tabs + explicit saves) */}
          {editMode && (
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Edit Deferral</CardTitle>
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={async () => {
                    await flushRisksSave();
                    await flushPatch();
                    toast.success("Saved");
                  }}
                  disabled={!canEditDraft || saving || riskSaving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving || riskSaving ? "Saving..." : "Save now"}
                </Button>
              </CardHeader>

              <CardContent>
                <Tabs
                  value={activeTab}
                  onValueChange={onTabChange}
                  className="w-full"
                >
                  <div className="w-full overflow-x-auto pb-1">
                    <TabsList className="h-auto w-max min-w-full justify-start gap-1 p-1">
                      <TabsTrigger
                        value="basic"
                        className="h-9 flex-none px-4"
                      >
                        Basic
                      </TabsTrigger>
                      <TabsTrigger
                        value="dates"
                        className="h-9 flex-none px-4"
                      >
                        Dates
                      </TabsTrigger>
                      <TabsTrigger
                        value="text"
                        className="h-9 flex-none px-4"
                      >
                        Description
                      </TabsTrigger>
                      <TabsTrigger
                        value="risk"
                        className="h-9 flex-none px-4"
                      >
                        Associated Risk
                      </TabsTrigger>
                      <TabsTrigger
                        value="mitigation"
                        className="h-9 flex-none px-4"
                      >
                        Mitigation
                      </TabsTrigger>
                      <TabsTrigger
                        value="attachments"
                        className="h-9 flex-none px-4"
                      >
                        Attachments
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* BASIC */}
                  <TabsContent value="basic" className="mt-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          Work Order Number
                        </div>
                        <Input
                          value={workOrderNo}
                          onChange={(e) => {
                            const v = e.target.value;
                            setWorkOrderNo(v);
                            queuePatch({ workOrderNo: v });
                          }}
                          onBlur={(e) =>
                            void handleWorkOrderBlur(e.target.value.trim())
                          }
                          placeholder="work Order Number"
                          disabled={!canEditDraft}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          Work Order Title
                        </div>
                        <Input
                          value={workOrderTitle}
                          onChange={(e) => {
                            setWorkOrderTitle(e.target.value);
                            queuePatch({ workOrderTitle: e.target.value });
                          }}
                          placeholder="Short description"
                          disabled={!canEditDraft}
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          Equipment Full Code
                        </div>
                        <Input
                          value={equipmentTag}
                          onChange={(e) => {
                            setEquipmentTag(e.target.value);
                            queuePatch({ equipmentTag: e.target.value });
                          }}
                          placeholder="AAAA/BBBB/CCCC/DDDD/EEEE"
                          disabled={!canEditDraft}
                        />
                        <div className="text-xs text-muted-foreground">
                          Format:{" "}
                          <span className="font-mono">
                            ..../..../..../..../....
                          </span>
                        </div>
                        {!validateEquipmentCode(equipmentTag) &&
                          equipmentTag.trim() && (
                            <div className="text-sm text-destructive">
                              Equipment Full Code format is invalid.
                            </div>
                          )}
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          Equipment Description
                        </div>
                        <Input
                          value={equipmentDescription}
                          onChange={(e) => {
                            setEquipmentDescription(e.target.value);
                            queuePatch({
                              equipmentDescription: e.target.value,
                            });
                          }}
                          placeholder="Short description"
                          disabled={!canEditDraft}
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          Equipment Safety Criticality
                        </div>
                        <Select
                          value={safetyCriticality}
                          onValueChange={(v) => {
                            const next = (v as any) ?? "NO";
                            setSafetyCriticality(next);
                            queuePatch({ safetyCriticality: next });
                          }}
                          disabled={!canEditDraft}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent className="z-50 w-[--radix-popover-trigger-width] p-0 overflow-hidden rounded-xl border bg-white text-slate-900 shadow-lg dark:bg-slate-950 dark:text-slate-50">
                            <SelectItem value="NO">No</SelectItem>
                            <SelectItem value="YES">Yes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          Task Criticality
                        </div>
                        <Select
                          value={taskCriticality}
                          onValueChange={(v) => {
                            let next = (v as any) ?? "NO";
                            setTaskCriticality(next);
                            if (next === "YES") {
                              toast.warning("ORA required", {
                                description:
                                  "Task Criticality = YES → Work order should have an ORA, not a deferral.",
                              });
                              setTaskCriticality("NO");
                              next = "NO";
                            }
                            queuePatch({ taskCriticality: next });
                          }}
                          disabled={!canEditDraft}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent className="z-50 w-[--radix-popover-trigger-width] p-0 overflow-hidden rounded-xl border bg-white text-slate-900 shadow-lg dark:bg-slate-950 dark:text-slate-50">
                            <SelectItem value="NO">No</SelectItem>
                            <SelectItem value="YES">Yes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>

                  {/* DATES */}
                  <TabsContent value="dates" className="mt-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Original LAFD</div>
                        <Input
                          type="date"
                          value={originalLafd}
                          onChange={(e) => {
                            const v = e.target.value;
                            setOriginalLafd(v);

                            queuePatch({
                              originalLafd: fromIsoDateInput(v),
                            });
                          }}
                          disabled={!canEditDraft}
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-medium">Current LAFD</div>
                        <Input
                          type="date"
                          value={lafdCurrent}
                          min={originalLafd}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLafdCurrent(v);
                            setLafdAddMonths(0);
                            setLafdDeferredTo("");
                            queuePatch({
                              lafdStartDate: fromIsoDateInput(v),
                              lafdEndDate: null,
                            });
                          }}
                          disabled={!canEditDraft}
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          Deferred To (New LAFD)
                        </div>
                        <Input
                          type="date"
                          value={lafdDeferredTo}
                          min={deferredMin} // ✅ can’t pick <= current
                          max={(() => {
                            const base = lafdCurrent;
                            if (!base) return undefined;
                            const d = new Date(base + "T00:00:00.000Z");
                            d.setMonth(d.getMonth() + 6);
                            return d.toISOString().slice(0, 10);
                          })()}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLafdDeferredTo(v);

                            const current = lafdCurrent
                              ? new Date(lafdCurrent + "T00:00:00Z")
                              : null;
                            const deferred = v
                              ? new Date(v + "T00:00:00Z")
                              : null;

                            if (current && deferred) {
                              const max = addMonths(current, 6);
                              if (deferred.getTime() > max.getTime()) {
                                toast.error(
                                  "Maximum deferred period is 6 months from Current LAFD.",
                                );
                                return;
                              }
                            }

                            queuePatch({
                              lafdEndDate: fromIsoDateInput(v),
                            });
                          }}
                          disabled={!canEditDraft}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          Quick select (max +6 months)
                        </div>
                        <Select
                          value={String(lafdAddMonths || 0)}
                          onValueChange={(v) => applyAddMonths(Number(v))}
                          disabled={!canEditDraft || !lafdCurrent}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose months..." />
                          </SelectTrigger>
                          <SelectContent className="z-50 w-[--radix-popover-trigger-width] p-0 overflow-hidden rounded-xl border bg-white text-slate-900 shadow-lg dark:bg-slate-950 dark:text-slate-50">
                            <SelectItem value="0">—</SelectItem>
                            <SelectItem value="1">+1 month</SelectItem>
                            <SelectItem value="2">+2 months</SelectItem>
                            <SelectItem value="3">+3 months</SelectItem>
                            <SelectItem value="4">+4 months</SelectItem>
                            <SelectItem value="5">+5 months</SelectItem>
                            <SelectItem value="6">+6 months</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="text-xs text-muted-foreground">
                          Deferred To cannot exceed 6 months after Current LAFD.
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* TEXT */}
                  <TabsContent value="text" className="mt-4 space-y-4">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Description</div>
                      <Textarea
                        value={description}
                        onChange={(e) => {
                          setDescription(e.target.value);
                          queuePatch({ description: e.target.value });
                        }}
                        rows={5}
                        disabled={!canEditDraft}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="text-sm font-medium">Justification</div>
                      <Textarea
                        value={justification}
                        onChange={(e) => {
                          setJustification(e.target.value);
                          queuePatch({ justification: e.target.value });
                        }}
                        rows={5}
                        disabled={!canEditDraft}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="text-sm font-medium">Consequence</div>
                      <Textarea
                        value={consequence}
                        onChange={(e) => {
                          setConsequence(e.target.value);
                          queuePatch({ consequence: e.target.value });
                        }}
                        rows={5}
                        disabled={!canEditDraft}
                      />
                    </div>
                  </TabsContent>

                  {/* RISK */}
                  <TabsContent value="risk" className="mt-4 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-muted-foreground">
                        Per-category RAM (People/Asset/Environment/Reputation)
                      </div>
                      <Button
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={saveRisks}
                        disabled={!canEditDraft || riskSaving}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {riskSaving ? "Saving..." : "Save Risks"}
                      </Button>
                    </div>

                    <div className="grid gap-3">
                      {riskRows.map((r, idx) => (
                        <div
                          key={r.category}
                          className="rounded-xl border bg-background p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="font-medium">{r.category}</div>
                            <Badge variant="secondary">
                              {r.ramCell || "—"}
                            </Badge>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground">
                                Severity
                              </div>
                              <Select
                                value={String(r.severity)}
                                onValueChange={(v) => {
                                  const n = Number(v);
                                  setRiskRows((prev) =>
                                    prev.map((x, i) =>
                                      i === idx ? { ...x, severity: n } : x,
                                    ),
                                  );
                                  queueRisksSave();
                                }}
                                disabled={!canEditDraft}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select severity..." />
                                </SelectTrigger>
                                <SelectContent className="z-50 w-[--radix-popover-trigger-width] p-0 overflow-hidden rounded-xl border bg-white text-slate-900 shadow-lg dark:bg-slate-950 dark:text-slate-50">
                                  {SEVERITY_OPTIONS.map((s) => (
                                    <SelectItem key={s.v} value={String(s.v)}>
                                      {s.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground">
                                Likelihood
                              </div>
                              <Select
                                value={String(r.likelihood || "A")}
                                onValueChange={(v) => {
                                  const next = String(v || "A").toUpperCase();
                                  setRiskRows((prev) =>
                                    prev.map((x, i) =>
                                      i === idx
                                        ? { ...x, likelihood: next }
                                        : x,
                                    ),
                                  );
                                  queueRisksSave();
                                }}
                                disabled={!canEditDraft}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select likelihood..." />
                                </SelectTrigger>
                                <SelectContent className="z-50 w-[--radix-popover-trigger-width] p-0 overflow-hidden rounded-xl border bg-white text-slate-900 shadow-lg dark:bg-slate-950 dark:text-slate-50">
                                  {LIKELIHOOD_OPTIONS.map((l) => (
                                    <SelectItem key={l.v} value={l.v}>
                                      {l.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="md:col-span-2 space-y-1">
                              <div className="text-xs text-muted-foreground">
                                Justification
                              </div>
                              <Textarea
                                value={r.justification ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setRiskRows((prev) =>
                                    prev.map((x, i) =>
                                      i === idx
                                        ? { ...x, justification: v }
                                        : x,
                                    ),
                                  );
                                  queueRisksSave();
                                }}
                                rows={3}
                                disabled={!canEditDraft}
                              />
                            </div>
                          </div>

                          {r.ramConsequenceLevel && (
                            <div className="mt-3 text-xs text-muted-foreground">
                              Consequence Level:{" "}
                              <span className="font-medium text-foreground">
                                {r.ramConsequenceLevel}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {/* MITIGATION */}
                  <TabsContent value="mitigation" className="mt-4 space-y-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        disabled={!canEditDraft || saving}
                        onClick={async () => {
                          const payload =
                            serializeMitigationRows(mitigationRows);
                          await patchNow({ mitigations: payload });
                        }}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {saving ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canEditDraft}
                        onClick={() =>
                          updateMitigationRows((prev) => [
                            ...prev,
                            { mitigationText: "", requiredDepartment: "" },
                          ])
                        }
                      >
                        + Add mitigation
                      </Button>
                    </div>

                    {mitigationRows.map((row, index) => (
                      <div
                        key={row.id ?? index}
                        className="rounded-xl border p-4 space-y-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Mitigation {index + 1}
                          </span>
                          {canEditDraft && mitigationRows.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() =>
                                updateMitigationRows((prev) =>
                                  prev.filter((_, i) => i !== index),
                                )
                              }
                            >
                              Remove
                            </Button>
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">
                            Required Department
                          </div>
                          <Select
                            value={row.requiredDepartment}
                            disabled={!canEditDraft}
                            onValueChange={(v) =>
                              updateMitigationRows((prev) =>
                                prev.map((r, i) =>
                                  i === index
                                    ? { ...r, requiredDepartment: v }
                                    : r,
                                ),
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select department..." />
                            </SelectTrigger>
                            <SelectContent>
                              {DEPARTMENTS.map((dept) => (
                                <SelectItem key={dept} value={dept}>
                                  {dept}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">
                            Mitigation Action
                          </div>
                          <Textarea
                            value={row.mitigationText}
                            disabled={!canEditDraft}
                            onChange={(e) =>
                              updateMitigationRows((prev) =>
                                prev.map((r, i) =>
                                  i === index
                                    ? { ...r, mitigationText: e.target.value }
                                    : r,
                                ),
                              )
                            }
                            placeholder="Describe this mitigation and the required action"
                            rows={4}
                          />
                        </div>
                      </div>
                    ))}

                    <div className="text-xs text-muted-foreground">
                      All department heads will be included in the approval
                      cycle after your department head.
                    </div>
                  </TabsContent>

                  {/* ATTACHMENTS */}
                  <TabsContent value="attachments" className="mt-4 space-y-4">
                    <div className="rounded-xl border bg-muted/30 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">Upload files</div>
                          <div className="text-xs text-muted-foreground">
                            PDF / PNG / JPG / WEBP — max 25MB each.
                          </div>
                        </div>

                        <label className="inline-flex">
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            accept="application/pdf,image/png,image/jpeg,image/webp"
                            disabled={!canEditDraft}
                            onChange={(e) => {
                              const fl = e.target.files;

                              // IMPORTANT: call upload first, then reset value
                              void uploadAttachments(fl);
                              e.target.value = "";
                            }}
                          />
                          <Button asChild disabled={!canEditDraft}>
                            <span>
                              <UploadCloud className="mr-2 h-4 w-4" />
                              Upload
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>

                    <div className="text-sm font-medium">Files</div>

                    {attLoading ? (
                      <div className="text-sm text-muted-foreground">
                        Loading…
                      </div>
                    ) : attachments.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No attachments yet.
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {attachments.map((a) => (
                          <a
                            key={a.id}
                            href={a.filePath}
                            target="_blank"
                            rel="noreferrer"
                            className="block min-w-0 max-w-full rounded-xl border bg-background px-4 py-3 hover:bg-muted/40 transition-colors"
                          >
                            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                              <div className="min-w-0">
                                <div className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">
                                  {a.fileName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {a.fileType} •{" "}
                                  {(a.fileSize / (1024 * 1024)).toFixed(2)} MB
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground sm:whitespace-nowrap">
                                {new Date(a.uploadedAt).toLocaleString()}
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* APPROVALS TAB */}
        <TabsContent value="approvals" className="mt-4 space-y-6">
          {item.status === "DRAFT" || item.status === "RETURNED" ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                This deferral is still a draft. Submit it to start the approval
                workflow.
              </CardContent>
            </Card>
          ) : (
            <>
              <ApprovalTimeline
                deferralId={item.id}
                initiatorDepartment={item.initiatorDepartment}
              />
            </>
          )}
        </TabsContent>

        {/* WORK ORDER HISTORY TAB */}
        <TabsContent value="history" className="mt-4 space-y-6">
          <WorkOrderHistoryTab
            workOrderNo={item.workOrderNo}
            excludeId={item.id}
            onCountChange={setHistoryCount}
          />
        </TabsContent>

        {/* DEFERRAL HISTORY TAB */}
        <TabsContent value="deferralHistory" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Deferral History</CardTitle>
            </CardHeader>

            <CardContent>
              {histLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : deferralHistory.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No rejection/return events yet.
                </div>
              ) : (
                <div className="grid gap-3">
                  {deferralHistory.map((h, idx) => (
                    <div key={idx} className="rounded-xl border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">
                            {formatStepRole(formatStepRole(h.stepRole))}
                          </div>
                          {h.signedByNameSnapshot && (
                            <div className="text-xs text-muted-foreground">
                              by {h.signedByNameSnapshot}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {h.status === "REJECTED"
                              ? "Rejected Completely"
                              : "Returned for Revision"}
                          </Badge>
                          <Badge variant="secondary">Cycle #{h.cycle}</Badge>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground">
                        {h.signedAt
                          ? new Date(h.signedAt).toLocaleString()
                          : "—"}
                      </div>

                      <div className="mt-3 whitespace-pre-wrap text-sm">
                        {h.comment || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Print TAB */}
        <TabsContent value="print" className="mt-4 space-y-6">
          <Button
            variant="secondary"
            onClick={() =>
              window.open(`/api/deferrals/${item.id}/pdf`, "_blank")
            }
          >
            Export PDF
          </Button>
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={showCloseDialog}
        onOpenChange={(open) => setShowCloseDialog(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close deferral</AlertDialogTitle>
            <AlertDialogDescription>
              Use this when the work order was fulfilled and the deferral can be closed by the initiator.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCloseDialog(false)}
              disabled={recordActionBusy !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void closeDeferral()}
              disabled={recordActionBusy !== null}
            >
              {recordActionBusy === "close" ? "Closing..." : "Close deferral"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showSoftDeleteDialog}
        onOpenChange={(open) => {
          setShowSoftDeleteDialog(open);
          if (!open) setDeleteReason("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark deferral as deleted</AlertDialogTitle>
            <AlertDialogDescription>
              This keeps the record in the database and changes its status to deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <div className="text-sm font-medium">Reason</div>
            <Textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Enter the reason for deleting this in-approval deferral"
              rows={4}
            />
          </div>

          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSoftDeleteDialog(false);
                setDeleteReason("");
              }}
              disabled={recordActionBusy !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void softDeleteDeferral()}
              disabled={recordActionBusy !== null}
            >
              {recordActionBusy === "softDelete"
                ? "Deleting..."
                : "Mark as deleted"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showHardDeleteDialog}
        onOpenChange={(open) => setShowHardDeleteDialog(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft permanently</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the draft from the database completely. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowHardDeleteDialog(false)}
              disabled={recordActionBusy !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void hardDeleteDraft()}
              disabled={recordActionBusy !== null}
            >
              {recordActionBusy === "hardDelete"
                ? "Deleting..."
                : "Delete permanently"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {duplicateInfo && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setDuplicateInfo(null);
              if (duplicateInfo.source === "submit") {
                setPendingSubmit(null);
                setConfirmDuplicate(false);
              }
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {duplicateInfo.blocked
                  ? "Maximum deferrals reached"
                  : duplicateInfo.duplicateRank === 2
                    ? "Second deferral for this Work Order"
                    : "Third deferral for this Work Order"}
              </AlertDialogTitle>

              <AlertDialogDescription>
                {duplicateInfo.message}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDuplicateInfo(null);

                  if (duplicateInfo.source === "submit") {
                    setPendingSubmit(null);
                    setConfirmDuplicate(false);
                  }
                }}
              >
                {duplicateInfo.blocked ? "Close" : "Cancel"}
              </Button>

              {!duplicateInfo.blocked && duplicateInfo.source === "submit" && (
                <Button
                  onClick={async () => {
                    if (!pendingSubmit) return;

                    const { workOrderNo, workOrderTitle } = pendingSubmit;

                    setConfirmDuplicate(true);
                    setDuplicateInfo(null);
                    setPendingSubmit(null);

                    await submitViaDialog(workOrderNo, workOrderTitle, true);
                  }}
                >
                  Yes, continue
                </Button>
              )}

              {!duplicateInfo.blocked && duplicateInfo.source === "change" && (
                <Button
                  onClick={() => {
                    setDuplicateInfo(null);
                  }}
                >
                  OK
                </Button>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {/* *********** */}
    </div>
  );
}
