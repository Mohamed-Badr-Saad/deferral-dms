import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "@/src/db";
import { pushSubscriptions } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { eq } from "drizzle-orm";

const BodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(req: Request) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation error", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { endpoint, keys } = parsed.data;
  const userAgent = req.headers.get("user-agent") ?? null;

  const existing = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .limit(1);

  if (existing[0]) {
    // Endpoint already on file (re-subscribe, or another user reused this
    // browser) — keep one row per endpoint and re-point it at this user.
    await db
      .update(pushSubscriptions)
      .set({
        userId: profile.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
      })
      .where(eq(pushSubscriptions.endpoint, endpoint));
  } else {
    await db.insert(pushSubscriptions).values({
      id: randomUUID(),
      userId: profile.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
