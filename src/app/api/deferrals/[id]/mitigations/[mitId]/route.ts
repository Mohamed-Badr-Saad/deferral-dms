import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { deferrals, deferralMitigations } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { eq } from "drizzle-orm";

type Ctx = { params: Promise<{ id: string; mitId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const { id, mitId } = await ctx.params;

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

  await db.delete(deferralMitigations).where(eq(deferralMitigations.id, mitId));

  return NextResponse.json({ ok: true }, { status: 200 });
}
