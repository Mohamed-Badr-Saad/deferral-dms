"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/src/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type HistoryItem = {
  id: string;
  deferralCode: string;
  status: string;
  equipmentTag: string | null;
  equipmentDescription: string | null;
  lafdStartDate: string | null;
  lafdEndDate: string | null;
  ramCell: string | null;
  ramConsequenceLevel: string | null;
  updatedAt: string;
  createdAt: string | null;
};

export function WorkOrderHistoryTab(props: {
  workOrderNo: string;
  excludeId: string;
  onCountChange?: (count: number) => void;
}) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const wo = (props.workOrderNo ?? "").trim();

    if (!wo) {
      props.onCountChange?.(0);
      return;
    }

    setLoading(true);
    api<{ items: HistoryItem[] }>(
      `/api/work-orders/${encodeURIComponent(wo)}/deferrals?excludeId=${encodeURIComponent(
        props.excludeId,
      )}`,
    )
      .then((res) => {
        const list = res.items ?? [];
        setItems(list);
        props.onCountChange?.(list.length);
      })
      .catch((e: any) => toast.error(e?.message ?? "Failed to load history"))
      .finally(() => setLoading(false));
  }, [props.excludeId, props.workOrderNo]);

  if (!(props.workOrderNo ?? "").trim()) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No Work Order Number saved on this deferral yet. Add it in Details,
          then refresh.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Work Order History</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Other deferrals created under Work Order{" "}
          <span className="font-medium text-foreground">
            {props.workOrderNo}
          </span>
          .
        </div>

        <Separator />

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No previous deferrals found for this work order.
          </div>
        ) : (
          <div className="grid gap-2">
            {items.map((d) => (
              <Link
                key={d.id}
                href={`/deferrals/${d.id}`}
                className="rounded-xl border bg-background px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">
                        {d.deferralCode}
                      </div>
                      <Badge variant="secondary">{d.status}</Badge>
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground">
                      {d.equipmentTag ? (
                        <span className="font-mono">{d.equipmentTag}</span>
                      ) : (
                        "—"
                      )}{" "}
                      {d.equipmentDescription
                        ? `• ${d.equipmentDescription}`
                        : ""}
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground">
                      LAFD:{" "}
                      {d.lafdStartDate
                        ? new Date(d.lafdStartDate).toLocaleDateString()
                        : "—"}{" "}
                      →{" "}
                      {d.lafdEndDate
                        ? new Date(d.lafdEndDate).toLocaleDateString()
                        : "—"}
                      {"  "}• RAM: {d.ramCell || "—"}{" "}
                      {d.ramConsequenceLevel
                        ? `(${d.ramConsequenceLevel})`
                        : ""}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(d.updatedAt).toLocaleString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
