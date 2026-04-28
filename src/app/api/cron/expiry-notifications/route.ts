import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/src/db";
import { deferrals, notifications, users } from "@/src/db/schema";
import { and, between, eq, inArray, sql } from "drizzle-orm";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  // Find APPROVED or COMPLETED deferrals expiring within 15 days
  const expiring = await db
    .select()
    .from(deferrals)
    .where(
      and(
        inArray(deferrals.status, ["APPROVED", "COMPLETED"] as any),
        between(deferrals.lafdEndDate, now, in15Days),
      ),
    );

  let notifsSent = 0;

  for (const def of expiring as any[]) {
    // Check if we already sent an expiry notification for this deferral in the last 7 days
    const recentNotifs = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.deferralId, def.id),
          sql`${notifications.title} LIKE 'Deferral expiring soon%'`,
          sql`${notifications.createdAt} > NOW() - INTERVAL '7 days'`,
        ),
      )
      .limit(1);

    if (recentNotifs[0]) continue; // already notified recently

    const daysLeft = Math.ceil(
      (new Date(def.lafdEndDate).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    const title = `Deferral expiring soon: ${def.deferralCode}`;
    const body = `Deferral ${def.deferralCode} (${def.equipmentTag || "—"}) expires in ${daysLeft} day(s) on ${new Date(def.lafdEndDate).toLocaleDateString()}. Please create a 2nd/3rd deferral or close the deferral if the job has been executed.`;

    // Notify initiator
    await db.insert(notifications).values({
      id: randomUUID(),
      userId: def.initiatorUserId,
      deferralId: def.id,
      title,
      body,
      isRead: false,
      deferralCodeSnapshot: def.deferralCode,
      equipmentTagSnapshot: def.equipmentTag ?? null,
    } as any);

    // Notify all RELIABILITY_ENGINEER users
    const reUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role as any, "RELIABILITY_ENGINEER" as any));

    for (const u of reUsers) {
      await db.insert(notifications).values({
        id: randomUUID(),
        userId: u.id,
        deferralId: def.id,
        title,
        body,
        isRead: false,
        deferralCodeSnapshot: def.deferralCode,
        equipmentTagSnapshot: def.equipmentTag ?? null,
      } as any);
    }

    // Notify all RELIABILITY_GM users
    const gmUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role as any, "RELIABILITY_GM" as any));

    for (const u of gmUsers) {
      await db.insert(notifications).values({
        id: randomUUID(),
        userId: u.id,
        deferralId: def.id,
        title,
        body,
        isRead: false,
        deferralCodeSnapshot: def.deferralCode,
        equipmentTagSnapshot: def.equipmentTag ?? null,
      } as any);
    }

    notifsSent++;
  }

  return NextResponse.json({ ok: true, notifsSent }, { status: 200 });
}
