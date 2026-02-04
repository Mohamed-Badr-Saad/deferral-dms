import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { deferralApprovals, deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { eq, asc } from "drizzle-orm";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile) return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const { id } = await ctx.params;

  const d = await db.select().from(deferrals).where(eq(deferrals.id, id)).limit(1);
  if (!d[0]) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const approvals = await db
    .select()
    .from(deferralApprovals)
    .where(eq(deferralApprovals.deferralId, id))
    .orderBy(asc(deferralApprovals.stepOrder));

  const counts = approvals.reduce(
    (acc, a: any) => {
      acc.total++;
      if (a.status === "APPROVED") acc.approved++;
      if (a.status === "REJECTED") acc.rejected++;
      if (a.status === "PENDING") acc.pending++;
      if (a.isActive) acc.active++;
      return acc;
    },
    { total: 0, approved: 0, rejected: 0, pending: 0, active: 0 }
  );

  // Parallel group segment for 2nd/3rd deferral
  const parallelRoles = new Set(["RESPONSIBLE_GM", "SOD", "DFGM"]);
  const parallel = approvals.filter((a: any) => parallelRoles.has(a.stepRole));
  const parallelCounts = {
    total: parallel.length,
    approved: parallel.filter((a: any) => a.status === "APPROVED").length,
    pending: parallel.filter((a: any) => a.status === "PENDING").length,
  };

  return NextResponse.json({ approvals, counts, parallelCounts }, { status: 200 });
}
