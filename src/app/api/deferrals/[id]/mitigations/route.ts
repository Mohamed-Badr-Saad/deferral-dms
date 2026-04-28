import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "@/src/db";
import { deferrals, deferralMitigations } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { asc, eq } from "drizzle-orm";

const PostSchema = z.object({
  description: z.string().min(1, "Description is required"),
  requiredDepartment: z.string().min(1, "Required department is required"),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const { id } = await ctx.params;

  const items = await db
    .select()
    .from(deferralMitigations)
    .where(eq(deferralMitigations.deferralId, id))
    .orderBy(asc(deferralMitigations.createdAt));

  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const { id } = await ctx.params;

  // Only initiator can add mitigations to DRAFT or RETURNED deferral
  const defRows = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, id))
    .limit(1);
  const def = defRows[0] as any;
  if (!def) return NextResponse.json({ message: "Not found" }, { status: 404 });

  if (def.initiatorUserId !== profile.id)
    return NextResponse.json({ message: "Permission denied" }, { status: 403 });

  if (def.status !== "DRAFT" && def.status !== "RETURNED")
    return NextResponse.json(
      {
        message: "Validation error",
        detail:
          "Mitigations can only be edited on DRAFT or RETURNED deferrals.",
      },
      { status: 400 },
    );

  const body = await req.json().catch(() => ({}));
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { message: "Validation error", issues: parsed.error.flatten() },
      { status: 400 },
    );

  const newId = randomUUID();
  await db.insert(deferralMitigations).values({
    id: newId,
    deferralId: id,
    description: parsed.data.description.trim(),
    requiredDepartment: parsed.data.requiredDepartment.trim(),
  } as any);

  const item = await db
    .select()
    .from(deferralMitigations)
    .where(eq(deferralMitigations.id, newId))
    .limit(1);

  return NextResponse.json({ item: item[0] }, { status: 201 });
}
