DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'deferral_risks_unique_deferral_category'
      AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX "deferral_risks_unique_deferral_category"
      ON "deferral_risks" USING btree ("deferral_id","category");
  END IF;
END $$;
