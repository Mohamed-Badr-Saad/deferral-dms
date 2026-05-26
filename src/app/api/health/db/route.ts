import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { sql } from "drizzle-orm";
import { getStorageConfigStatus } from "@/src/lib/file-storage";

type QueryRows<T> = { rows?: T[] } | T[];

function rowsFrom<T>(result: QueryRows<T> | unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (
    result &&
    typeof result === "object" &&
    Array.isArray((result as { rows?: unknown }).rows)
  ) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

function maskedDatabaseUrl() {
  return process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace(/:\/\/.*?:.*?@/, "://***:***@")
    : null;
}

export async function GET() {
  try {
    const pingResult = await db.execute(sql`select 1 as ok`);

    const tableResult = await db.execute(sql`
      WITH required(name) AS (
        VALUES
          ('users'),
          ('deferrals'),
          ('work_order_deferrals'),
          ('deferral_approvals'),
          ('deferral_attachments'),
          ('deferral_risks'),
          ('deferral_mitigations'),
          ('notifications'),
          ('user'),
          ('session'),
          ('account'),
          ('verification')
      )
      SELECT
        r.name,
        EXISTS (
          SELECT 1
          FROM information_schema.tables t
          WHERE t.table_schema = 'public'
            AND t.table_name = r.name
        ) AS present
      FROM required r
      ORDER BY r.name;
    `);

    const columnResult = await db.execute(sql`
      WITH required(table_name, column_name) AS (
        VALUES
          ('users', 'gm_group'),
          ('users', 'signature_url'),
          ('deferrals', 'work_order_no'),
          ('deferrals', 'work_order_title'),
          ('deferrals', 'original_lafd'),
          ('deferrals', 'approval_cycle'),
          ('deferrals', 'returned_at'),
          ('deferrals', 'deleted_reason'),
          ('work_order_deferrals', 'deferral_number'),
          ('deferral_approvals', 'cycle'),
          ('deferral_approvals', 'target_gm_group'),
          ('deferral_approvals', 'signature_url_snapshot'),
          ('deferral_risks', 'justification'),
          ('deferral_mitigations', 'required_department')
      )
      SELECT
        r.table_name,
        r.column_name,
        c.column_name IS NOT NULL AS present
      FROM required r
      LEFT JOIN information_schema.columns c
        ON c.table_schema = 'public'
       AND c.table_name = r.table_name
       AND c.column_name = r.column_name
      ORDER BY r.table_name, r.column_name;
    `);

    const enumResult = await db.execute(sql`
      WITH required(enum_name, enum_value) AS (
        VALUES
          ('deferral_status', 'DRAFT'),
          ('deferral_status', 'SUBMITTED'),
          ('deferral_status', 'RETURNED'),
          ('deferral_status', 'IN_APPROVAL'),
          ('deferral_status', 'REJECTED'),
          ('deferral_status', 'APPROVED'),
          ('deferral_status', 'COMPLETED'),
          ('deferral_status', 'CLOSED'),
          ('deferral_status', 'DELETED'),
          ('deferral_status', 'EXPIRED'),
          ('approval_status', 'PENDING'),
          ('approval_status', 'APPROVED'),
          ('approval_status', 'RETURNED'),
          ('approval_status', 'REJECTED'),
          ('approval_status', 'SKIPPED'),
          ('gm_group', 'MAINTENANCE_GM'),
          ('gm_group', 'FACILITY_SUPPORT_GM'),
          ('gm_group', 'SUBSEA_CONTROL_GM'),
          ('gm_group', 'PRODUCTION_GM')
      )
      SELECT
        r.enum_name,
        r.enum_value,
        e.enumlabel IS NOT NULL AS present
      FROM required r
      LEFT JOIN pg_type t ON t.typname = r.enum_name
      LEFT JOIN pg_enum e
        ON e.enumtypid = t.oid
       AND e.enumlabel = r.enum_value
      ORDER BY r.enum_name, r.enum_value;
    `);

    type TableCheck = { name: string; present: boolean };
    type ColumnCheck = {
      table_name: string;
      column_name: string;
      present: boolean;
    };
    type EnumCheck = {
      enum_name: string;
      enum_value: string;
      present: boolean;
    };

    const tables = rowsFrom<TableCheck>(tableResult);
    const columns = rowsFrom<ColumnCheck>(columnResult);
    const enumValues = rowsFrom<EnumCheck>(enumResult);

    const missing = [
      ...tables.filter((r) => !r.present).map((r) => `table:${r.name}`),
      ...columns
        .filter((r) => !r.present)
        .map((r) => `column:${r.table_name}.${r.column_name}`),
      ...enumValues
        .filter((r) => !r.present)
        .map((r) => `enum:${r.enum_name}.${r.enum_value}`),
    ];

    const ok = missing.length === 0;

    return NextResponse.json(
      {
        ok,
        database: {
          connected: true,
          databaseUrlPresent: Boolean(process.env.DATABASE_URL),
          databaseUrlPreview: maskedDatabaseUrl(),
        },
        storage: getStorageConfigStatus(),
        schema: {
          ok,
          missing,
          tables,
          columns,
          enumValues,
        },
        ping: rowsFrom<{ ok: number }>(pingResult)[0] ?? null,
      },
      { status: ok ? 200 : 500 },
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        message: "DB connection failed",
        detail: err?.message ? String(err.message) : String(err),
        databaseUrlPresent: Boolean(process.env.DATABASE_URL),
        databaseUrlPreview: maskedDatabaseUrl(),
      },
      { status: 500 }
    );
  }
}
