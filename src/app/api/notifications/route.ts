import { NextResponse } from "next/server";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { notifications } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";

export async function GET(req: Request) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const url = new URL(req.url);

  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 50)
    : 20;

  const cursor = url.searchParams.get("cursor");
  const cursorDate = cursor ? new Date(cursor) : null;

  const whereClause = cursorDate
    ? and(
        eq(notifications.userId, profile.id),
        lt(notifications.createdAt, cursorDate),
      )
    : eq(notifications.userId, profile.id);

  const rows = await db
    .select()
    .from(notifications)
    .where(whereClause)
    .orderBy(desc(notifications.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  const nextCursor =
    hasMore && items.length
      ? ((items[items.length - 1] as any).createdAt?.toISOString?.() ?? null)
      : null;

  // Postgres count(*) often returns string -> cast to number
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

  return NextResponse.json({ items, unreadCount, nextCursor }, { status: 200 });
}
