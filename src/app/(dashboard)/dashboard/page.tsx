"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/src/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, RefreshCw, ArrowUpRight } from "lucide-react";
import { DEFERRAL_STATUS, STATUS_LABELS, STATUS_COLORS } from "@/src/lib/constants";

type DeptStat = { department: string; counts: Record<string, number> };
type RankCounter = { total: number; active: number };

type DeptStatsResponse = {
  departments: DeptStat[];
  rankCounters: Record<string, RankCounter>;
  isManagement: boolean;
  scopeDepartment: string | null;
  recent: Deferral[];
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

function fmtDT(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

const DASHBOARD_STATUSES = DEFERRAL_STATUS.filter(
  (status) => status !== "SUBMITTED",
);

export default function DashboardPage() {
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deptStats, setDeptStats] = useState<DeptStatsResponse | null>(null);

  const fetchAll = useCallback(async () => {
    setErr(null);
    setLoading(true);

    try {
      const ds = await api<DeptStatsResponse>(`/api/dashboard/dept-stats`);
      setDeptStats(ds ?? null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const statusCounts = useMemo(() => {
    const totals = Object.fromEntries(
      DASHBOARD_STATUSES.map((status) => [status, 0]),
    ) as Record<string, number>;

    for (const department of deptStats?.departments ?? []) {
      for (const status of DASHBOARD_STATUSES) {
        totals[status] += department.counts?.[status] ?? 0;
      }
    }

    return totals;
  }, [deptStats]);

  const rankTotal = {
    first: deptStats?.rankCounters?.["1"]?.total ?? 0,
    second: deptStats?.rankCounters?.["2"]?.total ?? 0,
    third: deptStats?.rankCounters?.["3"]?.total ?? 0,
  };

  const rankActive = {
    first: deptStats?.rankCounters?.["1"]?.active ?? 0,
    second: deptStats?.rankCounters?.["2"]?.active ?? 0,
    third: deptStats?.rankCounters?.["3"]?.active ?? 0,
  };

  const rankCards = [
    { key: "first" as const, label: "1st Deferrals" },
    { key: "second" as const, label: "2nd Deferrals" },
    { key: "third" as const, label: "3rd Deferrals" },
  ];

  const scopeDepartment = deptStats?.scopeDepartment ?? null;
  const statusCardTitle = deptStats?.isManagement
    ? "Global status counts"
    : scopeDepartment
      ? `${scopeDepartment} status counts`
      : "Department status counts";

  const recentDescription = deptStats?.isManagement
    ? "Latest updated deferrals across the system."
    : scopeDepartment
      ? `Latest updated deferrals in ${scopeDepartment}.`
      : "Latest updated deferrals in your department.";

  function buildDeferralsHref(options?: {
    department?: string | null;
    status?: string | null;
  }) {
    const params = new URLSearchParams();
    params.set("scope", "all");

    if (options?.department) {
      params.set("department", options.department);
    }

    if (options?.status) {
      params.set("status", options.status);
    }

    return `/deferrals?${params.toString()}`;
  }

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
            disabled={loading}
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
          <CardTitle className="text-base">{statusCardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            {DASHBOARD_STATUSES.map((s) => (
              <Link
                key={s}
                href={buildDeferralsHref({
                  department: scopeDepartment,
                  status: s,
                })}
              >
                <Card className="rounded-2xl hover:bg-muted/40 transition-colors">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 text-sm font-medium">
                        {STATUS_LABELS[s]}
                      </div>
                      <Badge className={`${STATUS_COLORS[s]} shrink-0`}>
                        {STATUS_LABELS[s]}
                      </Badge>
                    </div>
                    <div className="text-2xl font-semibold">
                      {loading ? "…" : (statusCounts[s] ?? 0)}
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
                        {loading ? "…" : rankTotal[r.key]}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Active
                      </div>
                      <div className="text-2xl font-semibold text-green-700">
                        {loading ? "…" : rankActive[r.key]}
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
          {loading ? (
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
              <div className="overflow-x-auto pb-2">
                <TabsList className="inline-flex h-auto min-w-max gap-1 rounded-xl bg-muted/60 p-1">
                  {deptStats.departments.map((d) => (
                    <TabsTrigger
                      key={d.department}
                      value={d.department}
                      className="whitespace-nowrap rounded-lg px-3 py-1.5"
                    >
                      {d.department}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

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
                        href={buildDeferralsHref({
                          department: d.department,
                          status: s,
                        })}
                        className="block"
                      >
                        <Card className="rounded-2xl hover:bg-muted/40 transition-colors">
                          <CardContent className="p-4 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0 text-sm font-medium">
                                {STATUS_LABELS[s]}
                              </div>
                              <Badge className={`${STATUS_COLORS[s]} shrink-0`}>
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
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base">Recent deferrals</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {recentDescription}
            </p>
          </div>

          <Button asChild variant="outline" className="w-full gap-2 sm:w-auto">
            <Link href={buildDeferralsHref({ department: scopeDepartment })}>
              View all
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (deptStats?.recent?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground">
              No recent deferrals found.
            </div>
          ) : (
            (deptStats?.recent ?? []).map((d, idx) => (
              <div key={d.id}>
                <Link
                  href={`/deferrals/${d.id}`}
                  className="block min-w-0 rounded-xl hover:bg-muted/40 transition-colors"
                >
                  <div className="flex min-w-0 flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <div className="min-w-0 max-w-full truncate font-medium">
                          {d.deferralCode}
                        </div>
                        <Badge className={`${STATUS_COLORS[d.status]} shrink-0`}>
                          {STATUS_LABELS[d.status]}
                        </Badge>
                      </div>

                      <div className="mt-1 break-words text-sm text-muted-foreground">
                        Department: {d.initiatorDepartment}
                        {d.equipmentTag ? ` • ${d.equipmentTag}` : ""}
                        {d.deferralNumber
                          ? ` • Deferral #${d.deferralNumber}`
                          : ""}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground sm:whitespace-nowrap sm:text-right">
                      Updated
                      <div className="font-medium text-foreground">
                        {fmtDT(d.updatedAt)}
                      </div>
                    </div>
                  </div>
                </Link>
                {idx < (deptStats?.recent?.length ?? 0) - 1 && <Separator />}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
