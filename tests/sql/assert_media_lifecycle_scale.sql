-- Assert migration 15 on a fresh CI-installed database. Synthetic rows
-- are rolled back; no customer or showroom data is retained.
BEGIN;
DO $preflight$
DECLARE
  index_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.nb_media'::regclass AND tgname='nb_media_lifecycle_update_guard'
      AND NOT tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.nb_media'::regclass AND tgname='nb_media_lifecycle_delete_guard'
      AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Media lifecycle database guard triggers are missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid='public.nb_import_rows'::regclass
      AND conname='nb_import_rows_media_id_fkey' AND confdeltype='n') THEN
    RAISE EXCEPTION 'Import audit reference must use ON DELETE SET NULL';
  END IF;
  IF has_table_privilege('authenticated','public.nb_media','DELETE') THEN
    RAISE EXCEPTION 'Authenticated browsers must not hard-delete media';
  END IF;
  FOREACH index_name IN ARRAY ARRAY[
    'nb_home_drafts_updated_by_fk_idx',
    'nb_home_public_published_by_fk_idx',
    'nb_home_revisions_published_by_fk_idx',
    'nb_import_rows_media_id_fk_idx',
    'nb_media_uploaded_by_fk_idx',
    'nb_product_drafts_updated_by_fk_idx',
    'nb_product_revisions_published_by_fk_idx',
    'nb_products_created_by_fk_idx'
  ] LOOP
    IF to_regclass('public.'||index_name) IS NULL THEN
      RAISE EXCEPTION 'Missing covering foreign-key index: %', index_name;
    END IF;
  END LOOP;
  IF to_regclass('public.nb_product_drafts_recent_idx') IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate draft index was not removed';
  END IF;
END
$preflight$;

INSERT INTO public.nb_media(storage_path,original_name,mime_type,size_bytes,approved,uploaded_by)
VALUES ('11111111-1111-4111-8111-111111111111/44444444-4444-4444-8444-444444444444.jpg',
        'guard-test.jpg','image/jpeg',1024,false,'11111111-1111-4111-8111-111111111111');

-- Featured cards are allowed in a private draft but must block archive/delete
-- until unlinked; the guard must not depend on Edge Function behavior alone.
INSERT INTO public.nb_home_drafts(key,content,updated_by)
VALUES ('home',
  '{"featuredImages":{"one":"https://fixture.supabase.co/storage/v1/object/public/nb-media-public/11111111-1111-4111-8111-111111111111/44444444-4444-4444-8444-444444444444.jpg"}}'::jsonb,
  '11111111-1111-4111-8111-111111111111')
ON CONFLICT (key) DO UPDATE SET content=excluded.content,updated_by=excluded.updated_by;

DO $assert_guard$
DECLARE
  blocked_archive boolean := false;
  blocked_delete boolean := false;
BEGIN
  BEGIN
    UPDATE public.nb_media SET archived_at=now()
    WHERE storage_path='11111111-1111-4111-8111-111111111111/44444444-4444-4444-8444-444444444444.jpg';
  EXCEPTION WHEN foreign_key_violation THEN
    blocked_archive := true;
  END;
  BEGIN
    DELETE FROM public.nb_media
    WHERE storage_path='11111111-1111-4111-8111-111111111111/44444444-4444-4444-8444-444444444444.jpg';
  EXCEPTION WHEN foreign_key_violation THEN
    blocked_delete := true;
  END;
  IF NOT blocked_archive OR NOT blocked_delete THEN
    RAISE EXCEPTION 'Draft featured media must block archive AND delete';
  END IF;
END
$assert_guard$;
ROLLBACK;
