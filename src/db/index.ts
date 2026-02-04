import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
if (process.env.DATABASE_URL.includes("5432"))
  console.warn("WARNING: DATABASE_URL is using 5432. Your Docker is on 5433.");


declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
}

const pool =
  global.__dbPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") global.__dbPool = pool;

export const db = drizzle(pool);
