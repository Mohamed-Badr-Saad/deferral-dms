import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  department: z.string().min(2),
  position: z.string().min(2),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = SignupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation error", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, name, department, position } = parsed.data;

    // Prevent duplicate business users
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { message: "Email already exists" },
        { status: 409 }
      );
    }

    // Create auth user (this WILL auto-sign-in)
    const result = await auth.api.signUpEmail({
      body: { email, password, name },
      headers: await headers(),
    });

    const userId = result?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { message: "Server error" },
        { status: 500 }
      );
    }

    // Create business user
    await db.insert(users).values({
      id: userId,
      email,
      name,
      department,
      position,
      role: "ENGINEER_APPLICANT",
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json(
        { message: "Email already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: "Server error" },
      { status: 500 }
    );
  }
}
