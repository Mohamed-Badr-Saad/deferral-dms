import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { notifications } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";

export async function POST() {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() } as any)
    .where(
      and(
        eq(notifications.userId, profile.id),
        eq(notifications.isRead, false),
      ),
    );

  // ✅ should be 0, but compute to be safe/consistent
  const unreadAgg = await db
    .select({ count: sql<string>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, profile.id),
        eq(notifications.isRead, false),
      ),
    );

  const unreadCount = Number(unreadAgg?.[0]?.count ?? 0);

  return NextResponse.json({ ok: true, unreadCount }, { status: 200 });
}
