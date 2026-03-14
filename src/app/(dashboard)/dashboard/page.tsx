"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/src/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, RefreshCw, ArrowUpRight, ClipboardList } from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS } from "@/src/lib/constants";

type CountsResponse = {
  byStatus: Record<string, number>;
  byDeferralRank?: {
    first: number;
    second: number;
    third: number;
  };
  totals: { active: number; history: number; all: number };
  totalMatched: number;
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

export default function DashboardPage() {
  const [err, setErr] = useState<string | null>(null);

  const [loadingCounts, setLoadingCounts] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [recent, setRecent] = useState<Deferral[]>([]);
  const [globalCounts, setGlobalCounts] = useState<CountsResponse | null>(null);

  const fetchGlobalCounts = useCallback(async () => {
    setLoadingCounts(true);
    try {
      const c = await api<CountsResponse>(
        `/api/deferrals?mode=counts&scope=all`,
      );
      setGlobalCounts(c ?? null);
    } catch (e: any) {
      setErr(e.message ?? "Failed to load counts");
    } finally {
      setLoadingCounts(false);
    }

    const URL_RECENT_ITEMS =
      "/api/deferrals?mode=items&scope=all&pageSize=10&offset=0";

    // recent items
    setLoadingRecent(true);
    try {
      const r = await api<ItemsResponse>(URL_RECENT_ITEMS);
      setRecent(r?.items ?? []);
    } catch (e: any) {
      setErr((prev) => prev ?? e?.message ?? "Failed to load recent deferrals");
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobalCounts();
  }, [fetchGlobalCounts]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of deferrals and approvals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild className="gap-2">
            <Link href="/deferrals/new">
              <Plus className="h-4 w-4" />
              New Deferral
            </Link>
          </Button>
        </div>
      </div>

      {/* Error */}
      {err && (
        <Card className="rounded-2xl border border-destructive">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{err}</CardContent>
        </Card>
      )}

      {/* Stats: GLOBAL counts (never filtered) */}
      <div className="rounded-2xl border bg-card">
        <div className="p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-medium">Global status counts</div>
              <div className="text-xs text-muted-foreground">
                Always shows totals for the whole database (not affected by
                filters).
              </div>
            </div>

            <Button
              variant="outline"
              onClick={fetchGlobalCounts}
              disabled={loadingCounts}
            >
              <RefreshCw className="h-4 w-4" />

              {loadingCounts ? "Refreshing…" : "Refresh counts"}
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {(
              [
                "DRAFT",
                "IN_APPROVAL",
                "RETURNED",
                "REJECTED",
                "APPROVED",
                "COMPLETED",
              ] as const
            ).map((s) => (
              <Card
                key={s}
                className={`rounded-2xl ${STATUS_COLORS[s]} rounded-tl-2xl rounded-tr-2xl`}
              >
                <CardHeader
                  className={`flex flex-row items-center justify-between `}
                >
                  <CardTitle className="text-sm text-muted-foreground">
                    {STATUS_LABELS[s]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-2xl font-semibold">
                    {loadingCounts ? "…" : (globalCounts?.byStatus?.[s] ?? 0)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-3 mt-4">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  First deferrals
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-semibold">
                  {loadingCounts
                    ? "…"
                    : (globalCounts?.byDeferralRank?.first ?? 0)}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  Second deferrals
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-semibold">
                  {loadingCounts
                    ? "…"
                    : (globalCounts?.byDeferralRank?.second ?? 0)}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  Third deferrals
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-semibold">
                  {loadingCounts
                    ? "…"
                    : (globalCounts?.byDeferralRank?.third ?? 0)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Recent deferrals */}
      <Card className="rounded-2xl border bg-card/80 backdrop-blur">
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Recent deferrals</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Latest updated deferrals (top 10).
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <Separator />

          {loadingRecent ? (
            <div className="rounded-xl border bg-muted/30 p-6 text-sm text-muted-foreground">
              Loading recent deferrals…
            </div>
          ) : recent.length === 0 ? (
            <div className="rounded-xl border bg-muted/30 p-6 text-sm text-muted-foreground">
              No deferrals yet.
              <div className="mt-3">
                <Button asChild className="gap-2">
                  <Link href="/deferrals/new">
                    <Plus className="h-4 w-4" />
                    Create a deferral
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {recent.map((d) => (
                <Link
                  key={d.id}
                  href={`/deferrals/${d.id}`}
                  className="block rounded-xl border bg-muted/10 hover:bg-muted/30 transition-colors"
                >
                  <div className="p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium truncate">
                          {d.deferralCode}
                        </div>
                        <Badge className={STATUS_COLORS[d.status]}>
                          {STATUS_LABELS[d.status]}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground truncate">
                        Department: {d.initiatorDepartment}
                        {d.equipmentTag ? ` • ${d.equipmentTag}` : ""}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground whitespace-nowrap text-right">
                      Updated
                      <div className="font-medium text-foreground">
                        {fmtDT(d.updatedAt)}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}

              <div className="pt-1">
                <Button asChild variant="outline" className="gap-2">
                  <Link href="/deferrals?scope=all">
                    View all deferrals <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
