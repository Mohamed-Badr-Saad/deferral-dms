import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import path from "path";
import { promises as fs } from "fs";

import { db } from "@/src/db";
import { deferrals, deferralAttachments } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { canViewDeferral } from "@/src/lib/authz/deferralAccess";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
  const ALLOW_UPLOAD_STATUSES = new Set([
  "DRAFT",
  "RETURNED",
  "SUBMITTED",
  "IN_APPROVAL",
]);


// ✅ per your requirement: max 25 MB
const MAX_SIZE = 25 * 1024 * 1024;

export async function GET(_req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const { id: deferralId } = await ctx.params;

  const d = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, deferralId))
    .limit(1);
  const def = d[0];
  if (!def) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const items = await db
    .select()
    .from(deferralAttachments)
    .where(eq(deferralAttachments.deferralId, deferralId));

  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const { id: deferralId } = await ctx.params;

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


  // (optional safety) only allow attachments while draft
if (!ALLOW_UPLOAD_STATUSES.has(String(def.status))) {
  return NextResponse.json(
    {
      message: "Validation error",
      detail: `Attachments not allowed when status is ${def.status}`,
    },
    { status: 400 },
  );
}

  const form = await req.formData();
  const files = form.getAll("files").filter((f) => f instanceof File) as File[];

  if (files.length === 0) {
    return NextResponse.json(
      { message: "Validation error", detail: "files is required" },
      { status: 400 },
    );
  }

  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "deferrals",
    deferralId,
  );
  await fs.mkdir(dir, { recursive: true });

  const created: any[] = [];

  for (const file of files) {
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        {
          message: "Validation error",
          detail: `Invalid file type: ${file.type}`,
        },
        { status: 400 },
      );
    }
    if (file.size <= 0 || file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          message: "Validation error",
          detail: `File too large. Max ${MAX_SIZE} bytes.`,
        },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const id = randomUUID();
    const safeName = (file.name || "attachment").replace(/[^\w.\-() ]+/g, "_");
    const filename = `${Date.now()}_${id}_${safeName}`;
    const fullPath = path.join(dir, filename);

    await fs.writeFile(fullPath, buffer);

    const publicUrl = `/uploads/deferrals/${deferralId}/${filename}`;

    await db.insert(deferralAttachments).values({
      id,
      deferralId,
      fileName: safeName,
      fileType: file.type,
      fileSize: file.size,
      filePath: publicUrl,
      uploadedByUserId: profile.id,
      uploadedAt: new Date(),
    } as any);

    created.push({
      id,
      deferralId,
      fileName: safeName,
      fileType: file.type,
      fileSize: file.size,
      filePath: publicUrl,
      uploadedByUserId: profile.id,
      uploadedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true, items: created }, { status: 200 });
}
