"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, RefreshCw, CheckCheck } from "lucide-react";
import { useNotifications } from "@/src/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function timeAgo(dateIso: string) {
  const d = new Date(dateIso).getTime();
  const now = Date.now();
  const sec = Math.max(1, Math.floor((now - d) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { items, unreadCount, loading, error, markRead, markAllRead, reload } =
    useNotifications({ limit: 20, pollMs: 10_000, paused: open });

  const hasUnread = unreadCount > 0;
  const topItems = useMemo(() => items.slice(0, 10), [items]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted outline-none transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {hasUnread && (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground shadow-sm">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[420px] p-0 overflow-hidden rounded-2xl"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">
            Notifications
          </DropdownMenuLabel>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={(e) => {
                e.preventDefault();
                reload();
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              disabled={unreadCount === 0}
              onClick={(e) => {
                e.preventDefault();
                markAllRead();
              }}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark all
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator />

        <div className="max-h-[460px] overflow-auto">
          {loading ? (
            <div className="px-4 py-4 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : error ? (
            <div className="px-4 py-4 text-sm text-destructive">{error}</div>
          ) : topItems.length === 0 ? (
            <div className="px-4 py-8">
              <div className="text-sm font-medium">You’re all caught up</div>
              <div className="mt-1 text-sm text-muted-foreground">
                No notifications yet.
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {topItems.map((n) => (
                <button
                  key={n.id}
                  className={[
                    "w-full text-left px-4 py-3 transition-colors",
                    "focus:outline-none focus:bg-muted/70",
                    n.isRead
                      ? "bg-background hover:bg-muted/40"
                      : "bg-muted/50 hover:bg-muted",
                  ].join(" ")}
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (!n.isRead) {
                      await markRead(n.id);
                    }

                    if (n.deferralId) {
                      router.push(`/deferrals/${n.deferralId}`);
                      setOpen(false);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {!n.isRead && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                        <div className="text-sm font-semibold truncate">
                          {n.title}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {n.body}
                      </div>
                    </div>

                    <div className="shrink-0 text-[11px] text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        <div className="px-4 py-2 text-xs text-muted-foreground">
          Showing latest 10
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
