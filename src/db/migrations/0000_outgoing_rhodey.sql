CREATE TYPE "public"."approval_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."deferral_status" AS ENUM('DRAFT', 'SUBMITTED', 'IN_APPROVAL', 'REJECTED', 'APPROVED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."gm_group" AS ENUM('MAINTENANCE_GM', 'FACILITY_SUPPORT_GM', 'SUBSEA_CONTROL_GM', 'PRODUCTION_GM');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"department" text NOT NULL,
	"position" text NOT NULL,
	"role" text NOT NULL,
	"signature_url" text,
	"signature_uploaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"work_order_no" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_orders_work_order_no_unique" UNIQUE("work_order_no")
);
--> statement-breakpoint
CREATE TABLE "deferrals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deferral_code" text NOT NULL,
	"initiator_user_id" uuid NOT NULL,
	"initiator_department" text NOT NULL,
	"equipment_tag" text DEFAULT '' NOT NULL,
	"equipment_description" text DEFAULT '' NOT NULL,
	"task_criticality" text DEFAULT '' NOT NULL,
	"safety_criticality" text DEFAULT '' NOT NULL,
	"lafd_start_date" timestamp with time zone,
	"lafd_end_date" timestamp with time zone,
	"description" text DEFAULT '' NOT NULL,
	"justification" text DEFAULT '' NOT NULL,
	"consequence" text DEFAULT '' NOT NULL,
	"risk_category" text DEFAULT '' NOT NULL,
	"severity" integer DEFAULT 1 NOT NULL,
	"likelihood" text DEFAULT 'A' NOT NULL,
	"ram_cell" text DEFAULT '1A' NOT NULL,
	"ram_consequence_level" text DEFAULT '' NOT NULL,
	"mitigations" text DEFAULT '' NOT NULL,
	"requires_technical_authority" boolean DEFAULT false NOT NULL,
	"requires_ad_hoc" boolean DEFAULT false NOT NULL,
	"status" "deferral_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deferrals_deferral_code_unique" UNIQUE("deferral_code")
);
--> statement-breakpoint
CREATE TABLE "work_order_deferrals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"work_order_id" uuid NOT NULL,
	"deferral_id" uuid NOT NULL,
	"deferral_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deferral_approvals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deferral_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"step_role" text NOT NULL,
	"status" "approval_status" DEFAULT 'PENDING' NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"signed_by_user_id" uuid,
	"signature_url_snapshot" text DEFAULT '' NOT NULL,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deferral_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deferral_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"deferral_id" uuid,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "responsible_gm_mappings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"department" text NOT NULL,
	"gm_group" "gm_group" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "responsible_gm_mappings_department_unique" UNIQUE("department")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_work_order_deferral_number" ON "work_order_deferrals" USING btree ("work_order_id","deferral_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_work_order_deferral_deferral" ON "work_order_deferrals" USING btree ("deferral_id");