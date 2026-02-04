import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const result = await db.execute(sql`select 1 as ok`);
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        message: "DB connection failed",
        detail: err?.message ? String(err.message) : String(err),
        databaseUrlPresent: Boolean(process.env.DATABASE_URL),
        databaseUrlPreview: process.env.DATABASE_URL
          ? process.env.DATABASE_URL.replace(/:\/\/.*?:.*?@/, "://***:***@")
          : null,
      },
      { status: 500 }
    );
  }
}
