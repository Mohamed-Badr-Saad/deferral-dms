import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { getBusinessProfile } from "@/src/lib/authz";

const PatchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  department: z.string().min(2).max(120).optional(),
  position: z.string().min(2).max(120).optional(),
});

export async function GET() {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  return NextResponse.json({ profile }, { status: 200 });
}

export async function PATCH(req: Request) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation error", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, department, position } = parsed.data;

  // Nothing to update
  if (
    typeof name === "undefined" &&
    typeof department === "undefined" &&
    typeof position === "undefined"
  ) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  await db
    .update(users)
    .set({
      ...(typeof name !== "undefined" ? { name: name.trim() } : {}),
      ...(typeof department !== "undefined"
        ? { department: department.trim() }
        : {}),
      ...(typeof position !== "undefined" ? { position: position.trim() } : {}),
      updatedAt: new Date(),
    } as any)
    .where(eq(users.id, profile.id));

  // Return updated profile
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, profile.id))
    .limit(1);

  return NextResponse.json({ ok: true, profile: rows[0] }, { status: 200 });
}
