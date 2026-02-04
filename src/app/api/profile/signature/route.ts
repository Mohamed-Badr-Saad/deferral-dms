import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { eq } from "drizzle-orm";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/png", "image/jpeg"]);
const MAX_SIZE = Number(process.env.MAX_FILE_SIZE ?? 5242880);

export async function POST(req: Request) {
  const profile = await getBusinessProfile();
  if (!profile) return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Validation error", detail: "file is required" }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ message: "Validation error", detail: "Invalid file type" }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_SIZE) {
    return NextResponse.json(
      { message: "Validation error", detail: `File too large. Max ${MAX_SIZE} bytes.` },
      { status: 400 }
    );
  }

  // Save as PNG always (even if uploaded JPG) - client sends PNG from crop.
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const safeUserId = profile.id;
  const dir = path.join(process.cwd(), "public", "uploads", "signatures", safeUserId);
  await fs.mkdir(dir, { recursive: true });

  const filename = `signature_${Date.now()}.png`;
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, buffer);

  const publicUrl = `/uploads/signatures/${safeUserId}/${filename}`;

  await db
    .update(users)
    .set({
      signatureUrl: publicUrl,
      signatureUploadedAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .where(eq(users.id, profile.id));

  return NextResponse.json({ ok: true, signatureUrl: publicUrl }, { status: 200 });
}
