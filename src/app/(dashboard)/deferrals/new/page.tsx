"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/src/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";
import { UploadCloud, Save, ArrowRight } from "lucide-react";

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

  mitigations: string;

  updatedAt: string;
  createdAt: string;
};

type Profile = {
  id: string;
  name: string;
  department: string;
  position: string;
  role: string;
  email: string;
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
  {
    v: "E",
    label: "E - >1/year at the location",
  },
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
  // yyyy-mm-dd
  return d.toISOString().slice(0, 10);
}

function fromIsoDateInput(v: string) {
  if (!v) return null;
  const d = new Date(v + "T00:00:00.000Z");
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function ramBadgeClass(cell: string) {
  // You can map to your RAM colors later. Keeping mild styling now.
  return "bg-muted text-foreground";
}

export default function NewDeferralPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);

  const [deferral, setDeferral] = useState<Deferral | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attLoading, setAttLoading] = useState(false);
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
      if (!deferral) return;
      if (!riskRowsRef.current || riskRowsRef.current.length === 0) return;
      setRiskSaving(true);
      try {
        const payload = {
          items: (riskRowsRef.current ?? []).map((r) => ({
            category: r.category,
            severity: r.severity ?? "1",
            likelihood: r.likelihood ?? "A",
            justification: r.justification ?? "",
          })),
        };

        const res = await api<{ items: RiskRow[] }>(
          `/api/deferrals/${deferral.id}/risks`,
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
    [deferral],
  );

  const queueRisksSave = useCallback(() => {
    pendingRiskRef.current = true;
    if (riskDebounceRef.current) clearTimeout(riskDebounceRef.current);

    riskDebounceRef.current = setTimeout(async () => {
      if (!pendingRiskRef.current) return;
      pendingRiskRef.current = false;
      await saveRisksNow(true); // silent autosave
    }, 800);
  }, [saveRisksNow]);

  const flushRisksSave = useCallback(async () => {
    if (riskDebounceRef.current) clearTimeout(riskDebounceRef.current);
    if (!pendingRiskRef.current) return;
    pendingRiskRef.current = false;
    await saveRisksNow(true);
  }, [saveRisksNow]);

  // controlled fields (draft form)
  const [equipmentTag, setEquipmentTag] = useState("");
  const [equipmentDescription, setEquipmentDescription] = useState("");
  const [workOrderNo, setWorkOrderNo] = useState("");
  const [workOrderTitle, setWorkOrderTitle] = useState("");

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
  const searchParams = useSearchParams();
  const draftId = (searchParams.get("draftId") ?? "").trim();
  const requestDate = useMemo(() => new Date().toLocaleDateString(), []);
  const canUpload =
    deferral?.status === "DRAFT" || deferral?.status === "RETURNED";
  const uploadInputId = `upload-${deferral?.id ?? "new"}`;

  async function loadAll() {
    setLoading(true);
    try {
      const p = await api<{ profile: Profile }>("/api/profile");
      setProfile(p.profile);

      let d: Deferral;

      if (draftId) {
        const existing = await api<{ item: Deferral }>(
          `/api/deferrals/${draftId}`,
        );
        d = existing.item;
      } else {
        const created = await api<{ item: Deferral }>("/api/deferrals", {
          method: "POST",
          json: {},
        });
        d = created.item;

        // IMPORTANT: replace URL so refresh doesn't create again
        router.replace(`/deferrals/new?draftId=${encodeURIComponent(d.id)}`);
      }

      setDeferral(d);

      // hydrate state
      setWorkOrderNo((d as any).workOrderNo ?? "");
      setWorkOrderTitle((d as any).workOrderTitle ?? "");

      setEquipmentTag(d.equipmentTag ?? "");
      setEquipmentDescription(d.equipmentDescription ?? "");

      setSafetyCriticality(
        (String(d.safetyCriticality || "NO").toUpperCase() as any) ?? "NO",
      );
      setTaskCriticality(
        (String(d.taskCriticality || "NO").toUpperCase() as any) ?? "NO",
      );

      setLafdCurrent(toIsoDateInput(d.lafdStartDate));
      setLafdDeferredTo(toIsoDateInput(d.lafdEndDate));
      setLafdAddMonths(0);

      setDescription(d.description ?? "");
      setJustification(d.justification ?? "");
      setConsequence(d.consequence ?? "");
      setMitigations(d.mitigations ?? "");

      setAttachments([]);
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
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to start a new deferral");
    } finally {
      setLoading(false);
    }
  }

  const didInitRef = useRef(false);

  useEffect(() => {
    // Prevent double-run in React Strict Mode (dev)
    if (didInitRef.current) return;
    didInitRef.current = true;

    void (async () => {
      setLoading(true);
      try {
        const p = await api<{ profile: Profile }>("/api/profile");
        setProfile(p.profile);

        // If URL already has a draftId -> load it
        if (draftId) {
          const existing = await api<{ item: Deferral }>(
            `/api/deferrals/${draftId}`,
          );
          setDeferral(existing.item);
          // ...hydrate state from existing.item...
          return;
        }

        // Otherwise create EXACTLY ONCE
        const created = await api<{ item: Deferral }>("/api/deferrals", {
          method: "POST",
          json: {},
        });

        const d = created.item;
        setDeferral(d);

        // IMPORTANT: replace URL (but DON'T cause another create)
        router.replace(`/deferrals/new?draftId=${encodeURIComponent(d.id)}`);

        // ...hydrate state from d...
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to start a new deferral");
      } finally {
        setLoading(false);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 👈 run once only

  useEffect(() => {
    if (!draftId) return;
    if (deferral?.id === draftId) return;

    void (async () => {
      setLoading(true);
      try {
        const existing = await api<{ item: Deferral }>(
          `/api/deferrals/${draftId}`,
        );
        setDeferral(existing.item);
        // hydrate...
      } finally {
        setLoading(false);
      }
    })();
  }, [draftId]);

  const pendingPatchRef = useRef<any>({});
  const debounceRef = useRef<any>(null);

  const patchNow = useCallback(
    async (payload: any) => {
      if (!deferral) return;
      setSaving(true);
      try {
        const res = await api<{ item: Deferral }>(
          `/api/deferrals/${deferral.id}`,
          {
            method: "PATCH",
            json: payload,
          },
        );
        setDeferral(res.item);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [deferral],
  );

  const queuePatch = useCallback(
    (partial: any) => {
      pendingPatchRef.current = { ...pendingPatchRef.current, ...partial };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const payload = pendingPatchRef.current;
        pendingPatchRef.current = {};
        if (Object.keys(payload).length === 0) return;
        await patchNow(payload);
      }, 600);
    },
    [patchNow],
  );

  const flushPatch = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const payload = pendingPatchRef.current;
    pendingPatchRef.current = {};
    if (Object.keys(payload).length === 0) return;
    await patchNow(payload);
  }, [patchNow]);

  function validateEquipmentCode(v: string) {
    return EQUIPMENT_FULL_CODE_RE.test(v.trim());
  }

  async function saveBasic() {
    if (!deferral) return;

    const codeOk = equipmentTag.trim()
      ? validateEquipmentCode(equipmentTag)
      : false;
    if (!codeOk) {
      toast.error("Validation error", {
        description:
          "Equipment Full Code must be like AAA/BBB/CCC/DDD/EEE (letters/numbers only).",
      });
      return;
    }

    if (taskCriticality === "YES") {
      toast.warning("Note", {
        description:
          "Task Criticality = YES → Work order should have an ORA (not deferral).",
      });
    }

    await patch({
      workOrderNo: workOrderNo.trim(),
      workOrderTitle: workOrderTitle.trim(),
      equipmentTag: equipmentTag.trim(),
      equipmentDescription: equipmentDescription.trim(),
      safetyCriticality,
      taskCriticality,
    } as any);

    toast.success("Saved");
  }

  async function saveDates() {
    if (!deferral) return;

    const current = lafdCurrent ? new Date(lafdCurrent + "T00:00:00Z") : null;
    const deferred = lafdDeferredTo
      ? new Date(lafdDeferredTo + "T00:00:00Z")
      : null;

    if (!current) {
      toast.error("Validation error", {
        description: "Current LAFD is required.",
      });
      return;
    }
    if (!deferred) {
      toast.error("Validation error", {
        description: "Deferred To (New LAFD) is required.",
      });
      return;
    }

    if (deferred.getTime() <= current.getTime()) {
      toast.error("Validation error", {
        description: "Deferred To (New LAFD) must be after Current LAFD.",
      });
      return;
    }
    const max = addMonths(current, 6);
    if (deferred.getTime() > max.getTime()) {
      toast.error("Validation error", {
        description: "Maximum deferred period is 6 months from Current LAFD.",
      });
      return;
    }

    await patch({
      lafdStartDate: fromIsoDateInput(lafdCurrent),
      lafdEndDate: fromIsoDateInput(lafdDeferredTo),
    } as any);

    toast.success("Saved");
  }

  function applyAddMonths(months: number) {
    setLafdAddMonths(months);
    if (!lafdCurrent) return;

    const current = new Date(lafdCurrent + "T00:00:00Z");
    const next = addMonths(current, months);
    const max = addMonths(current, 6);

    if (months > 6) {
      toast.error("Maximum deferred period is 6 months.");
      return;
    }
    if (next.getTime() > max.getTime()) {
      toast.error("Maximum deferred period is 6 months.");
      return;
    }
    setLafdDeferredTo(next.toISOString().slice(0, 10));
    queuePatch({
      lafdStartDate: fromIsoDateInput(lafdCurrent),
      lafdEndDate: fromIsoDateInput(next.toISOString().slice(0, 10)),
    });
  }

  async function saveTextTab() {
    await patch({
      description,
      justification,
      consequence,
    } as any);
    toast.success("Saved");
  }

  async function saveMitigation() {
    await patch({ mitigations } as any);
    toast.success("Saved");
  }

  async function loadAttachments() {
    if (!deferral) return;
    setAttLoading(true);
    try {
      const res = await api<{ items: Attachment[] }>(
        `/api/deferrals/${deferral.id}/attachments`,
      );
      setAttachments(res.items ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load attachments");
    } finally {
      setAttLoading(false);
    }
  }

  async function uploadAttachments(files: FileList | null) {
    console.log("upload attachment");
    if (!deferral || !files || files.length === 0) return;

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
      const res = await fetch(`/api/deferrals/${deferral.id}/attachments`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(`Upload failed (${res.status})`, {
          description: json?.detail ?? json?.message ?? "Server error",
        });
        return;
      }
      toast.success("Uploaded");
      await loadAttachments();
    } catch {
      toast.error("Upload failed");
    }
  }

  function defaultRiskRows(): RiskRow[] {
    return [
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
    ];
  }

  async function loadRisks() {
    if (!deferral) return;
    try {
      const res = await api<{ items: RiskRow[] }>(
        `/api/deferrals/${deferral.id}/risks`,
      );
      if (res.items?.length) {
        setRiskRows(res.items as any);
      } else {
        // 👇 if server has none, show defaults locally
        setRiskRows(defaultRiskRows());
      }
    } catch {
      // 👇 if GET fails, still show defaults locally
      setRiskRows(defaultRiskRows());
    }
  }

  function addDaysIso(dateIso: string, days: number) {
    // dateIso is yyyy-mm-dd
    const d = new Date(dateIso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  const deferredMin = lafdCurrent ? addDaysIso(lafdCurrent, 1) : undefined;

  // load attachments & risks after draft exists
  useEffect(() => {
    if (!deferral) return;
    loadAttachments();
    loadRisks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferral?.id]);

  useEffect(() => {
    if (!deferral) return;

    // if you REALLY want to default these values, do it once per deferral
    queuePatch({ safetyCriticality: "NO", taskCriticality: "NO" });

    // only queue risks save after risks are loaded/seeded
    if (riskRows.length > 0) queueRisksSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferral?.id, riskRows.length, workOrderNo]);

  if (loading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Creating draft…
        </CardContent>
      </Card>
    );
  }

  if (!deferral) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Failed to create draft.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              New Deferral
            </h1>
            <Badge variant="secondary" className="rounded-xl">
              {deferral.deferralCode}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Draft created automatically. Fill details across tabs. Request Date:{" "}
            <span className="font-medium">{requestDate}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              await flushRisksSave();
              await flushPatch();
              router.push(`/deferrals/${deferral.id}?edit=1`);
            }}
          >
            Open Details <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Initiator strip */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Initiator</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">Name</div>
            <div className="font-medium">{profile?.name ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Job Title</div>
            <div className="font-medium">{profile?.position ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Department</div>
            <div className="font-medium">
              {profile?.department ?? deferral.initiatorDepartment ?? "—"}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="dates">Dates</TabsTrigger>
          <TabsTrigger value="text">Description</TabsTrigger>
          <TabsTrigger value="risk">Associated Risk</TabsTrigger>
          <TabsTrigger value="mitigation">Mitigation</TabsTrigger>
          <TabsTrigger value="attachments">Attachments</TabsTrigger>
        </TabsList>

        {/* BASIC */}
        <TabsContent value="basic" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Basic Information</CardTitle>
              <Button size="sm" onClick={saveBasic} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-sm font-medium">work Order Number</div>
                  <Input
                    value={workOrderNo}
                    onChange={(e) => {
                      const v = e.target.value;
                      setWorkOrderNo(v);
                      queuePatch({ workOrderNo: v });
                    }}
                    placeholder="Work Order Number"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium">work Order Title</div>
                  <Input
                    value={workOrderTitle}
                    onChange={(e) => {
                      const v = e.target.value;
                      setWorkOrderTitle(v);
                      queuePatch({ workOrderTitle: v });
                    }}
                    placeholder="Work Order Title"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Equipment Full Code</div>
                  <Input
                    value={equipmentTag}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEquipmentTag(v);
                      queuePatch({ equipmentTag: v });
                    }}
                    placeholder="AAAA/BBBB/CCCC/DDDD/EEEE"
                  />
                  <div className="text-xs text-muted-foreground">
                    Format:{" "}
                    <span className="font-mono">..../..../..../..../....</span>{" "}
                    (letters/numbers only)
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium">
                    Equipment Description
                  </div>
                  <Input
                    value={equipmentDescription}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEquipmentDescription(v);
                      queuePatch({ equipmentDescription: v });
                    }}
                    placeholder="Short description"
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
                  <div className="text-sm font-medium">Task Criticality</div>
                  <Select
                    value={taskCriticality}
                    onValueChange={(v) => {
                      const next = (v as any) ?? "NO";
                      setTaskCriticality(next);

                      if (next === "YES") {
                        toast.warning("ORA required", {
                          description:
                            "Task Criticality = YES → Work order should have an ORA, not a deferral.",
                        });
                        setTaskCriticality("NO");
                      }
                      queuePatch({ taskCriticality: next });
                    }}
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

              {!validateEquipmentCode(equipmentTag) && equipmentTag.trim() && (
                <div className="text-sm text-destructive">
                  Equipment Full Code format is invalid.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DATES */}
        <TabsContent value="dates" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Dates</CardTitle>
              <Button size="sm" onClick={saveDates} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
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

                      // If existing deferred date becomes invalid, clear it
                      if (lafdDeferredTo && v) {
                        const min = addDaysIso(v, 1);
                        if (lafdDeferredTo < min) {
                          setLafdDeferredTo("");
                          queuePatch({ lafdEndDate: null });
                        }
                      }

                      queuePatch({
                        lafdStartDate: fromIsoDateInput(v),
                      });
                    }}
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
                    disabled={!lafdCurrent} // ✅ force choosing current first
                    onChange={(e) => {
                      const v = e.target.value;

                      // Guard if user types an invalid date
                      if (lafdCurrent) {
                        const min = addDaysIso(lafdCurrent, 1);
                        if (v && v < min) {
                          setLafdDeferredTo("");
                          queuePatch({ lafdEndDate: null });
                          return;
                        }
                      }

                      setLafdDeferredTo(v);
                      queuePatch({ lafdEndDate: fromIsoDateInput(v) });
                    }}
                  />
                  <div className="text-xs text-muted-foreground">
                    Must be after Current LAFD.
                  </div>
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
                    disabled={!lafdCurrent}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEXT */}
        <TabsContent value="text" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Description / Justification / Consequence
              </CardTitle>
              <Button size="sm" onClick={saveTextTab} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Description</div>
                  <Textarea
                    value={description}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDescription(v);
                      queuePatch({ description: v });
                    }}
                    placeholder="Describe the deferral request..."
                    rows={5}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium">Justification</div>
                  <Textarea
                    value={justification}
                    onChange={(e) => {
                      const v = e.target.value;
                      setJustification(v);
                      queuePatch({ justification: v });
                    }}
                    placeholder="Why is this deferral needed?"
                    rows={5}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium">Consequence</div>
                  <Textarea
                    value={consequence}
                    onChange={(e) => {
                      const v = e.target.value;
                      setConsequence(v);
                      queuePatch({ consequence: v });
                    }}
                    placeholder="What happens if not deferred / risks?"
                    rows={5}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RISK */}
        <TabsContent value="risk" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Associated Risk (RAM)</CardTitle>
              <Button
                size="sm"
                onClick={() => saveRisksNow(false)}
                disabled={riskSaving}
              >
                {" "}
                <Save className="mr-2 h-4 w-4" />
                {riskSaving ? "Saving..." : "Save"}
              </Button>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* <div className="text-sm text-muted-foreground">
                Choose Severity + Likelihood per category. RAM cell and level
                are computed on the server.
                <br />
                (Next: we’ll add a “View RAM Matrix” button that opens your RAM
                image in a dialog.)
              </div> */}

              <div className="grid gap-3">
                {riskRows.map((r, idx) => (
                  <div
                    key={r.category}
                    className="rounded-xl border bg-background p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="font-medium">{r.category}</div>
                      <Badge className={ramBadgeClass(r.ramCell)}>
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
                          Likelihood (Probability)
                        </div>
                        <Select
                          value={String(r.likelihood || "A")}
                          onValueChange={(v) => {
                            const next = String(v || "A").toUpperCase();
                            setRiskRows((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, likelihood: next } : x,
                              ),
                            );
                            queueRisksSave();
                          }}
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
                          Justification (for this category)
                        </div>
                        <Textarea
                          value={r.justification ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRiskRows((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, justification: v } : x,
                              ),
                            );
                            queueRisksSave();
                          }}
                          rows={3}
                          placeholder="Why this severity/likelihood?"
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* MITIGATION */}
        <TabsContent value="mitigation" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Mitigation</CardTitle>
              <Button size="sm" onClick={saveMitigation} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={mitigations}
                onChange={(e) => {
                  const v = e.target.value;
                  setMitigations(v);
                  queuePatch({ mitigations: v });
                }}
                placeholder="Enter mitigations..."
                rows={8}
              />
              <div className="text-xs text-muted-foreground">
                List mitigations clearly and actionably.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ATTACHMENTS */}
        <TabsContent value="attachments" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Attachments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">Upload files</div>
                    <div className="text-xs text-muted-foreground">
                      PDF / PNG / JPG / WEBP — max 25MB each.
                    </div>
                  </div>
                  <label
                    htmlFor={uploadInputId}
                    className="cursor-pointer"
                    onClick={() => console.log("LABEL CLICK")}
                  >
                    <input
                      id={uploadInputId}
                      type="file"
                      multiple
                      className="sr-only" // hide from screen readers
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      disabled={!canUpload}
                      onChange={(e) => {
                        const fl = e.target.files;
                        console.log("INPUT onChange fired", {
                          filesCount: fl?.length ?? 0,
                          hasDeferral: !!deferral,
                          deferralId: deferral?.id,
                        });

                        // IMPORTANT: call upload first, then reset value
                        void uploadAttachments(fl);
                        e.target.value = "";
                      }}
                    />

                    <Button asChild disabled={!canUpload}>
                      <label htmlFor={uploadInputId} className="cursor-pointer">
                        <UploadCloud className="mr-2 h-4 w-4" />
                        Upload
                      </label>
                    </Button>

                    {!canUpload && deferral && (
                      <div className="text-xs text-muted-foreground">
                        Upload is disabled because status is{" "}
                        <b>{deferral.status}</b>. Only <b>DRAFT</b> or{" "}
                        <b>RETURNED</b> can upload attachments.
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div className="text-sm font-medium">Files</div>

              {attLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
