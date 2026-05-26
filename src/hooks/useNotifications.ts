"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type NotificationItem = {
  id: string;
  userId: string;
  deferralId: string | null;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  // ✅ include snapshots in type
  deferralCodeSnapshot: string | null;
  equipmentTagSnapshot: string | null;
};

type ApiRes = {
  items: NotificationItem[];
  unreadCount: number | string;
  nextCursor: string | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useNotifications(opts?: {
  limit?: number;
  pollMs?: number;
  paused?: boolean;
  summaryOnly?: boolean;
}) {
  const limit = opts?.limit ?? 20;
  const pollMs = opts?.pollMs ?? 10_000;
  const summaryOnly = opts?.summaryOnly ?? false;

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);

  const load = useCallback(async (options?: { summaryOnly?: boolean }) => {
    const onlySummary = options?.summaryOnly ?? summaryOnly;

    try {
      if (!onlySummary) setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: String(limit) });
      if (onlySummary) params.set("summary", "1");

      const res = await fetch(`/api/notifications?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Failed to load notifications (${res.status})`);
      }

      const json = (await res.json()) as ApiRes;
      if (!onlySummary) setItems(json.items ?? []);

      // ✅ always coerce to number
      const n = Number(json.unreadCount ?? 0);
      setUnreadCount(Number.isFinite(n) ? n : 0);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load notifications"));
    } finally {
      setLoading(false);
    }
  }, [limit, summaryOnly]);

  const markRead = useCallback(
    async (id: string) => {
      // optimistic mark read in list
      setItems((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n,
        ),
      );

      try {
        const res = await fetch(`/api/notifications/${id}/read`, {
          method: "POST",
        });
        if (!res.ok) {
          // fallback to authoritative reload
          await load();
          return;
        }

        const json = (await res.json().catch(() => null)) as
          | Partial<ApiRes>
          | null;
        if (json && typeof json.unreadCount !== "undefined") {
          setUnreadCount(Number(json.unreadCount) || 0);
        } else {
          await load();
        }
      } catch {
        await load();
      }
    },
    [load],
  );

  const markAllRead = useCallback(async () => {
    // optimistic
    setItems((prev) =>
      prev.map((n) => ({
        ...n,
        isRead: true,
        readAt: n.readAt ?? new Date().toISOString(),
      })),
    );
    setUnreadCount(0);

    try {
      const res = await fetch(`/api/notifications/read-all`, {
        method: "POST",
      });
      if (!res.ok) {
        await load();
        return;
      }

      const json = (await res.json().catch(() => null)) as
        | Partial<ApiRes>
        | null;
      if (json && typeof json.unreadCount !== "undefined") {
        setUnreadCount(Number(json.unreadCount) || 0);
      } else {
        await load();
      }
    } catch {
      await load();
    }
  }, [load]);

  const paused = opts?.paused ?? false;

  useEffect(() => {
    load({ summaryOnly });

    if (pollMs > 0 && !paused) {
      timerRef.current = window.setInterval(() => {
        if (!document.hidden) {
          load({ summaryOnly });
        }
      }, pollMs);
    }

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [load, pollMs, paused, summaryOnly]);

  return {
    items,
    unreadCount,
    loading,
    error,
    reload: load,
    markRead,
    markAllRead,
  };
}
