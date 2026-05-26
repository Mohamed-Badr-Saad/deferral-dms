DO $$
BEGIN
  ALTER TYPE "public"."approval_status" ADD VALUE 'RETURNED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
