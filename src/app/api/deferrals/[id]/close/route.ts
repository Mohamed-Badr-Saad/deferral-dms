import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { deferrals, notifications } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const { id } = await ctx.params;

  const rows = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, id))
    .limit(1);
  const item = rows[0] as any;
  if (!item)
    return NextResponse.json({ message: "Not found" }, { status: 404 });

  if (item.initiatorUserId !== profile.id)
    return NextResponse.json({ message: "Permission denied" }, { status: 403 });

  if (item.status !== "COMPLETED")
    return NextResponse.json(
      {
        message: "Validation error",
        detail: "Only COMPLETED deferrals can be closed.",
      },
      { status: 400 },
    );

  await db
    .update(deferrals)
    .set({ status: "CLOSED", updatedAt: new Date() } as any)
    .where(eq(deferrals.id, id));

  // ✅ Mark all expiry notifications for this deferral as read (mod #9 fulfilment)
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() } as any)
    .where(eq(notifications.deferralId, id) as any);

  return NextResponse.json({ ok: true }, { status: 200 });
}
