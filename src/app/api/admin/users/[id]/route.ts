import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getBusinessProfile, requireRole } from "@/src/lib/authz";
import { eq } from "drizzle-orm";
import { GM_GROUPS } from "@/src/lib/gm-group";
import { auth } from "@/src/lib/auth";

const PatchSchema = z.object({
  role: z.string().min(1).optional(),
  gmGroup: z.enum(GM_GROUPS).optional().nullable(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  requireRole(profile, ["ADMIN"]);

  const { id } = await ctx.params;

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation error", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!existing[0])
    return NextResponse.json({ message: "Not found" }, { status: 404 });

  await db
    .update(users)
    .set({
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(parsed.data.gmGroup !== undefined
        ? { gmGroup: parsed.data.gmGroup }
        : {}),
      updatedAt: new Date(),
    } as any)
    .where(eq(users.id, id));

  const out = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return NextResponse.json({ user: out[0] }, { status: 200 });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  requireRole(profile, ["ADMIN"]);

  const { id } = await ctx.params;

  if (id === profile.id) {
    return NextResponse.json(
      { message: "You cannot remove your own account." },
      { status: 400 },
    );
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!existing[0])
    return NextResponse.json({ message: "Not found" }, { status: 404 });

  // Best-effort: remove the login account too. If it's already gone (or the
  // admin plugin's auth-side migration hasn't run yet) we still remove the
  // business profile below so the account disappears from this page.
  await auth.api
    .removeUser({ body: { userId: id }, headers: await headers() })
    .catch(() => {});

  await db.delete(users).where(eq(users.id, id));

  return NextResponse.json({ ok: true }, { status: 200 });
}
