import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { workOrders, workOrderDeferrals } from "@/src/db/schema";
import { desc, eq } from "drizzle-orm";
import { getBusinessProfile } from "@/src/lib/authz";

export async function POST(req: Request) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const workOrderNo = String(body.workOrderNo ?? "").trim();
  const deferralId = String(body.deferralId ?? "").trim() || null;

  if (!workOrderNo) {
    return NextResponse.json({
      exists: false,
      duplicateRank: 1,
      existingCount: 0,
      needsConfirmation: false,
      blocked: false,
      message: "",
    });
  }

  const woExisting = await db
    .select()
    .from(workOrders)
    .where(eq(workOrders.workOrderNo, workOrderNo))
    .limit(1);

  if (!woExisting[0]) {
    return NextResponse.json({
      exists: false,
      duplicateRank: 1,
      existingCount: 0,
      needsConfirmation: false,
      blocked: false,
      message: "",
    });
  }

  const mappings = await db
    .select()
    .from(workOrderDeferrals)
    .where(eq(workOrderDeferrals.workOrderId, woExisting[0].id))
    .orderBy(desc(workOrderDeferrals.deferralNumber));

  const otherMappings = deferralId
    ? mappings.filter((m) => m.deferralId !== deferralId)
    : mappings;

  const existingCount = otherMappings.length;
  const duplicateRank = existingCount + 1;

  if (existingCount >= 3) {
    return NextResponse.json({
      exists: true,
      duplicateRank,
      existingCount,
      needsConfirmation: false,
      blocked: true,
      message:
        "This work order already has 3 deferrals. You cannot create another deferral for it.",
    });
  }

  if (existingCount >= 1) {
    return NextResponse.json({
      exists: true,
      duplicateRank,
      existingCount,
      needsConfirmation: true,
      blocked: false,
      message:
        duplicateRank === 2
          ? "A previous deferral already exists for this work order. Do you want to create a second deferral?"
          : "Two previous deferrals already exist for this work order. Do you want to create a third deferral?",
    });
  }

  return NextResponse.json({
    exists: false,
    duplicateRank: 1,
    existingCount: 0,
    needsConfirmation: false,
    blocked: false,
    message: "",
  });
}
