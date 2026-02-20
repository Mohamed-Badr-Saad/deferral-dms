import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { deferralApprovals, deferrals } from "@/src/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { getBusinessProfile } from "@/src/lib/authz";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const { id: deferralId } = await ctx.params;

  const d = await db
    .select()
    .from(deferrals)
    .where(eq(deferrals.id, deferralId))
    .limit(1);

  if (!d[0])
    return NextResponse.json({ message: "Not found" }, { status: 404 });

  const rows = await db
    .select()
    .from(deferralApprovals)
    .where(and(eq(deferralApprovals.deferralId, deferralId)))
    .orderBy(asc(deferralApprovals.cycle), asc(deferralApprovals.stepOrder));

  // only rejected events (returns)
  const rejected = rows
    .filter((r: any) => r.status === "REJECTED")
    .map((r: any) => ({
      cycle: r.cycle,
      stepRole: r.stepRole,
      comment: r.comment,
      signedAt: r.signedAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => {
      const ad = new Date(a.signedAt ?? a.updatedAt ?? 0).getTime();
      const bd = new Date(b.signedAt ?? b.updatedAt ?? 0).getTime();
      return bd - ad;
    });

  return NextResponse.json({ items: rejected }, { status: 200 });
}
