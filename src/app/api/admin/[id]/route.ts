import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getBusinessProfile, requireRole } from "@/src/lib/authz";
import { eq } from "drizzle-orm";
import { USER_ROLES } from "@/src/lib/constants";

const PatchSchema = z.object({
  role: z.enum(USER_ROLES),
  
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile) return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  requireRole(profile, ["ADMIN"]);

  const { id } = await ctx.params;

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Validation error", issues: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!existing[0]) return NextResponse.json({ message: "Not found" }, { status: 404 });

  await db.update(users).set({ role: parsed.data.role, updatedAt: new Date() } as any).where(eq(users.id, id));

  return NextResponse.json({ ok: true }, { status: 200 });
}
