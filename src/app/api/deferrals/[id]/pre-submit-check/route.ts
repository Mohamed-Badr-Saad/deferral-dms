import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { workOrders, workOrderDeferrals, deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { eq, desc } from "drizzle-orm";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const { id: deferralId } = await ctx.params;
  const url = new URL(req.url);
  const workOrderNo = (url.searchParams.get("workOrderNo") ?? "").trim();

  if (!workOrderNo)
    return NextResponse.json(
      { message: "workOrderNo is required" },
      { status: 400 },
    );

  // Check if this deferral already has a mapping (resubmit case)
  const existingMapping = await db
    .select()
    .from(workOrderDeferrals)
    .where(eq(workOrderDeferrals.deferralId, deferralId))
    .limit(1);

  if (existingMapping[0]) {
    // This is a resubmit — no popup needed
    return NextResponse.json(
      {
        isResubmit: true,
        existingDeferralNumber: Number(existingMapping[0].deferralNumber),
        existingCount: 0,
      },
      { status: 200 },
    );
  }

  // Find the work order and count existing deferrals
  const woRows = await db
    .select()
    .from(workOrders)
    .where(eq(workOrders.workOrderNo, workOrderNo))
    .limit(1);

  if (!woRows[0]) {
    // WO doesn't exist yet — this will be the 1st deferral
    return NextResponse.json(
      { isResubmit: false, existingCount: 0, existingDeferralNumber: null },
      { status: 200 },
    );
  }

  const existingMappings = await db
    .select()
    .from(workOrderDeferrals)
    .where(eq(workOrderDeferrals.workOrderId, woRows[0].id))
    .orderBy(desc(workOrderDeferrals.deferralNumber));

  const existingCount = existingMappings.length;
  const nextNumber = existingCount + 1;

  return NextResponse.json(
    {
      isResubmit: false,
      existingCount,
      nextDeferralNumber: nextNumber, // what this will become (2 or 3)
    },
    { status: 200 },
  );
}
