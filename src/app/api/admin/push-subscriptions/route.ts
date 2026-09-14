import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { pushSubscriptions, users } from "@/src/db/schema";
import { getBusinessProfile, requireRole } from "@/src/lib/authz";
import { eq } from "drizzle-orm";

// Small diagnostic endpoint: lets an admin confirm whether a given user's
// browser actually has a push subscription on file, without needing
// DevTools access on that person's machine. GET /api/admin/push-subscriptions?email=...
export async function GET(req: Request) {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });
  requireRole(profile, ["ADMIN"]);

  const url = new URL(req.url);
  const email = (url.searchParams.get("email") ?? "").trim();
  if (!email) {
    return NextResponse.json(
      { message: "Pass ?email=user@example.com" },
      { status: 400 },
    );
  }

  const userRows = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = userRows[0];
  if (!user) {
    return NextResponse.json({ message: "No such user" }, { status: 404 });
  }

  const subs = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      userAgent: pushSubscriptions.userAgent,
      createdAt: pushSubscriptions.createdAt,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, user.id));

  return NextResponse.json(
    {
      user: { email: user.email, name: user.name },
      subscriptionCount: subs.length,
      subscriptions: subs.map((s) => ({
        // Full endpoints are long opaque push-service URLs; a short prefix
        // is enough to eyeball "yes this browser is subscribed" without
        // dumping the whole secret-ish URL into a response an admin might
        // paste elsewhere.
        endpointHost: (() => {
          try {
            return new URL(s.endpoint).host;
          } catch {
            return "invalid-endpoint";
          }
        })(),
        userAgent: s.userAgent,
        createdAt: s.createdAt,
      })),
    },
    { status: 200 },
  );
}
