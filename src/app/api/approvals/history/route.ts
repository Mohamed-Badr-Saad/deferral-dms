import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { deferralApprovals, deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { and, eq, desc } from "drizzle-orm";

export async function GET() {
  const profile = await getBusinessProfile();
  if (!profile) return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  // Mainly for Reliability Engineer, but harmless for others
  const rows = await db
    .select({
      approval: deferralApprovals,
      deferral: deferrals,
    })
    .from(deferralApprovals)
    .innerJoin(deferrals, eq(deferrals.id, deferralApprovals.deferralId))
    .where(and(eq(deferralApprovals.signedByUserId, profile.id), eq(deferralApprovals.status, "APPROVED")))
    .orderBy(desc(deferralApprovals.signedAt));

  return NextResponse.json({ items: rows }, { status: 200 });
}
