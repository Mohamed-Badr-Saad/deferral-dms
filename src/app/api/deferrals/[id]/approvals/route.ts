import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { deferralApprovals, deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";
import { and, asc, eq } from "drizzle-orm";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const profile = await getBusinessProfile();
  if (!profile) {
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const d = await db
    .select({ id: deferrals.id, approvalCycle: deferrals.approvalCycle })
    .from(deferrals)
    .where(eq(deferrals.id, id))
    .limit(1);

  if (!d[0]) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const currentCycle = Number(d[0].approvalCycle ?? 0);

  const approvals = await db
    .select()
    .from(deferralApprovals)
    .where(
      and(
        eq(deferralApprovals.deferralId, id),
        eq(deferralApprovals.cycle, currentCycle),
      ),
    )
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
    { total: 0, approved: 0, rejected: 0, pending: 0, active: 0 },
  );

  // Parallel group segment for 2nd/3rd deferral
  const parallelRoles = new Set(["RESPONSIBLE_GM", "SOD", "DFGM"]);
  const parallel = approvals.filter((a: any) => parallelRoles.has(a.stepRole));
  const parallelCounts = {
    total: parallel.length,
    approved: parallel.filter((a: any) => a.status === "APPROVED").length,
    pending: parallel.filter((a: any) => a.status === "PENDING").length,
  };

  return NextResponse.json(
    { approvals, counts, parallelCounts, cycle: currentCycle },
    { status: 200 },
  );
}

// import { NextResponse } from "next/server";
// import { db } from "@/src/db";
// import { deferralApprovals, deferrals } from "@/src/db/schema";
// import { getBusinessProfile } from "@/src/lib/authz";
// import { and, eq, or, isNull } from "drizzle-orm";

// export async function GET() {
//   const profile = await getBusinessProfile();
//   if (!profile) {
//     return NextResponse.json({ message: "Permission denied" }, { status: 401 });
//   }

//   const rows = await db
//     .select({
//       approval: deferralApprovals,
//       deferral: deferrals,
//     })
//     .from(deferralApprovals)
//     .innerJoin(deferrals, eq(deferrals.id, deferralApprovals.deferralId))
//     .where(
//       and(
//         // ✅ Only current cycle approvals
//         eq(deferralApprovals.cycle, deferrals.approvalCycle),

//         // ✅ Only pending + active
//         eq(deferralApprovals.status, "PENDING"),
//         eq(deferralApprovals.isActive, true),

//         // ✅ Assignment logic
//         or(
//           eq(deferralApprovals.assignedUserId, profile.id),
//           and(
//             isNull(deferralApprovals.assignedUserId),
//             eq(deferralApprovals.stepRole, profile.role),
//           ),
//         ),
//       ),
//     );

//   return NextResponse.json({ items: rows }, { status: 200 });
// }
