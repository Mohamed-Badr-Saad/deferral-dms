import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { responsibleGmMappings } from "@/src/db/schema";
import { getBusinessProfile, requireRole } from "@/src/lib/authz";
import { asc, eq, ilike } from "drizzle-orm";

const GM_GROUPS = ["MAINTENANCE_GM", "FACILITY_SUPPORT_GM", "SUBSEA_CONTROL_GM", "PRODUCTION_GM"] as const;

const CreateSchema = z.object({
  department: z.string().min(1),
  gmGroup: z.enum(GM_GROUPS),
});

export async function GET(req: Request) {
  const profile = await getBusinessProfile();
  if (!profile) return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  requireRole(profile, ["ADMIN"]);

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  const rows = await db
    .select()
    .from(responsibleGmMappings)
    .where(q ? ilike(responsibleGmMappings.department, `%${q}%`) : undefined as any)
    .orderBy(asc(responsibleGmMappings.department));

  return NextResponse.json({ items: rows }, { status: 200 });
}

export async function POST(req: Request) {
  const profile = await getBusinessProfile();
  if (!profile) return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  requireRole(profile, ["ADMIN"]);

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Validation error", issues: parsed.error.flatten() }, { status: 400 });
  }

  // Enforce NOT NULL inserts (your rule)
  await db.insert(responsibleGmMappings).values({
    id: crypto.randomUUID(),
    department: parsed.data.department.trim(),
    gmGroup: parsed.data.gmGroup,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  return NextResponse.json({ ok: true }, { status: 200 });
}
