BEGIN;
-- Supabase recommends keeping extensions outside the exposed public schema.
-- pg_trgm is relocatable; moving its objects does not rebuild or drop the
-- existing GIN indexes. This is safe for an already-populated catalogue.
DO $move_pg_trgm$
DECLARE current_schema text;
BEGIN
  SELECT n.nspname INTO current_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid=e.extnamespace
  WHERE e.extname='pg_trgm';

  IF current_schema IS NULL THEN
    RAISE EXCEPTION 'pg_trgm extension is required by the catalogue indexes';
  ELSIF current_schema='public' THEN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='extensions') THEN
      RAISE EXCEPTION 'Supabase extensions schema is missing';
    END IF;
    EXECUTE 'ALTER EXTENSION pg_trgm SET SCHEMA extensions';
  ELSIF current_schema <> 'extensions' THEN
    RAISE EXCEPTION 'pg_trgm is installed in unexpected schema: %', current_schema;
  END IF;
END
$move_pg_trgm$;

DO $assert_pg_trgm$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid=e.extnamespace
    WHERE e.extname='pg_trgm' AND n.nspname='extensions'
  ) THEN
    RAISE EXCEPTION 'pg_trgm was not moved into the extensions schema';
  END IF;
END
$assert_pg_trgm$;
COMMIT;
