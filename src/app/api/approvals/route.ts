import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { deferralApprovals, deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { and, eq, or, isNull } from "drizzle-orm";

export async function GET() {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const rows = await db
    .select({
      approval: deferralApprovals,
      deferral: deferrals,
    })
    .from(deferralApprovals)
    .innerJoin(deferrals, eq(deferrals.id, deferralApprovals.deferralId))
    .where(
      and(
        eq(deferralApprovals.status, "PENDING"),
        eq(deferralApprovals.isActive, true),
        // ✅ main rule:
        // - If assignedUserId exists → only that user can see it
        // - Else (unassigned step) → role-based access
        or(
          eq(deferralApprovals.assignedUserId, profile.id),
          and(
            isNull(deferralApprovals.assignedUserId),
            eq(deferralApprovals.stepRole, profile.role),
          ),
        ),
      ),
    );

  return NextResponse.json({ items: rows }, { status: 200 });
}
