import { NextResponse } from "next/server";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getMigrations } from "better-auth/db";
import { admin } from "better-auth/plugins";

// One-time, manually-triggered migration runner for hosts (Vercel) that
// have no equivalent of the Docker "migrate" container stage. Protected by
// MIGRATION_SECRET rather than an admin session, since the very bug this
// fixes can be "sign-up itself is broken" — i.e. there may be zero usable
// accounts yet. Safe to call more than once: drizzle-kit's migrator and
// better-auth's runMigrations() both only apply what's still pending.
//
// Usage, once MIGRATION_SECRET is set in Vercel's env vars:
//   curl -X POST https://<your-app>.vercel.app/api/admin/run-migrations \
//     -H "x-migration-secret: <the value you set>"
export async function POST(req: Request) {
  const expected = process.env.MIGRATION_SECRET;
  const provided = req.headers.get("x-migration-secret");

  if (!expected) {
    return NextResponse.json(
      { message: "MIGRATION_SECRET is not set on this deployment." },
      { status: 503 },
    );
  }
  if (!provided || provided !== expected) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./src/db/migrations" });

    const auth = await getMigrations({
      database: pool,
      emailAndPassword: { enabled: true },
      advanced: { database: { generateId: "uuid" } },
      // Must mirror the plugins enabled in src/lib/auth.ts.
      plugins: [admin()],
    });
    await auth.runMigrations();

    return NextResponse.json({
      message: "Business and authentication migrations completed.",
    });
  } catch (err: any) {
    console.error("[migrate] failed:", err);
    return NextResponse.json(
      { message: err?.message ?? "Migration failed", detail: String(err) },
      { status: 500 },
    );
  } finally {
    await pool.end();
  }
}
