import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { deferrals, deferralAttachments } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { canViewDeferral } from "@/src/lib/authz/deferralAccess";
import { deleteStoredFile } from "@/src/lib/file-storage";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; attachmentId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const { id: deferralId, attachmentId } = await ctx.params;

  const d = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, deferralId))
    .limit(1);
  const def = d[0];
  if (!def) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const access = await canViewDeferral(deferralId, profile.id);
  if (!access.ok) {
    return NextResponse.json(
      {
        message:
          access.reason === "not_found" ? "Not found" : "Permission denied",
      },
      { status: access.reason === "not_found" ? 404 : 403 },
    );
  }

  const rows = await db
    .select()
    .from(deferralAttachments)
    .where(
      and(
        eq(deferralAttachments.id, attachmentId),
        eq(deferralAttachments.deferralId, deferralId),
      ),
    )
    .limit(1);

  const att = rows[0];
  if (!att) return NextResponse.json({ message: "Not found" }, { status: 404 });

  // attempt delete file from disk (best-effort)
  try {
    await deleteStoredFile(att.filePath);
  } catch {
    // ignore
  }

  await db
    .delete(deferralAttachments)
    .where(
      and(
        eq(deferralAttachments.id, attachmentId),
        eq(deferralAttachments.deferralId, deferralId),
      ),
    );

  return NextResponse.json({ ok: true }, { status: 200 });
}
