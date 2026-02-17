// src/app/api/notifications/[id]/read/route.ts
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { notifications } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const { id } = await ctx.params;

  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() } as any)
    .where(and(eq(notifications.id, id), eq(notifications.userId, profile.id)));

  return NextResponse.json({ ok: true }, { status: 200 });
}
