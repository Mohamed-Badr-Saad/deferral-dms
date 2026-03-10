import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import { deferrals } from "@/src/db/schema";
import { getBusinessProfile } from "@/src/lib/authz";

const DRAFT = ["DRAFT"] as const;
const IN_APPROVAL = ["SUBMITTED", "IN_APPROVAL"] as const;
const COMPLETED = ["COMPLETED", "APPROVED", "REJECTED"] as const;

export async function GET() {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
/******************** */
  // const baseWhere =
  //   profile.role === "ENGINEER_APPLICANT"
  //     ? eq(deferrals.initiatorUserId, profile.id)
  //     : undefined;
  const baseWhere = undefined; // for now, show all counts to everyone — we don't have many deferrals and it's more useful to see overall stats on the dashboard
/*********************************** */
  async function countFor(statuses: readonly string[]) {
    const where = baseWhere
      ? and(baseWhere as any, inArray(deferrals.status, statuses as any))
      : inArray(deferrals.status, statuses as any);

    // drizzle doesn't have a universal count helper across all setups — simplest:
    const rows = await db
      .select({ id: deferrals.id })
      .from(deferrals)
      .where(where as any)
      .limit(5000);
    return rows.length;
  }

  const [drafts, inApproval, completed] = await Promise.all([
    countFor(DRAFT),
    countFor(IN_APPROVAL),
    countFor(COMPLETED),
  ]);

  return NextResponse.json({ drafts, inApproval, completed }, { status: 200 });
}
