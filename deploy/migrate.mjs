import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getMigrations } from "better-auth/db";
import { admin } from "better-auth/plugins";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./src/db/migrations" });
  const auth = await getMigrations({
    database: pool,
    emailAndPassword: { enabled: true },
    advanced: { database: { generateId: "uuid" } },
    // Must mirror the plugins enabled in src/lib/auth.ts so this picks up
    // their schema additions (e.g. admin() adds role/banned/... columns).
    plugins: [admin()],
  });
  await auth.runMigrations();
  console.log("Business and authentication migrations completed.");
} finally {
  await pool.end();
}
