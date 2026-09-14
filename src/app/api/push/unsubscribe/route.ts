import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { pushSubscriptions } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { and, eq } from "drizzle-orm";

const BodySchema = z.object({
  endpoint: z.string().url(),
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

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.endpoint, parsed.data.endpoint),
        eq(pushSubscriptions.userId, profile.id),
      ),
    );

  return NextResponse.json({ ok: true }, { status: 200 });
}
