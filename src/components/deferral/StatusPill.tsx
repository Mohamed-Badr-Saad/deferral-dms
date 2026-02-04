import { STATUS_LABELS, STATUS_COLORS, type DeferralStatus } from "@/src/lib/constants";

export function StatusPill({ status }: { status: DeferralStatus | string }) {
  const s = status as DeferralStatus;
  const label = (STATUS_LABELS as any)[s] ?? status;
  const cls = (STATUS_COLORS as any)[s] ?? "bg-muted text-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
