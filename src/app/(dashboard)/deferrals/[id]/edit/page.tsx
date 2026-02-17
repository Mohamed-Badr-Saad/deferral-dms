"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/src/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Deferral = {
  id: string;
  deferralCode: string;
  status: string;
  initiatorUserId: string;
  initiatorDepartment: string;

  workOrderNo: string;
  workOrderTitle: string;

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
};

function useDebouncedCallback<T extends (...args: any[]) => void>(
  fn: T,
  waitMs: number,
) {
  const t = useRef<any>(null);

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

  return { call, cancel, flush };
}

export default function DeferralEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const deferralId = params?.id;

  const [item, setItem] = useState<Deferral | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("basic");
  const [saving, setSaving] = useState(false);

  // Local draft state (what the form edits)
  const [draft, setDraft] = useState<Partial<Deferral>>({});

  const canEdit = useMemo(() => {
    if (!item) return false;
    return item.status === "DRAFT";
  }, [item]);

  async function load() {
    if (!deferralId) return;
    setLoading(true);
    try {
      const d = await api<{ item: Deferral }>(`/api/deferrals/${deferralId}`);
      setItem(d.item);
      setDraft(d.item); // initial form state
    } catch (e: any) {
      toast("Error", { description: e.message ?? "Failed to load" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferralId]);

  const saveDraft = useCallback(
    async (next: Partial<Deferral>) => {
      if (!deferralId) return;
      if (!canEdit) return;

      setSaving(true);
      try {
        const payload = {
          workOrderNo: next.workOrderNo ?? "",
          workOrderTitle: next.workOrderTitle ?? "",

          equipmentTag: next.equipmentTag ?? "",
          equipmentDescription: next.equipmentDescription ?? "",

          taskCriticality: next.taskCriticality ?? "",
          safetyCriticality: next.safetyCriticality ?? "",

          description: next.description ?? "",
          justification: next.justification ?? "",
          consequence: next.consequence ?? "",

          mitigations: next.mitigations ?? "",
        };

        const res = await api<{ item: Deferral }>(
          `/api/deferrals/${deferralId}`,
          {
            method: "PATCH",
            json: payload,
          },
        );

        setItem(res.item);
      } catch (e: any) {
        toast("Save failed", { description: e.message ?? "Server error" });
      } finally {
        setSaving(false);
      }
    },
    [deferralId, canEdit],
  );

  // Debounced autosave
  const debounced = useDebouncedCallback((next: Partial<Deferral>) => {
    saveDraft(next);
  }, 600);

  function update<K extends keyof Deferral>(key: K, value: Deferral[K]) {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      debounced.call(next);
      return next;
    });
  }

  // ✅ When switching tabs, force-save immediately so nothing is lost
  function onTabChange(v: string) {
    debounced.flush(draft);
    setTab(v);
  }

  async function done() {
    // final flush before leaving
    debounced.flush(draft);
    router.push(`/deferrals/${deferralId}`);
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

  if (!canEdit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Edit locked</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Only drafts can be edited.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold truncate">
            {item.deferralCode}
          </h1>
          <div className="mt-1 text-sm text-muted-foreground">
            Draft • {saving ? "Saving..." : "Saved"}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => router.push(`/deferrals/${item.id}`)}
          >
            Cancel
          </Button>
          <Button onClick={done}>Done</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Draft</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={onTabChange}>
            <TabsList>
              <TabsTrigger value="basic">Basic info</TabsTrigger>
              <TabsTrigger value="text">Description</TabsTrigger>
              <TabsTrigger value="mitigations">Mitigations</TabsTrigger>
              {/* later: Dates / RAM / Attachments */}
            </TabsList>

            <TabsContent value="basic" className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">
                    Work Order Number
                  </label>
                  <Input
                    value={draft.workOrderNo ?? ""}
                    onChange={(e) => update("workOrderNo", e.target.value)}
                    placeholder="WO-12345"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Work Order Title
                  </label>
                  <Input
                    value={draft.workOrderTitle ?? ""}
                    onChange={(e) => update("workOrderTitle", e.target.value)}
                    placeholder="Pump inspection"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Equipment Tag</label>
                  <Input
                    value={draft.equipmentTag ?? ""}
                    onChange={(e) => update("equipmentTag", e.target.value)}
                    placeholder="TAG-001"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Equipment Description
                  </label>
                  <Input
                    value={draft.equipmentDescription ?? ""}
                    onChange={(e) =>
                      update("equipmentDescription", e.target.value)
                    }
                    placeholder="Main feed pump"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Task Criticality
                  </label>
                  <Input
                    value={draft.taskCriticality ?? ""}
                    onChange={(e) => update("taskCriticality", e.target.value)}
                    placeholder="Yes / No (we’ll convert to dropdown later)"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Safety Criticality
                  </label>
                  <Input
                    value={draft.safetyCriticality ?? ""}
                    onChange={(e) =>
                      update("safetyCriticality", e.target.value)
                    }
                    placeholder="Yes / No (we’ll convert to dropdown later)"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="text" className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={draft.description ?? ""}
                  onChange={(e) => update("description", e.target.value)}
                  rows={5}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Justification</label>
                <Textarea
                  value={draft.justification ?? ""}
                  onChange={(e) => update("justification", e.target.value)}
                  rows={5}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Consequence</label>
                <Textarea
                  value={draft.consequence ?? ""}
                  onChange={(e) => update("consequence", e.target.value)}
                  rows={5}
                />
              </div>
            </TabsContent>

            <TabsContent value="mitigations" className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium">Mitigations</label>
                <Textarea
                  value={draft.mitigations ?? ""}
                  onChange={(e) => update("mitigations", e.target.value)}
                  rows={7}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
