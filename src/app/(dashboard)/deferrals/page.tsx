"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/src/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  DEFERRAL_STATUS,
} from "@/src/lib/constants";
import { Plus, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

type Scope = "active" | "history" | "all";

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

type ItemsResponse = {
  items: Deferral[];
  nextOffset: number | null;
};

const DEPARTMENTS = [
  "Electrical",
  "Mechanical",
  "Instrument",
  "Turbo",
  "Civil",
  "HVAC",
  "Telecom",
  "Condition monitoring",
  "Inspection",
  "Painting",
  "Subsea control",
  "Production",
] as const;

export default function DeferralsPage() {
  const searchParams = useSearchParams();

  const qsScope = (searchParams.get("scope") ?? "active").toLowerCase();
  const ACTIVE_STATUSES = [
    "DRAFT",
    "SUBMITTED",
    "IN_APPROVAL",
    "RETURNED",
  ] as const;
  const HISTORY_STATUSES = ["COMPLETED", "APPROVED", "REJECTED"] as const;

  const initialScope: Scope =
    qsScope === "history" ? "history" : qsScope === "all" ? "all" : "active";

  const resultsScrollRef = useRef<HTMLDivElement | null>(null);

  // fetched dataset (single list based on filter scope)
  const [items, setItems] = useState<Deferral[]>([]);
  type ItemsResponse = {
    items: Deferral[];
    nextOffset: number | null;
  };

  const [globalCounts, setGlobalCounts] = useState<CountsResponse | null>(null);
  const [matchedTotal, setMatchedTotal] = useState<number>(0);

  const [loadingCounts, setLoadingCounts] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // "Draft filters" are what user is editing in the UI
  const [draftScope, setDraftScope] = useState<"active" | "history" | "all">(
    "all",
  );

  const [draftDepartment, setDraftDepartment] = useState<string>("ALL");
  const [draftStatus, setDraftStatus] = useState<string>("ALL");
  const [draftEquipmentTag, setDraftEquipmentTag] = useState("");
  const [draftUpdatedFrom, setDraftUpdatedFrom] = useState(""); // yyyy-mm-dd
  const [draftUpdatedTo, setDraftUpdatedTo] = useState(""); // yyyy-mm-dd
  const [draftDeferralCode, setDraftDeferralCode] = useState("");
  const [draftWorkOrderNo, setDraftWorkOrderNo] = useState("");
  const [draftDeferralRank, setDraftDeferralRank] = useState<string>("ALL");

  // "Applied filters" are what the backend uses
  const [appliedFilters, setAppliedFilters] = useState<null | {
    scope: Scope;
    department: string;
    status: string;
    deferralCode: string;
    workOrderNo: string;
    equipmentTag: string;
    updatedFromISO: string;
    updatedToISO: string;
    deferralRank: string;
  }>(null);

  const pageSize = 80;

  // sentinel for infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [nextOffset, setNextOffset] = useState<number | null>(null);
  // convert date input into ISO boundaries
  const makeUpdatedISO = useCallback((fromDate: string, toDate: string) => {
    let fromISO = "";
    let toISO = "";

    if (fromDate) {
      const d = new Date(fromDate);
      d.setHours(0, 0, 0, 0);
      fromISO = d.toISOString();
    }
    if (toDate) {
      const d = new Date(toDate);
      d.setHours(23, 59, 59, 999);
      toISO = d.toISOString();
    }
    return { fromISO, toISO };
  }, []);

  const buildQS = useCallback(
    (mode: "items" | "counts", offset?: number) => {
      const p = new URLSearchParams();
      p.set("mode", mode);

      const f = appliedFilters;
      if (!f) return p.toString();

      p.set("scope", f.scope);

      if (f.department) p.set("department", f.department);
      if (f.status && f.status !== "ALL") p.set("status", f.status);

      if (f.deferralCode) p.set("deferralCode", f.deferralCode);
      if (f.workOrderNo) p.set("workOrderNo", f.workOrderNo);
      if (f.equipmentTag) p.set("equipmentTag", f.equipmentTag);

      if (f.updatedFromISO) p.set("updatedFrom", f.updatedFromISO);
      if (f.updatedToISO) p.set("updatedTo", f.updatedToISO);
      if (f.deferralRank && f.deferralRank !== "ALL")
        p.set("deferralRank", f.deferralRank);

      if (mode === "items") {
        p.set("pageSize", String(pageSize));
        p.set("offset", String(offset ?? 0));
      }

      return p.toString();
    },
    [appliedFilters],
  );

  // Load counts quickly on mount (no filter needed, but we can show global counts)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingCounts(true);
      try {
        const c = await api<CountsResponse>(
          `/api/deferrals?mode=counts&scope=all`,
        );
        if (mounted) setGlobalCounts(c ?? null);
      } catch (e: any) {
        if (mounted) setErr(e.message ?? "Failed to load counts");
      } finally {
        if (mounted) setLoadingCounts(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const resetFilters = useCallback(() => {
    setDraftScope("all");
    setDraftDepartment("ALL");
    setDraftStatus("ALL");
    setDraftEquipmentTag("");
    setDraftUpdatedFrom("");
    setDraftUpdatedTo("");
    setAppliedFilters(null);
    setItems([]);
    setErr(null);
    setDraftDeferralCode("");
    setDraftWorkOrderNo("");
    setDraftDeferralRank("ALL");
  }, []);

  const fetchMatchedTotal = useCallback(
    async (filters: {
      scope: Scope;
      department: string;
      status: string;
      deferralCode: string;
      workOrderNo: string;
      equipmentTag: string;
      updatedFromISO: string;
      updatedToISO: string;
      deferralRank: string;
    }) => {
      const p = new URLSearchParams();
      p.set("mode", "counts");
      p.set("scope", filters.scope);

      if (filters.department) p.set("department", filters.department);
      if (filters.status && filters.status !== "ALL")
        p.set("status", filters.status);

      if (filters.deferralCode) p.set("deferralCode", filters.deferralCode);
      if (filters.workOrderNo) p.set("workOrderNo", filters.workOrderNo);
      if (filters.equipmentTag) p.set("equipmentTag", filters.equipmentTag);

      if (filters.updatedFromISO) p.set("updatedFrom", filters.updatedFromISO);
      if (filters.updatedToISO) p.set("updatedTo", filters.updatedToISO);
      if (filters.deferralRank !== "ALL")
        p.set("deferralRank", filters.deferralRank);

      const c = await api<CountsResponse>(`/api/deferrals?${p.toString()}`);
      setMatchedTotal(c?.totalMatched ?? 0);
    },
    [],
  );

  const applyFilters = useCallback(async () => {
    if (
      draftUpdatedFrom &&
      draftUpdatedTo &&
      draftUpdatedTo < draftUpdatedFrom
    ) {
      setErr("Updated To must be the same day or after Updated From.");
      return;
    }
    setErr(null);

    const dept = draftDepartment === "ALL" ? "" : draftDepartment;
    const st = draftStatus === "ALL" ? "ALL" : draftStatus;
    const equipmentTag = draftEquipmentTag.trim();

    const { fromISO, toISO } = makeUpdatedISO(draftUpdatedFrom, draftUpdatedTo);

    const newApplied = {
      scope: draftScope,
      department: dept,
      status: st,
      deferralCode: draftDeferralCode.trim(),
      workOrderNo: draftWorkOrderNo.trim(),
      equipmentTag: draftEquipmentTag.trim(),
      updatedFromISO: fromISO,
      updatedToISO: toISO,
      deferralRank: draftDeferralRank,
    };

    setAppliedFilters(newApplied);

    // Reset list + cursor then fetch first page
    setItems([]);
    setNextOffset(0);

    setLoadingItems(true);
    try {
      const qs = (() => {
        // Temporarily build qs without relying on appliedFilters state (since setState is async)
        const p = new URLSearchParams();
        p.set("offset", "0");
        p.set("mode", "items");
        p.set("scope", newApplied.scope);
        p.set("pageSize", String(pageSize));
        if (newApplied.department) p.set("department", newApplied.department);
        if (newApplied.equipmentTag)
          p.set("equipmentTag", newApplied.equipmentTag);
        if (newApplied.status !== "ALL") p.set("status", newApplied.status);
        if (newApplied.updatedFromISO)
          p.set("updatedFrom", newApplied.updatedFromISO);
        if (newApplied.updatedToISO)
          p.set("updatedTo", newApplied.updatedToISO);
        if (newApplied.deferralCode)
          p.set("deferralCode", newApplied.deferralCode);
        if (newApplied.workOrderNo)
          p.set("workOrderNo", newApplied.workOrderNo);
        if (newApplied.deferralRank !== "ALL")
          p.set("deferralRank", newApplied.deferralRank);
        return p.toString();
      })();

      const res = await api<ItemsResponse>(`/api/deferrals?${qs}`);
      setItems(res.items ?? []);
      setNextOffset(res.nextOffset ?? null);

      // refresh counts for the SAME filters (so cards represent filtered set)
      const qsCounts = (() => {
        const p = new URLSearchParams();
        p.set("mode", "counts");
        p.set("scope", newApplied.scope);
        if (newApplied.department) p.set("department", newApplied.department);
        if (newApplied.equipmentTag)
          p.set("equipmentTag", newApplied.equipmentTag);
        if (newApplied.status !== "ALL") p.set("status", newApplied.status);
        if (newApplied.updatedFromISO)
          p.set("updatedFrom", newApplied.updatedFromISO);
        if (newApplied.updatedToISO)
          p.set("updatedTo", newApplied.updatedToISO);
        if (newApplied.deferralCode)
          p.set("deferralCode", newApplied.deferralCode);
        if (newApplied.workOrderNo)
          p.set("workOrderNo", newApplied.workOrderNo);
        if (newApplied.deferralRank !== "ALL")
          p.set("deferralRank", newApplied.deferralRank);
        return p.toString();
      })();

      await fetchMatchedTotal(newApplied);

      const url =
        newApplied.scope === "history"
          ? "/deferrals?scope=history"
          : newApplied.scope === "all"
            ? "/deferrals?scope=all"
            : "/deferrals";
      window.history.replaceState(null, "", url);
    } catch (e: any) {
      setErr(e.message ?? "Failed to load deferrals");
    } finally {
      setLoadingItems(false);
    }
  }, [
    draftScope,
    draftDepartment,
    draftStatus,
    draftEquipmentTag,
    draftUpdatedFrom,
    draftUpdatedTo,
    draftDeferralCode,
    draftWorkOrderNo,
    makeUpdatedISO,
    fetchMatchedTotal,
  ]);

  const loadMore = useCallback(async () => {
    if (!appliedFilters) return;
    if (nextOffset == null) return;
    if (loadingMore || loadingItems) return;

    setLoadingMore(true);
    try {
      const qs = buildQS("items", nextOffset);
      const res = await api<ItemsResponse>(`/api/deferrals?${qs}`);

      const newItems = res.items ?? [];
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        for (const it of newItems) if (!seen.has(it.id)) merged.push(it);
        return merged;
      });

      setNextOffset(res.nextOffset ?? null);
    } catch (e: any) {
      setErr(e.message ?? "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }, [appliedFilters, nextOffset, loadingMore, loadingItems, buildQS]);

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
  }, []);

  const refreshResults = useCallback(async () => {
    if (!appliedFilters) return;

    setErr(null);
    setLoadingItems(true);
    try {
      // fetch first page again
      const p = new URLSearchParams();
      p.set("mode", "items");
      p.set("scope", appliedFilters.scope);
      p.set("pageSize", String(pageSize));
      p.set("offset", "0");

      if (appliedFilters.department)
        p.set("department", appliedFilters.department);
      if (appliedFilters.status && appliedFilters.status !== "ALL")
        p.set("status", appliedFilters.status);

      if (appliedFilters.deferralCode)
        p.set("deferralCode", appliedFilters.deferralCode);
      if (appliedFilters.workOrderNo)
        p.set("workOrderNo", appliedFilters.workOrderNo);
      if (appliedFilters.equipmentTag)
        p.set("equipmentTag", appliedFilters.equipmentTag);

      if (appliedFilters.updatedFromISO)
        p.set("updatedFrom", appliedFilters.updatedFromISO);
      if (appliedFilters.updatedToISO)
        p.set("updatedTo", appliedFilters.updatedToISO);

      const res = await api<ItemsResponse>(`/api/deferrals?${p.toString()}`);

      setItems(res.items ?? []);
      setNextOffset(res.nextOffset ?? null);

      // refresh matched total (still filtered)
      await fetchMatchedTotal(appliedFilters);
    } catch (e: any) {
      setErr(e.message ?? "Failed to refresh results");
    } finally {
      setLoadingItems(false);
    }
  }, [appliedFilters, pageSize, fetchMatchedTotal]);

  // infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const rootEl = resultsScrollRef.current;

    if (!sentinel || !rootEl) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) loadMore();
      },
      {
        root: rootEl, // ✅ observe inside the card scroll area
        rootMargin: "400px", // preload before reaching the end
        threshold: 0,
      },
    );

    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [loadMore]);

  const stats = useMemo(() => {
    const by = globalCounts?.byStatus ?? {};
    const get = (k: string) => by[k] ?? 0;
    return {
      DRAFT: get("DRAFT"),
      SUBMITTED: get("SUBMITTED"),
      RETURNED: get("RETURNED"),
      IN_APPROVAL: get("IN_APPROVAL"),
      REJECTED: get("REJECTED"),
      APPROVED: get("APPROVED"),
      COMPLETED: get("COMPLETED"),
    };
  }, [globalCounts]);

  const statusOptions = useMemo(() => {
    if (draftScope === "active") return ACTIVE_STATUSES;
    if (draftScope === "history") return HISTORY_STATUSES;
    return DEFERRAL_STATUS; // "all"
  }, [draftScope]);

  useEffect(() => {
    // If user had a status that doesn't belong to the new scope, reset it.
    if (draftStatus === "ALL") return;

    const allowed =
      draftScope === "active"
        ? ACTIVE_STATUSES
        : draftScope === "history"
          ? HISTORY_STATUSES
          : DEFERRAL_STATUS;

    if (!allowed.includes(draftStatus as any)) {
      setDraftStatus("ALL");
    }
  }, [draftScope, draftStatus]);

  useEffect(() => {
    if (
      draftUpdatedFrom &&
      draftUpdatedTo &&
      draftUpdatedTo < draftUpdatedFrom
    ) {
      setDraftUpdatedTo("");
    }
  }, [draftUpdatedFrom, draftUpdatedTo]);

  useEffect(() => {
    fetchGlobalCounts();
  }, [fetchGlobalCounts]);

  const totalMatched = matchedTotal ?? 0;
  const loaded = items.length;
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deferrals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use filters to fetch the deferrals you want, then scroll to load
            more.
          </p>
        </div>

        <Button asChild className="gap-2">
          <Link href="/deferrals/new">
            <Plus className="h-4 w-4" />
            New Deferral
          </Link>
        </Button>
      </div>

      {/* Stats: GLOBAL counts (never filtered) */}
      {/* <div className="rounded-2xl border bg-card">
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
        </div>
      </div> */}

      {err && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{err}</CardContent>
        </Card>
      )}

      {/* Filters panel (apply-first) */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Filters</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Set filters then click <b>Apply</b>. Results load in pages as you
            scroll.
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Row 1: Scope / Department / Status */}
          <div className="grid gap-3 md:grid-cols-4">
            {/* Scope (recommended) */}
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Scope</div>
              <Select
                value={draftScope}
                onValueChange={(v) => setDraftScope(v as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="history">History</SelectItem>
                  <SelectItem value="all">All deferrals</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department */}
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Department</div>
              <Select
                value={draftDepartment}
                onValueChange={setDraftDepartment}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All departments</SelectItem>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Status</div>
              <Select value={draftStatus} onValueChange={setDraftStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    {draftScope === "active"
                      ? "All active statuses"
                      : draftScope === "history"
                        ? "All history statuses"
                        : "All statuses"}
                  </SelectItem>{" "}
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deferral Rank */}
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">
                Deferral number
              </div>
              <Select
                value={draftDeferralRank}
                onValueChange={setDraftDeferralRank}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Deferral number" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All deferrals</SelectItem>
                  <SelectItem value="1">First deferral</SelectItem>
                  <SelectItem value="2">Second deferral</SelectItem>
                  <SelectItem value="3">Third deferral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Deferral Code / Work Order No / Equipment Tag */}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Deferral code</div>
              <Input
                value={draftDeferralCode}
                onChange={(e) => setDraftDeferralCode(e.target.value)}
                placeholder="e.g. WDDM-N-ABC123"
              />
              <div className="text-[11px] text-muted-foreground">
                Partial match (contains).
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">
                Work order number
              </div>
              <Input
                value={draftWorkOrderNo}
                onChange={(e) => setDraftWorkOrderNo(e.target.value)}
                placeholder="e.g. WO-000123"
              />
              <div className="text-[11px] text-muted-foreground">
                Partial match (contains).
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">
                Equipment Full Code
              </div>
              <Input
                value={draftEquipmentTag}
                onChange={(e) => setDraftEquipmentTag(e.target.value)}
                placeholder="e.g. .../.../.../.../..."
              />
              <div className="text-[11px] text-muted-foreground">
                Partial match (contains).
              </div>
            </div>
          </div>

          {/* Row 3: Updated range */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Updated from</div>
              <Input
                type="date"
                value={draftUpdatedFrom}
                onChange={(e) => setDraftUpdatedFrom(e.target.value)}
              />
              <div className="text-[11px] text-muted-foreground">
                Includes items updated <b>from the start of this day</b>.
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Updated to</div>
              <Input
                type="date"
                value={draftUpdatedTo}
                min={draftUpdatedFrom || undefined}
                onChange={(e) => setDraftUpdatedTo(e.target.value)}
              />
              <div className="text-[11px] text-muted-foreground">
                Includes items updated <b>until the end of this day</b>.
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={applyFilters} disabled={loadingItems}>
              {loadingItems ? "Fetching..." : "Apply"}
            </Button>
            <Button
              variant="outline"
              onClick={resetFilters}
              disabled={loadingItems || loadingMore}
            >
              Reset
            </Button>

            <div className="text-xs text-muted-foreground">
              {appliedFilters
                ? `Matched ${totalMatched} deferral(s). Loaded ${loaded}. ${nextOffset != null ? "Scroll to load more." : "End of results."}`
                : "No results fetched yet. Apply filters to fetch."}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <CardTitle className="text-base">Results</CardTitle>
            <p className="text-sm text-muted-foreground">
              Results are ordered by <b>Updated At</b> (newest first).
            </p>
            {appliedFilters && (
              <p className="text-xs text-muted-foreground">
                Matched <b>{matchedTotal}</b> deferral(s). Loaded{" "}
                <b>{items.length}</b>.
              </p>
            )}
          </div>

          <Button
            variant="outline"
            onClick={refreshResults}
            disabled={!appliedFilters || loadingItems || loadingMore}
          >
            {loadingItems ? "Refreshing…" : "Refresh results"}
          </Button>
        </CardHeader>

        <CardContent
          ref={resultsScrollRef}
          className="max-h-[65vh] overflow-y-auto"
        >
          {" "}
          {!appliedFilters ? (
            <div className="text-sm text-muted-foreground">
              Apply filters to fetch deferrals.
            </div>
          ) : items.length === 0 && !loadingItems ? (
            <div className="text-sm text-muted-foreground">
              No deferrals matched your filters.
            </div>
          ) : (
            <div className="grid gap-3">
              {items.map((d) => (
                <Link key={d.id} href={`/deferrals/${d.id}`} className="block">
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
                          {d.deferralNumber
                            ? ` • ${d.deferralNumber}${d.deferralNumber === 1 ? "st" : d.deferralNumber === 2 ? "nd" : "rd"} deferral`
                            : ""}
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

              {/* infinite scroll sentinel */}
              <div ref={sentinelRef} />

              {loadingMore && (
                <div className="text-sm text-muted-foreground">
                  Loading more…
                </div>
              )}

              {!loadingMore &&
                appliedFilters &&
                items.length > 0 &&
                nextOffset == null && (
                  <div className="text-sm text-muted-foreground">
                    End of results.
                  </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
