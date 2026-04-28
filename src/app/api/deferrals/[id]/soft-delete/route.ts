import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { deferralApprovals, deferrals, notifications } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { eq } from "drizzle-orm";

const BodySchema = z.object({
  reason: z.string().min(3, "Reason must be at least 3 characters"),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { message: "Validation error", issues: parsed.error.flatten() },
      { status: 400 },
    );

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

  if (item.status !== "IN_APPROVAL")
    return NextResponse.json(
      {
        message: "Validation error",
        detail: "Only IN_APPROVAL deferrals can be deleted this way.",
      },
      { status: 400 },
    );

  await db.transaction(async (tx) => {
    // Deactivate all pending approvals
    await tx
      .update(deferralApprovals)
      .set({ isActive: false, updatedAt: new Date() } as any)
      .where(eq(deferralApprovals.deferralId, id));

    // Soft-delete with reason
    await tx
      .update(deferrals)
      .set({
        status: "DELETED",
        deletedReason: parsed.data.reason,
        updatedAt: new Date(),
      } as any)
      .where(eq(deferrals.id, id));
  });

  // ✅ Mark related notifications as read
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() } as any)
    .where(eq(notifications.deferralId, id) as any);

  return NextResponse.json({ ok: true }, { status: 200 });
}
