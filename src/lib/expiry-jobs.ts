import { randomUUID } from "crypto";
import { db } from "@/src/db";
import { deferrals, notifications, users } from "@/src/db/schema";
import { and, between, eq, gt, ilike, inArray, lt, sql } from "drizzle-orm";

const EXPIRY_NOTIFICATION_TITLE_PREFIX = "Deferral expiring soon:";
const EXPIRY_ELIGIBLE_STATUSES = ["COMPLETED"] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type ExpiryJobOptions = {
  now: Date;
  windowDays: number;
  cooldownDays: number;
};

export function getCronAuthError(request: Request): string | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return "CRON_SECRET is not configured.";
  }

  const authHeader = request.headers.get("authorization");
  const legacySecret = request.headers.get("x-cron-secret");

  if (authHeader === `Bearer ${secret}` || legacySecret === secret) {
    return null;
  }

  return "Unauthorized";
}

export function parseJobDateInput(value: string | null, fallback: Date) {
  if (!value) return { value: fallback, error: null as string | null };

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return {
      value: fallback,
      error: `Invalid date value: ${value}`,
    };
  }

  return { value: parsed, error: null as string | null };
}

export function parsePositiveIntInput(
  value: string | null,
  fallback: number,
  label: string,
) {
  if (!value) return { value: fallback, error: null as string | null };

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return {
      value: fallback,
      error: `${label} must be a non-negative integer.`,
    };
  }

  return { value: parsed, error: null as string | null };
}

export async function runExpiryNotifications(options: ExpiryJobOptions) {
  const { now, windowDays, cooldownDays } = options;
  const inWindow = new Date(now.getTime() + windowDays * MS_PER_DAY);
  const cooldownCutoff = new Date(now.getTime() - cooldownDays * MS_PER_DAY);

  const expiring = await db
    .select()
    .from(deferrals)
    .where(
      and(
        inArray(deferrals.status, [...EXPIRY_ELIGIBLE_STATUSES] as any),
        between(deferrals.lafdEndDate, now, inWindow),
      ),
    );

  const reUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role as any, "RELIABILITY_ENGINEER" as any));

  const gmUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role as any, "RELIABILITY_GM" as any));

  let deferralsScanned = expiring.length;
  let deferralsNotified = 0;
  let notificationsCreated = 0;
  let skippedRecentlyNotified = 0;

  for (const def of expiring as any[]) {
    const recentNotifs = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.deferralId, def.id),
          ilike(notifications.title, `${EXPIRY_NOTIFICATION_TITLE_PREFIX}%`),
          gt(notifications.createdAt, cooldownCutoff),
        ),
      )
      .limit(1);

    if (recentNotifs[0]) {
      skippedRecentlyNotified++;
      continue;
    }

    const daysLeft = Math.max(
      0,
      Math.ceil(
        (new Date(def.lafdEndDate).getTime() - now.getTime()) / MS_PER_DAY,
      ),
    );

    const title = `${EXPIRY_NOTIFICATION_TITLE_PREFIX} ${def.deferralCode}`;
    const body = `Deferral ${def.deferralCode} (${def.equipmentTag || "—"}) reaches its new LAFD in ${daysLeft} day(s) on ${new Date(def.lafdEndDate).toLocaleDateString()}. Please create a 2nd/3rd deferral if the work is still deferred, or close the deferral if the job has been completed.`;

    const recipientIds = new Set<string>();
    recipientIds.add(String(def.initiatorUserId));
    for (const user of reUsers) recipientIds.add(String(user.id));
    for (const user of gmUsers) recipientIds.add(String(user.id));

    if (recipientIds.size === 0) continue;

    const createdAt = new Date();
    await db.insert(notifications).values(
      [...recipientIds].map((userId) => ({
        id: randomUUID(),
        userId,
        deferralId: def.id,
        title,
        body,
        isRead: false,
        deferralCodeSnapshot: def.deferralCode,
        equipmentTagSnapshot: def.equipmentTag ?? null,
        createdAt,
      })) as any,
    );

    deferralsNotified++;
    notificationsCreated += recipientIds.size;
  }

  return {
    now: now.toISOString(),
    windowDays,
    cooldownDays,
    eligibleStatuses: [...EXPIRY_ELIGIBLE_STATUSES],
    deferralsScanned,
    deferralsNotified,
    notificationsCreated,
    skippedRecentlyNotified,
  };
}

export async function runMarkExpired(options: { now: Date }) {
  const { now } = options;

  const candidates = await db
    .select({
      id: deferrals.id,
      deferralCode: deferrals.deferralCode,
    })
    .from(deferrals)
    .where(
      and(
        inArray(deferrals.status, [...EXPIRY_ELIGIBLE_STATUSES] as any),
        lt(deferrals.lafdEndDate, now),
      ),
    );

  const ids = candidates.map((row) => row.id);

  if (ids.length > 0) {
    await db
      .update(deferrals)
      .set({ status: "EXPIRED", updatedAt: now } as any)
      .where(inArray(deferrals.id, ids as any));
  }

  return {
    now: now.toISOString(),
    eligibleStatuses: [...EXPIRY_ELIGIBLE_STATUSES],
    expiredCount: ids.length,
    expiredDeferrals: candidates.map((row) => row.deferralCode),
  };
}
