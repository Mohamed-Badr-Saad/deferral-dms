import { and, eq, or } from "drizzle-orm";
import { db } from "@/src/db";
import { deferrals, deferralApprovals } from "@/src/db/schema";

export async function canViewDeferral(deferralId: string, userId: string) {
  const d = await db
    .select({ initiatorUserId: deferrals.initiatorUserId })
    .from(deferrals)
    .where(eq(deferrals.id, deferralId))
    .limit(1);

  if (!d[0]) return { ok: false as const, reason: "not_found" as const };

  if (d[0].initiatorUserId === userId) return { ok: true as const };

  const a = await db
    .select({ id: deferralApprovals.id })
    .from(deferralApprovals)
    .where(
      and(
        eq(deferralApprovals.deferralId, deferralId),
        or(
          eq(deferralApprovals.assignedUserId, userId),
          eq(deferralApprovals.signedByUserId, userId),
        ),
      ),
    )
    .limit(1);

  if (a[0]) return { ok: true as const };

  return { ok: false as const, reason: "forbidden" as const };
}
