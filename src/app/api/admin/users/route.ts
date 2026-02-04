import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getBusinessProfile, requireRole } from "@/src/lib/authz";
import { desc, ilike, or } from "drizzle-orm";

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
