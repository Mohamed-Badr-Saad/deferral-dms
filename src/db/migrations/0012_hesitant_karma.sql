CREATE TABLE "deferral_mitigations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deferral_id" uuid NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"required_department" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deferrals" ADD COLUMN "original_lafd" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deferrals" ADD COLUMN "deleted_reason" text DEFAULT null;