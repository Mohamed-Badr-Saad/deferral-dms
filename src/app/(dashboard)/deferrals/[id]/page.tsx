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
import { UploadCloud, Save } from "lucide-react";
import { WorkOrderHistoryTab } from "@/src/components/deferral/WorkOrderHistoryTab";
import { ApprovalStatus } from "@/src/components/deferral/GmDecisionPanel";
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

type Profile = {
  id: string;
  role: string;
  name: string;
  department: string;
  position: string;
};

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

type RiskCategory = "PEOPLE" | "ASSET" | "ENVIRONMENT" | "REPUTATION";
type RiskRow = {
  category: RiskCategory;
  severity: number;
  likelihood: string;
  ramCell: string;
  ramConsequenceLevel: string;
  justification: string;
};

type Attachment = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  uploadedAt: string;
};

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

export default function DeferralDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const deferralId = params?.id;

  const [item, setItem] = useState<Deferral | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workOrderNo, setWorkOrderNo] = useState("");
  const [workOrderTitle, setWorkOrderTitle] = useState("");

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

  const [lafdCurrent, setLafdCurrent] = useState<string>(""); // yyyy-mm-dd
  const [lafdDeferredTo, setLafdDeferredTo] = useState<string>(""); // yyyy-mm-dd
  const [lafdAddMonths, setLafdAddMonths] = useState<number>(0);

  const [description, setDescription] = useState("");
  const [justification, setJustification] = useState("");
  const [consequence, setConsequence] = useState("");
  const [mitigations, setMitigations] = useState("");

  const [riskRows, setRiskRows] = useState<RiskRow[]>([]);
  const [riskSaving, setRiskSaving] = useState(false);
  const riskRowsRef = useRef<RiskRow[]>([]);
  useEffect(() => {
    riskRowsRef.current = riskRows;
  }, [riskRows]);

  // --- Risk autosave (debounced) ---
  const pendingRiskRef = useRef(false);
  const riskDebounceRef = useRef<any>(null);

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
    if (riskDebounceRef.current) clearTimeout(riskDebounceRef.current);

    riskDebounceRef.current = setTimeout(async () => {
      if (!pendingRiskRef.current) return;
      pendingRiskRef.current = false;
      await saveRisksNow(true); // silent autosave
    }, 800);
  }, [saveRisksNow, canEditDraft]);

  const flushRisksSave = useCallback(async () => {
    if (riskDebounceRef.current) clearTimeout(riskDebounceRef.current);
    if (!pendingRiskRef.current) return;
    pendingRiskRef.current = false;
    await saveRisksNow(true);
  }, [saveRisksNow]);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [viewTab, setViewTab] = useState<"details" | "approvals" | "history">(
    "details",
  );

  const [deferralHistory, setDeferralHistory] = useState<
    {
      cycle: number;
      stepRole: string;
      comment: string;
      signedAt: string | null;
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

    setLafdCurrent(toIsoDateInput(d.lafdStartDate));
    setLafdDeferredTo(toIsoDateInput(d.lafdEndDate));
    setLafdAddMonths(0);

    setDescription(d.description ?? "");
    setJustification(d.justification ?? "");
    setConsequence(d.consequence ?? "");
    setMitigations(d.mitigations ?? "");
  }, []);

  const load = useCallback(async () => {
    if (!deferralId) return;
    setLoading(true);
    try {
      const p = await api<{ profile: Profile }>("/api/profile");
      setProfile(p.profile);

      const d = await api<{ item: Deferral }>(`/api/deferrals/${deferralId}`);
      setItem(d.item);
      hydrateLocalFromItem(d.item);

      if (d.item.status === "DRAFT" || d.item.status === "RETURNED") {
        const a = await api<{ approvals: ApprovalRow[] }>(
          `/api/deferrals/${deferralId}/approvals`,
        );
        setApprovals(a.approvals ?? []);
      } else {
        setApprovals([]);
      }
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
    if (!(d.mitigations ?? "").trim()) missing.push("Mitigations");

    if (!Array.isArray(risks) || risks.length === 0)
      missing.push("Associated Risk (RAM)");

    return missing;
  }

  // ---------- PATCH helper + autosave (debounced) ----------
  const pendingPatchRef = useRef<any>({});
  const debounceRef = useRef<any>(null);

  const patchNow = useCallback(
    async (payload: any, silent?: boolean) => {
      if (!deferralId) return;
      if (!canEditDraft) return; // ✅ ADD

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
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to save");
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
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const payload = pendingPatchRef.current;
        pendingPatchRef.current = {};
        if (Object.keys(payload).length === 0) return;
        await patchNow(payload, true);
      }, 600);
    },
    [patchNow],
  );

  const flushPatch = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const payload = pendingPatchRef.current;
    pendingPatchRef.current = {};
    if (Object.keys(payload).length === 0) return;
    await patchNow(payload, true);
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
      toast.success("Risks saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save risks");
    } finally {
      setRiskSaving(false);
    }
  }, [deferralId, riskRows]);

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
    [deferralId, loadAttachments],
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
    console.log(lafdCurrent);
    setLafdDeferredTo(next.toISOString().slice(0, 10));
    // queue patch
    queuePatch({
      lafdStartDate: fromIsoDateInput(lafdCurrent),
      lafdEndDate: fromIsoDateInput(next.toISOString().slice(0, 10)),
    });
  }

  // ---------- Submit ----------
  const [busy, setBusy] = useState(false);

  async function submitViaDialog(workOrderNo: string, workOrderTitle: string) {
    if (!item) return;
    setBusy(true);
    try {
      await flushRisksSave();
      await flushPatch(); // ensure latest edits saved before submit
      await api(`/api/deferrals/${item.id}/submit`, {
        method: "POST",
        json: { workOrderNo, workOrderTitle },
      });
      toast("Submitted", {
        description: "Deferral submitted into the workflow.",
      });
      await load();
      router.refresh();
    } catch (e: any) {
      const msg = String(e?.message ?? "Submit failed");
      if (msg.toLowerCase().includes("already has 3 deferrals")) {
        toast.warning("Work order deferrals limit reached", {
          description: msg,
        });
      } else {
        toast("Server error", { description: msg });
      }
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

          <div className="mt-2 text-xs text-muted-foreground">
            Initiator:{" "}
            <span className="font-medium">{profile?.name ?? "—"}</span> •{" "}
            <span className="font-medium">{profile?.position ?? "—"}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {canEditDraft && (
            <Button
              variant={editMode ? "secondary" : "default"}
              onClick={async () => {
                if (editMode) await flushPatch();
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

          {canEditDraft && (
            <SubmitDeferralDialog
              disabled={busy}
              initialWorkOrderNo={item.workOrderNo}
              initialWorkOrderTitle={item.workOrderTitle}
              validateBeforeOpen={() => getMissingFields(item, riskRows)}
              onValidationFailed={(missing) => {
                toast.warning("Missing required details", {
                  description: missing.join(" • "),
                });
              }}
              onSubmit={async ({ workOrderNo, workOrderTitle }) => {
                await submitViaDialog(workOrderNo, workOrderTitle);
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

      {/************* */}

      <Tabs
        value={viewTab}
        onValueChange={(v) => setViewTab(v as any)}
        className="w-full"
      >
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            Work Order History
            {historyCount > 0 && (
              <Badge variant="secondary" className="h-5 px-2 rounded-full">
                {historyCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="deferralHistory">Deferral History</TabsTrigger>
          <TabsTrigger value="print">Print</TabsTrigger>
        </TabsList>

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

                <div className="grid gap-4 md:grid-cols-3">
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
                  <div className="whitespace-pre-wrap">
                    {item.mitigations || "—"}
                  </div>
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
                          className="rounded-xl border bg-background px-4 py-3 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium truncate">
                                {a.fileName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {a.fileType} •{" "}
                                {(a.fileSize / (1024 * 1024)).toFixed(2)} MB
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
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

          {/* EDIT MODE (tabs + autosave) */}
          {editMode && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Edit Deferral</CardTitle>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await flushPatch();
                    toast.success("Saved");
                  }}
                  disabled={!canEditDraft || saving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save now"}
                </Button>
              </CardHeader>

              <CardContent>
                <Tabs
                  value={activeTab}
                  onValueChange={onTabChange}
                  className="w-full"
                >
                  <TabsList className="flex flex-wrap">
                    <TabsTrigger value="basic">Basic</TabsTrigger>
                    <TabsTrigger value="dates">Dates</TabsTrigger>
                    <TabsTrigger value="text">Description</TabsTrigger>
                    <TabsTrigger value="risk">Associated Risk</TabsTrigger>
                    <TabsTrigger value="mitigation">Mitigation</TabsTrigger>
                    <TabsTrigger value="attachments">Attachments</TabsTrigger>
                  </TabsList>

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
                            setWorkOrderNo(e.target.value);
                            queuePatch({ workOrderNo: e.target.value });
                          }}
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
                            const next = (v as any) ?? "NO";
                            setTaskCriticality(next);
                            queuePatch({ taskCriticality: next });
                            if (next === "YES") {
                              toast.warning("ORA required", {
                                description:
                                  "Task Criticality = YES → Work order should have an ORA, not a deferral.",
                              });
                              setTaskCriticality("NO");
                            }
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
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Current LAFD</div>
                        <Input
                          type="date"
                          value={lafdCurrent}
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
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-muted-foreground">
                        Per-category RAM (People/Asset/Environment/Reputation)
                      </div>
                      <Button
                        size="sm"
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
                  <TabsContent value="mitigation" className="mt-4 space-y-2">
                    <Textarea
                      value={mitigations}
                      onChange={(e) => {
                        setMitigations(e.target.value);
                        queuePatch({ mitigations: e.target.value });
                      }}
                      rows={10}
                      disabled={!canEditDraft}
                    />
                    <div className="text-xs text-muted-foreground">
                      Tip: write mitigations as actionable steps.
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

                        <label
                          className="inline-flex"
                        >
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            accept="application/pdf,image/png,image/jpeg,image/webp"
                            disabled={!canEditDraft}
                            onChange={(e) => {
                              const fl = e.target.files;
                              console.log("INPUT onChange fired", {
                                filesCount: fl?.length ?? 0,
                              });

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
                            className="rounded-xl border bg-background px-4 py-3 hover:bg-muted/40 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium truncate">
                                  {a.fileName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {a.fileType} •{" "}
                                  {(a.fileSize / (1024 * 1024)).toFixed(2)} MB
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground whitespace-nowrap">
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
              <ApprovalTimeline deferralId={item.id} />
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
                        <div className="font-medium">{h.stepRole}</div>
                        <Badge variant="secondary">Cycle #{h.cycle}</Badge>
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

      {/* *********** */}
    </div>
  );
}
