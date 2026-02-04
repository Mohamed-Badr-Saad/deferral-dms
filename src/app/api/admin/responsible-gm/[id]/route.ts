import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { responsibleGmMappings } from "@/src/db/schema";
import { getBusinessProfile, requireRole } from "@/src/lib/authz";
import { eq } from "drizzle-orm";

const GM_GROUPS = ["MAINTENANCE_GM", "FACILITY_SUPPORT_GM", "SUBSEA_CONTROL_GM", "PRODUCTION_GM"] as const;

const PatchSchema = z.object({
  department: z.string().min(1).optional(),
  gmGroup: z.enum(GM_GROUPS).optional(),
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

  const existing = await db
    .select({ id: responsibleGmMappings.id })
    .from(responsibleGmMappings)
    .where(eq(responsibleGmMappings.id, id))
    .limit(1);

  if (!existing[0]) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const next: any = { updatedAt: new Date() };
  if (parsed.data.department !== undefined) next.department = parsed.data.department.trim();
  if (parsed.data.gmGroup !== undefined) next.gmGroup = parsed.data.gmGroup;

  await db.update(responsibleGmMappings).set(next).where(eq(responsibleGmMappings.id, id));

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile) return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  requireRole(profile, ["ADMIN"]);

  const { id } = await ctx.params;

  await db.delete(responsibleGmMappings).where(eq(responsibleGmMappings.id, id));
  return NextResponse.json({ ok: true }, { status: 200 });
}
