-- 0007_oval_bill_hollister.sql

-- 1) Create enum safely (Postgres has no CREATE TYPE IF NOT EXISTS for ENUM)
DO $$
BEGIN
  CREATE TYPE "public"."deferral_risk_category" AS ENUM (
    'PEOPLE', 'ASSET', 'ENVIRONMENT', 'REPUTATION'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- 2) Create table (correct syntax)
CREATE TABLE IF NOT EXISTS "deferral_risks" (
  "id" uuid PRIMARY KEY NOT NULL,
  "deferral_id" uuid NOT NULL,
  "category" "deferral_risk_category" NOT NULL,
  "severity" integer DEFAULT 1 NOT NULL,
  "likelihood" text DEFAULT 'A' NOT NULL,
  "ram_cell" text DEFAULT '1A' NOT NULL,
  "ram_consequence_level" text DEFAULT '' NOT NULL,
  "justification" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 3) Unique per deferral/category (Option 1 requirement)
DO $$
BEGIN
  ALTER TABLE "deferral_risks"
    ADD CONSTRAINT "deferral_risks_unique_deferral_category"
    UNIQUE ("deferral_id", "category");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- 4) Approvals broadcast scopes (safe even if already exists)
ALTER TABLE "deferral_approvals"
  ADD COLUMN IF NOT EXISTS "target_department" text;
--> statement-breakpoint

ALTER TABLE "deferral_approvals"
  ADD COLUMN IF NOT EXISTS "target_gm_group" "gm_group";
--> statement-breakpoint
