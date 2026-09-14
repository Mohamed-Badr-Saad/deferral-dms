import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getBusinessProfile, requireRole } from "@/src/lib/authz";
import { desc, eq, ilike, or } from "drizzle-orm";
import { auth } from "@/src/lib/auth";
import { USER_ROLES } from "@/src/lib/constants";
import { GM_GROUPS } from "@/src/lib/gm-group";

export async function GET(req: Request) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  requireRole(profile, ["ADMIN"]);

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  const whereClause = q
    ? or(
        ilike(users.email, `%${q}%`),
        ilike(users.name, `%${q}%`),
        ilike(users.department, `%${q}%`),
        ilike(users.position, `%${q}%`),
      )
    : undefined;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      department: users.department,
      position: users.position,
      role: users.role,
      signatureUrl: users.signatureUrl,
      signatureUploadedAt: users.signatureUploadedAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      gmGroup: users.gmGroup,
    })
    .from(users)
    .where(whereClause as any)
    .orderBy(desc(users.updatedAt))
    .limit(300);

  return NextResponse.json({ items: rows }, { status: 200 });
}

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  department: z.string().min(1),
  position: z.string().min(2),
  role: z.enum(USER_ROLES),
  gmGroup: z.enum(GM_GROUPS).optional().nullable(),
});

export async function POST(req: Request) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  requireRole(profile, ["ADMIN"]);

  const body = await req.json();
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation error", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, password, name, department, position, role, gmGroup } =
    parsed.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json(
      { message: "Email already exists" },
      { status: 409 },
    );
  }

  let userId: string | undefined;
  try {
    // Uses the admin plugin's createUser API. Unlike auth.api.signUpEmail,
    // this does NOT sign in as the new account, so it's safe to call from
    // an admin's own authenticated request.
    const created = await auth.api.createUser({
      body: { email, password, name, role: "user" },
      headers: await headers(),
    });
    userId = created?.user?.id;
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message ?? "Failed to create account" },
      { status: 400 },
    );
  }

  if (!userId) {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }

  try {
    await db.insert(users).values({
      id: userId,
      email,
      name,
      department,
      position,
      role,
      gmGroup: gmGroup ?? null,
    });
  } catch (err: any) {
    // Roll back the auth account if we failed to create the business profile,
    // so we don't leave an orphaned login with no application access.
    await auth.api.removeUser({
      body: { userId },
      headers: await headers(),
    }).catch(() => {});

    if (err?.code === "23505") {
      return NextResponse.json(
        { message: "Email already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: userId }, { status: 201 });
}
