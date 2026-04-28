import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { deferrals } from "@/src/db/schema";
import { and, inArray, lt } from "drizzle-orm";

// Call this route from a cron job (e.g. Vercel Cron, external scheduler)
// Protect with CRON_SECRET header
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const now = new Date();

  // Mark APPROVED and COMPLETED deferrals as EXPIRED when lafdEndDate has passed
  const result = await db
    .update(deferrals)
    .set({ status: "EXPIRED", updatedAt: now } as any)
    .where(
      and(
        inArray(deferrals.status, ["APPROVED", "COMPLETED"] as any),
        lt(deferrals.lafdEndDate, now),
      ),
    );

  return NextResponse.json(
    { ok: true, markedAt: now.toISOString() },
    { status: 200 },
  );
}
