DO $$
BEGIN
  ALTER TYPE "public"."deferral_status" ADD VALUE 'RETURNED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TYPE "public"."deferral_status" ADD VALUE 'CLOSED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TYPE "public"."deferral_status" ADD VALUE 'DELETED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TYPE "public"."deferral_status" ADD VALUE 'EXPIRED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
