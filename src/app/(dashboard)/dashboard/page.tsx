"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/src/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, RefreshCw, ArrowUpRight } from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS } from "@/src/lib/constants";

type CountsResponse = {
  byStatus: Record<string, number>;
  byDeferralRank?: { first: number; second: number; third: number };
  byDeferralRankActive?: { first: number; second: number; third: number };
  totals: { active: number; history: number; all: number };
  totalMatched: number;
};

type DeptStat = { department: string; counts: Record<string, number> };
type RankCounter = { total: number; active: number };

type DeptStatsResponse = {
  departments: DeptStat[];
  rankCounters: Record<string, RankCounter>;
  isManagement: boolean;
};

type Deferral = {
  id: string;
  deferralCode: string;
  initiatorDepartment: string;
  status: keyof typeof STATUS_LABELS;
  createdAt: string;
  updatedAt: string;
  equipmentTag?: string | null;
  deferralNumber?: number | null;
};

type ItemsResponse = {
  items: Deferral[];
  nextOffset: number | null;
};

function fmtDT(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

const DASHBOARD_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "IN_APPROVAL",
  "RETURNED",
  "REJECTED",
  "APPROVED",
  "COMPLETED",
  "CLOSED",
  "DELETED",
  "EXPIRED",
] as const;

export default function DashboardPage() {
  const [err, setErr] = useState<string | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingDept, setLoadingDept] = useState(true);

  const [recent, setRecent] = useState<Deferral[]>([]);
  const [globalCounts, setGlobalCounts] = useState<CountsResponse | null>(null);
  const [deptStats, setDeptStats] = useState<DeptStatsResponse | null>(null);

  const fetchAll = useCallback(async () => {
    setErr(null);
    setLoadingCounts(true);
    setLoadingRecent(true);
    setLoadingDept(true);

    try {
      const [c, ds, r] = await Promise.all([
        api<CountsResponse>(`/api/deferrals?mode=counts&scope=all`),
        api<DeptStatsResponse>(`/api/dashboard/dept-stats`),
        api<ItemsResponse>(
          `/api/deferrals?mode=items&scope=all&pageSize=10&offset=0`,
        ),
      ]);

      setGlobalCounts(c ?? null);
      setDeptStats(ds ?? null);
      setRecent(r?.items ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load dashboard");
    } finally {
      setLoadingCounts(false);
      setLoadingRecent(false);
      setLoadingDept(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const rankTotal = globalCounts?.byDeferralRank ?? {
    first: 0,
    second: 0,
    third: 0,
  };

  const rankActive = globalCounts?.byDeferralRankActive ?? {
    first: 0,
    second: 0,
    third: 0,
  };

  const rankCards = [
    { key: "first" as const, label: "1st Deferrals" },
    { key: "second" as const, label: "2nd Deferrals" },
    { key: "third" as const, label: "3rd Deferrals" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of deferrals, departments, and recent activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild className="gap-2">
            <Link href="/deferrals/new">
              <Plus className="h-4 w-4" />
              New Deferral
            </Link>
          </Button>

          <Button
            variant="outline"
            onClick={fetchAll}
            disabled={loadingCounts || loadingRecent || loadingDept}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {err && (
        <Card className="rounded-2xl border-destructive">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{err}</CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Global status counts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            {DASHBOARD_STATUSES.map((s) => (
              <Link key={s} href={`/deferrals?scope=all`}>
                <Card className="rounded-2xl hover:bg-muted/40 transition-colors">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate">
                        {STATUS_LABELS[s]}
                      </div>
                      <Badge className={STATUS_COLORS[s]}>
                        {STATUS_LABELS[s]}
                      </Badge>
                    </div>
                    <div className="text-2xl font-semibold">
                      {loadingCounts ? "…" : (globalCounts?.byStatus?.[s] ?? 0)}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Deferral rank counters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {rankCards.map((r) => (
              <Card key={r.key} className="rounded-2xl">
                <CardContent className="p-5 space-y-3">
                  <div className="font-medium">{r.label}</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Total</div>
                      <div className="text-2xl font-semibold">
                        {loadingCounts ? "…" : rankTotal[r.key]}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Active
                      </div>
                      <div className="text-2xl font-semibold text-green-700">
                        {loadingCounts ? "…" : rankActive[r.key]}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Active = new LAFD not yet elapsed.
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">
            Department status breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingDept ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : !deptStats || deptStats.departments.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No department data found.
            </div>
          ) : (
            <Tabs
              defaultValue={deptStats.departments[0]?.department}
              className="w-full"
            >
              <TabsList className="flex flex-wrap h-auto">
                {deptStats.departments.map((d) => (
                  <TabsTrigger key={d.department} value={d.department}>
                    {d.department}
                  </TabsTrigger>
                ))}
              </TabsList>

              {deptStats.departments.map((d) => (
                <TabsContent
                  key={d.department}
                  value={d.department}
                  className="mt-4"
                >
                  <div className="grid gap-3 md:grid-cols-4">
                    {DASHBOARD_STATUSES.map((s) => (
                      <Link
                        key={s}
                        href={`/deferrals?scope=all`}
                        className="block"
                      >
                        <Card className="rounded-2xl hover:bg-muted/40 transition-colors">
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-medium truncate">
                                {STATUS_LABELS[s]}
                              </div>
                              <Badge className={STATUS_COLORS[s]}>
                                {STATUS_LABELS[s]}
                              </Badge>
                            </div>
                            <div className="text-2xl font-semibold">
                              {d.counts?.[s] ?? 0}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Recent deferrals</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Latest updated deferrals across the system.
            </p>
          </div>

          <Button asChild variant="outline" className="gap-2">
            <Link href="/deferrals?scope=all">
              View all
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="space-y-3">
          {loadingRecent ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : recent.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No recent deferrals found.
            </div>
          ) : (
            recent.map((d, idx) => (
              <div key={d.id}>
                <Link
                  href={`/deferrals/${d.id}`}
                  className="block rounded-xl hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4 p-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium truncate">
                          {d.deferralCode}
                        </div>
                        <Badge className={STATUS_COLORS[d.status]}>
                          {STATUS_LABELS[d.status]}
                        </Badge>
                      </div>

                      <div className="text-sm text-muted-foreground truncate mt-1">
                        Department: {d.initiatorDepartment}
                        {d.equipmentTag ? ` • ${d.equipmentTag}` : ""}
                        {d.deferralNumber
                          ? ` • Deferral #${d.deferralNumber}`
                          : ""}
                      </div>
                    </div>

                    <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      Updated
                      <div className="font-medium text-foreground">
                        {fmtDT(d.updatedAt)}
                      </div>
                    </div>
                  </div>
                </Link>
                {idx < recent.length - 1 && <Separator />}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
