"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const DISMISS_STORAGE_KEY = "dms.pushPromptDismissedAt";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers the service worker and creates/refreshes the browser's push
 * subscription on the server. Throws (with a specific reason) instead of
 * failing silently — a silent failure here means "permission granted, but
 * no push ever arrives," which is impossible to self-diagnose from the UI.
 * Callers decide whether a given failure deserves a user-visible toast.
 */
async function subscribeForPush(): Promise<void> {
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const keyRes = await fetch("/api/push/public-key");
  if (!keyRes.ok) {
    if (keyRes.status === 503) {
      throw new Error(
        "Push notifications aren't configured on this server yet (missing VAPID keys).",
      );
    }
    throw new Error(`Could not fetch push key (HTTP ${keyRes.status}).`);
  }
  const { key } = (await keyRes.json()) as { key: string };
  if (!key) throw new Error("Server returned an empty push key.");

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }

  const json = subscription.toJSON();
  const subRes = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  if (!subRes.ok) {
    throw new Error(`Server rejected the subscription (HTTP ${subRes.status}).`);
  }
}

/**
 * Mounted once in the dashboard layout. Silently re-syncs an existing
 * subscription on every load when permission is already granted (logging,
 * not toasting, on failure — this runs on every page load and shouldn't
 * nag), and shows a small dismissible prompt asking the visitor to enable
 * browser notifications when permission hasn't been decided yet. Never
 * shows anything if the browser doesn't support Push/Notifications, or if
 * permission was already denied (the browser itself blocks re-prompting).
 */
export function PushNotificationsPrompt() {
  const [supported, setSupported] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return;
    }
    setSupported(true);

    if (Notification.permission === "granted") {
      // Returning visitor who already said yes: make sure the subscription
      // is (still) registered without bothering them again. Failures here
      // are logged (so DevTools console shows the real reason) but not
      // toasted on every page load.
      subscribeForPush().catch((err) => {
        console.error("[push] background re-subscribe failed:", err?.message ?? err);
      });
      return;
    }

    if (Notification.permission === "denied") {
      return; // browser controls this now; we can't re-prompt via JS
    }

    const dismissedAt = Number(localStorage.getItem(DISMISS_STORAGE_KEY) ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) {
      return;
    }

    setShowPrompt(true);
  }, []);

  if (!supported || !showPrompt) return null;

  async function handleEnable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await subscribeForPush();
        toast("Notifications enabled", {
          description: "You'll get browser alerts for actions that need you.",
        });
      } else if (permission === "denied") {
        toast("Notifications blocked", {
          description:
            "You can re-enable them later from your browser's site settings.",
        });
      }
    } catch (err: any) {
      console.error("[push] enable failed:", err?.message ?? err);
      toast.error("Couldn't enable notifications", {
        description: err?.message ?? "Please try again, or check the browser console.",
      });
    } finally {
      setBusy(false);
      setShowPrompt(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    setShowPrompt(false);
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:right-6 sm:w-[360px]">
      <div className="flex items-start gap-3 rounded-2xl border bg-background p-4 shadow-lg">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bell className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Enable notifications</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Get alerted the moment a deferral needs your action — even when
            this tab isn&apos;t open.
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleEnable} disabled={busy}>
              {busy ? "Enabling..." : "Enable"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} disabled={busy}>
              Not now
            </Button>
          </div>
        </div>
        <button
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground"
          onClick={handleDismiss}
          disabled={busy}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
