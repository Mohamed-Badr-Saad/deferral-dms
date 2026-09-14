import webpush from "web-push";
import { db } from "@/src/db";
import { pushSubscriptions } from "@/src/db/schema";
import { eq } from "drizzle-orm";

let configured = false;

function ensureConfigured() {
  if (configured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

  if (!publicKey || !privateKey) {
    // Push notifications are optional: if VAPID keys aren't configured yet,
    // silently skip sending so the rest of the app keeps working.
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Best-effort web push to every browser subscription on file for a user.
 * Never throws — a missing/expired subscription is pruned, any other
 * delivery failure is swallowed (push is a bonus channel; the in-app
 * `notifications` row created by the caller is always the source of truth).
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!ensureConfigured()) return;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/dashboard",
    tag: payload.tag,
  });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
      } catch (err: any) {
        const statusCode = err?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription is gone (browser data cleared, permission revoked,
          // endpoint rotated) — remove it so we stop retrying it forever.
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id))
            .catch(() => {});
        }
        // Any other error (offline push service, transient failure, etc.)
        // is logged but not fatal to the caller's own request.
        console.error("web-push send failed:", statusCode ?? err?.message ?? err);
      }
    }),
  );
}
