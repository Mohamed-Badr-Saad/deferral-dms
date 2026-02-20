ALTER TABLE "deferrals" ADD COLUMN IF NOT EXISTS "approval_cycle" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "deferrals" ADD COLUMN IF NOT EXISTS "returned_at" timestamp with time zone DEFAULT null;--> statement-breakpoint
ALTER TABLE "deferrals" ADD COLUMN IF NOT EXISTS "returned_by_role" text DEFAULT null;--> statement-breakpoint
ALTER TABLE "deferrals" ADD COLUMN IF NOT EXISTS "returned_comment" text DEFAULT null;--> statement-breakpoint
ALTER TABLE "deferral_approvals" ADD COLUMN IF NOT EXISTS "cycle" integer DEFAULT 0 NOT NULL;