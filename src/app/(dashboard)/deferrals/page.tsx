"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/src/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATUS_LABELS, STATUS_COLORS } from "@/src/lib/constants";
import { Separator } from "@/components/ui/separator";
import { Search, Plus, ListChecks, History, CheckCircle2 } from "lucide-react";

type Deferral = {
  id: string;
  deferralCode: string;
  initiatorDepartment: string;
  status: keyof typeof STATUS_LABELS;
  createdAt: string;
  updatedAt: string;
  equipmentTag?: string | null;
};

type Scope = "active" | "history";

export default function DeferralsPage() {
  const searchParams = useSearchParams();
  const qsScope = (searchParams.get("scope") ?? "active").toLowerCase();
  const initialScope: Scope = qsScope === "history" ? "history" : "active";

  const [scope, setScope] = useState<Scope>(initialScope);

  // ✅ keep both datasets so counters are always correct
  const [activeItems, setActiveItems] = useState<Deferral[]>([]);
  const [historyItems, setHistoryItems] = useState<Deferral[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const next: Scope = qsScope === "history" ? "history" : "active";
    setScope(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qsScope]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [a, h] = await Promise.all([
        api<{ items: Deferral[] }>(`/api/deferrals?scope=active`),
        api<{ items: Deferral[] }>(`/api/deferrals?scope=history`),
      ]);

      setActiveItems(a.items ?? []);
      setHistoryItems(h.items ?? []);
    } catch (e: any) {
      setErr(e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const visibleItems = scope === "history" ? historyItems : activeItems;

  const filteredSorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = !needle
      ? visibleItems
      : visibleItems.filter((d) => {
          return (
            d.deferralCode?.toLowerCase().includes(needle) ||
            d.initiatorDepartment?.toLowerCase().includes(needle) ||
            (d.equipmentTag ?? "").toLowerCase().includes(needle)
          );
        });

    return [...filtered].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [visibleItems, q]);

  const stats = useMemo(() => {
    const drafts = activeItems.filter((x) => x.status === "DRAFT").length;
    const inApproval = activeItems.filter(
      (x) => x.status === "IN_APPROVAL",
    ).length;

    // if you want only COMPLETED (not approved/rejected)
    const completed = historyItems.filter(
      (x) => x.status === "COMPLETED",
    ).length;

    return { drafts, inApproval, completed };
  }, [activeItems, historyItems]);

  function onTabChange(v: string) {
    const next = (v === "history" ? "history" : "active") as Scope;
    setScope(next);
    const url = next === "history" ? "/deferrals?scope=history" : "/deferrals";
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deferrals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, track, and review deferrals through the workflow.
          </p>
        </div>

        <Button asChild className="gap-2">
          <Link href="/deferrals/new">
            <Plus className="h-4 w-4" />
            New Deferral
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="rounded-2xl border bg-card">
        <div className="p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm text-muted-foreground">
                  Drafts
                </CardTitle>
                <ListChecks className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-semibold">{stats.drafts}</div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm text-muted-foreground">
                  In approval
                </CardTitle>
                <History className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-semibold">{stats.inApproval}</div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm text-muted-foreground">
                  Completed
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-semibold">{stats.completed}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {err && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{err}</CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base">Browse</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Search by code, department, or equipment tag.
            </p>
          </div>

          <div className="relative md:w-[360px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              className="pl-9"
            />
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={scope} onValueChange={onTabChange}>
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <Separator className="my-4" />

            <TabsContent value="active">
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : filteredSorted.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No active deferrals.
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredSorted.map((d) => (
                    <Link
                      key={d.id}
                      href={`/deferrals/${d.id}`}
                      className="block"
                    >
                      <Card className="rounded-2xl hover:bg-muted/40 transition-colors">
                        <CardContent className="p-5 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="font-medium truncate">
                                {d.deferralCode}
                              </div>
                              <Badge className={STATUS_COLORS[d.status]}>
                                {STATUS_LABELS[d.status]}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              Department: {d.initiatorDepartment}
                              {d.equipmentTag ? ` • ${d.equipmentTag}` : ""}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap text-right">
                            Updated
                            <div className="font-medium text-foreground">
                              {new Date(d.updatedAt).toLocaleString()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history">
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : filteredSorted.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No history deferrals found.
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredSorted.map((d) => (
                    <Link
                      key={d.id}
                      href={`/deferrals/${d.id}`}
                      className="block"
                    >
                      <Card className="rounded-2xl hover:bg-muted/40 transition-colors">
                        <CardContent className="p-5 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="font-medium truncate">
                                {d.deferralCode}
                              </div>
                              <Badge className={STATUS_COLORS[d.status]}>
                                {STATUS_LABELS[d.status]}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              Department: {d.initiatorDepartment}
                              {d.equipmentTag ? ` • ${d.equipmentTag}` : ""}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap text-right">
                            Updated
                            <div className="font-medium text-foreground">
                              {new Date(d.updatedAt).toLocaleString()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
