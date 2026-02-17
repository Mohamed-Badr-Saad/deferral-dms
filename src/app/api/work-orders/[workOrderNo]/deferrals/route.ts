import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { and, desc, eq, ne } from "drizzle-orm";

type Ctx = { params: Promise<{ workOrderNo: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const { workOrderNo } = await ctx.params;
  const wo = decodeURIComponent(workOrderNo ?? "").trim();
  if (!wo) {
    return NextResponse.json(
      { message: "Invalid work order number" },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const excludeId = (url.searchParams.get("excludeId") ?? "").trim();

  const whereClause = excludeId
    ? and(eq(deferrals.workOrderNo, wo),ne(deferrals.status, "DRAFT"))
    : eq(deferrals.workOrderNo, wo);

  const rows = await db
    .select({
      id: deferrals.id,
      deferralCode: deferrals.deferralCode,
      status: deferrals.status,
      equipmentTag: deferrals.equipmentTag,
      equipmentDescription: deferrals.equipmentDescription,
      lafdStartDate: deferrals.lafdStartDate,
      lafdEndDate: deferrals.lafdEndDate,
      ramCell: deferrals.ramCell,
      ramConsequenceLevel: deferrals.ramConsequenceLevel,
      updatedAt: deferrals.updatedAt,
      createdAt: deferrals.createdAt,
    })
    .from(deferrals)
    .where(whereClause as any)
    .orderBy(desc(deferrals.updatedAt))
    .limit(100);

  return NextResponse.json({ items: rows }, { status: 200 });
}
