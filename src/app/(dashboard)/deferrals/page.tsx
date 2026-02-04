"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/src/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATUS_LABELS, STATUS_COLORS } from "@/src/lib/constants";

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
  const [items, setItems] = useState<Deferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // Keep tab in sync if user navigates via sidebar link
  useEffect(() => {
    const next: Scope = qsScope === "history" ? "history" : "active";
    setScope(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qsScope]);

  async function load(nextScope: Scope) {
    setLoading(true);
    setErr(null);
    try {
      const res = await api<{ items: Deferral[] }>(
        `/api/deferrals?scope=${nextScope}`,
      );
      setItems(res.items ?? []);
    } catch (e: any) {
      setErr(e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const filteredSorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = !needle
      ? items
      : items.filter((d) => {
          return (
            d.deferralCode?.toLowerCase().includes(needle) ||
            d.initiatorDepartment?.toLowerCase().includes(needle) ||
            (d.equipmentTag ?? "").toLowerCase().includes(needle)
          );
        });

    return [...filtered].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [items, q]);

  function onTabChange(v: string) {
    const next = (v === "history" ? "history" : "active") as Scope;
    setScope(next);

    // Sync URL so Sidebar "History" link and refresh keeps correct tab
    const url = next === "history" ? "/deferrals?scope=history" : "/deferrals";
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Deferrals</h1>
          <p className="text-sm text-muted-foreground">
            Create, track, and review deferrals through the workflow.
          </p>
        </div>

        <Button asChild>
          <Link href="/deferrals/new">New Deferral</Link>
        </Button>
      </div>

      {err && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{err}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">Browse</CardTitle>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by code, department, equipment..."
            className="md:max-w-sm"
          />
        </CardHeader>

        <CardContent>
          <Tabs value={scope} onValueChange={onTabChange}>
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : filteredSorted.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No active deferrals. Create one to get started.
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredSorted.map((d) => (
                    <Link
                      key={d.id}
                      href={`/deferrals/${d.id}`}
                      className="block"
                    >
                      <Card className="hover:bg-muted/40 transition-colors">
                        <CardContent className="p-6 flex items-center justify-between gap-4">
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
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            Updated: {new Date(d.updatedAt).toLocaleString()}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : filteredSorted.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No history deferrals found.
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredSorted.map((d) => (
                    <Link
                      key={d.id}
                      href={`/deferrals/${d.id}`}
                      className="block"
                    >
                      <Card className="hover:bg-muted/40 transition-colors">
                        <CardContent className="p-6 flex items-center justify-between gap-4">
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
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            Updated: {new Date(d.updatedAt).toLocaleString()}
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
