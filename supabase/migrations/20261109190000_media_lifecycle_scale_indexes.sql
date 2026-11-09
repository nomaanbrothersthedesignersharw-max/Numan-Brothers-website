begin;
set local search_path = public, extensions;
-- Noman Brothers: production media lifecycle and indexed staff/media FKs.
-- Forward-only, idempotent on the reviewed 14-migration base.
-- Existing data is not seeded or deleted. Imported audit rows are retained,
-- with media_id set NULL when an otherwise unreferenced asset is removed.
-- Run via Supabase migration tooling or the updated SQL Editor fresh installer.

-- Stop immediately if this is not the installed Noman Brothers CMS schema.
DO $preflight$
BEGIN
  IF to_regclass('public.nb_media') IS NULL
     OR to_regclass('public.nb_product_media') IS NULL
     OR to_regclass('public.nb_products') IS NULL
     OR to_regclass('public.nb_product_drafts') IS NULL
     OR to_regclass('public.nb_categories') IS NULL
     OR to_regclass('public.nb_home_public') IS NULL
     OR to_regclass('public.nb_home_drafts') IS NULL
     OR to_regclass('public.nb_import_rows') IS NULL
     OR to_regclass('public.nb_sku_counters') IS NULL
     OR to_regclass('public.nb_reviews') IS NULL
     OR to_regnamespace('nb_internal') IS NULL
     OR NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='nb-media-staging' AND public = false)
     OR NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='nb-media-public' AND public = true)
  THEN
    RAISE EXCEPTION 'Noman CMS base installation is incomplete; run the 14-migration fresh installer FIRST';
  END IF;
END
$preflight$;

-- Uploaded paths exactly match src/lib/cmsUpload.ts: user-uuid/object-uuid.ext.
-- This also keeps lifecycle reference checks unambiguous. For a populated
-- legacy project, audit existing paths BEFORE attempting this constraint.
DO $path_check$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conrelid='public.nb_media'::regclass AND conname='nb_media_managed_path_format'
 ) THEN
   ALTER TABLE public.nb_media
     ADD CONSTRAINT nb_media_managed_path_format CHECK (
       storage_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|avif|gif|mp4|webm)$'
       AND split_part(storage_path,'/',1) = uploaded_by::text
     );
 END IF;
END
$path_check$;

CREATE INDEX IF NOT EXISTS nb_media_archive_recent_idx
  ON public.nb_media (archived_at, created_at DESC, id DESC);

-- Keep import history intact if an otherwise unused media asset is truly
-- deleted. Otherwise the original ON DELETE RESTRICT FK makes the Edge
-- Function fail at its FINAL database delete, after Storage objects are gone.
-- media_id is optional on import history rows; null means asset was removed.
ALTER TABLE public.nb_import_rows
  DROP CONSTRAINT IF EXISTS nb_import_rows_media_id_fkey;
ALTER TABLE public.nb_import_rows
  ADD CONSTRAINT nb_import_rows_media_id_fkey
  FOREIGN KEY (media_id) REFERENCES public.nb_media(id) ON DELETE SET NULL;

-- Server-side protection, independently enforced for privileged writes.
-- Covers live & archived product associations, direct product URLs, category
-- covers, published homepage, SAVED homepage/product drafts and new featured
-- cards, customization banner and per-section videos. Approval revocation,
-- archiving and metadata deletion are rejected until links are removed.
CREATE OR REPLACE FUNCTION nb_internal.nb_guard_media_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $guard$
DECLARE
  suffix text := '/nb-media-public/' || OLD.storage_path;
  content_keys text[] := ARRAY[
    'heroImage','menImage','kidsImage','storyImage','customizationImage'
  ];
BEGIN
  IF TG_OP='UPDATE' THEN
    -- Restore, label edits or approval do not remove a usable asset.
    IF NOT (
      (OLD.approved = true AND NEW.approved = false)
      OR (OLD.archived_at IS DISTINCT FROM NEW.archived_at
          AND NEW.archived_at IS NOT NULL)
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.nb_product_media pm WHERE pm.media_id=OLD.id
  ) OR EXISTS (
    SELECT 1 FROM public.nb_products p
    WHERE right(coalesce(p.video_url,''), length(suffix))=suffix
       OR EXISTS (
         SELECT 1 FROM unnest(p.image_urls) AS photo(url)
         WHERE right(coalesce(photo.url,''), length(suffix))=suffix
       )
  ) OR EXISTS (
    SELECT 1 FROM public.nb_categories c
    WHERE right(coalesce(c.image_url,''), length(suffix))=suffix
  ) OR EXISTS (
    SELECT 1 FROM public.nb_product_drafts d
    WHERE right(coalesce(d.content->>'videoUrl',''), length(suffix))=suffix
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(d.content->'imageUrls')='array'
                THEN d.content->'imageUrls' ELSE '[]'::jsonb END
         ) AS photo(url)
         WHERE right(coalesce(photo.url,''), length(suffix))=suffix
       )
  ) OR EXISTS (
    SELECT 1 FROM public.nb_home_public h
    WHERE EXISTS (
      SELECT 1 FROM unnest(content_keys) AS k(field_name)
      WHERE right(coalesce(h.content->>k.field_name,''), length(suffix))=suffix
    ) OR EXISTS (
      SELECT 1 FROM jsonb_each_text(
        CASE WHEN jsonb_typeof(h.content->'sectionVideos')='object'
          THEN h.content->'sectionVideos' ELSE '{}'::jsonb END
      ) AS v(key,url)
      WHERE right(coalesce(v.url,''), length(suffix))=suffix
    ) OR EXISTS (
      SELECT 1 FROM jsonb_each_text(
        CASE WHEN jsonb_typeof(h.content->'featuredImages')='object'
          THEN h.content->'featuredImages' ELSE '{}'::jsonb END
      ) AS f(key,url)
      WHERE right(coalesce(f.url,''), length(suffix))=suffix
    )
  ) OR EXISTS (
    SELECT 1 FROM public.nb_home_drafts d
    WHERE EXISTS (
      SELECT 1 FROM unnest(content_keys) AS k(field_name)
      WHERE right(coalesce(d.content->>k.field_name,''), length(suffix))=suffix
    ) OR EXISTS (
      SELECT 1 FROM jsonb_each_text(
        CASE WHEN jsonb_typeof(d.content->'sectionVideos')='object'
          THEN d.content->'sectionVideos' ELSE '{}'::jsonb END
      ) AS v(key,url)
      WHERE right(coalesce(v.url,''), length(suffix))=suffix
    ) OR EXISTS (
      SELECT 1 FROM jsonb_each_text(
        CASE WHEN jsonb_typeof(d.content->'featuredImages')='object'
          THEN d.content->'featuredImages' ELSE '{}'::jsonb END
      ) AS f(key,url)
      WHERE right(coalesce(f.url,''), length(suffix))=suffix
    )
  ) THEN
    RAISE EXCEPTION
      'Media is still referenced by a product, collection, published page or saved draft. Unlink and save/publish its replacement first.'
      USING ERRCODE='23503';
  END IF;

  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$guard$;

REVOKE ALL ON FUNCTION nb_internal.nb_guard_media_lifecycle()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS nb_media_lifecycle_update_guard ON public.nb_media;
CREATE TRIGGER nb_media_lifecycle_update_guard
  BEFORE UPDATE OF approved, archived_at ON public.nb_media
  FOR EACH ROW EXECUTE FUNCTION nb_internal.nb_guard_media_lifecycle();

DROP TRIGGER IF EXISTS nb_media_lifecycle_delete_guard ON public.nb_media;
CREATE TRIGGER nb_media_lifecycle_delete_guard
  BEFORE DELETE ON public.nb_media
  FOR EACH ROW EXECUTE FUNCTION nb_internal.nb_guard_media_lifecycle();

-- No client-side hard deletes. Only privileged Edge Function service client
-- may delete metadata once its Storage files have been reconciled.
REVOKE DELETE ON public.nb_media FROM PUBLIC, anon, authenticated;

-- The original 14 migrations already create all the required media/storage
-- buckets, publishing RPCs, catalogue tables and RLS. Do NOT duplicate them.
DO $assert$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.nb_media'::regclass
      AND tgname='nb_media_lifecycle_delete_guard' AND NOT tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.nb_media'::regclass
      AND tgname='nb_media_lifecycle_update_guard' AND NOT tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.nb_import_rows'::regclass
      AND conname='nb_import_rows_media_id_fkey' AND confdeltype='n'
  ) THEN
    RAISE EXCEPTION 'Phase 2 lifecycle safeguards were not completely installed';
  END IF;
END
$assert$;

-- Supabase Performance Advisor: cover eight FK columns used in lookups,
-- staff audits, and clean-up. No full table rewrite or data deletion.
CREATE INDEX IF NOT EXISTS nb_home_drafts_updated_by_fk_idx
  ON public.nb_home_drafts (updated_by);
CREATE INDEX IF NOT EXISTS nb_home_public_published_by_fk_idx
  ON public.nb_home_public (published_by);
CREATE INDEX IF NOT EXISTS nb_home_revisions_published_by_fk_idx
  ON public.nb_home_revisions (published_by);
CREATE INDEX IF NOT EXISTS nb_import_rows_media_id_fk_idx
  ON public.nb_import_rows (media_id);
CREATE INDEX IF NOT EXISTS nb_media_uploaded_by_fk_idx
  ON public.nb_media (uploaded_by);
CREATE INDEX IF NOT EXISTS nb_product_drafts_updated_by_fk_idx
  ON public.nb_product_drafts (updated_by);
CREATE INDEX IF NOT EXISTS nb_product_revisions_published_by_fk_idx
  ON public.nb_product_revisions (published_by);
CREATE INDEX IF NOT EXISTS nb_products_created_by_fk_idx
  ON public.nb_products (created_by);

-- Supabase Advisor confirmed these two had identical columns and order.
-- Keep the 'changed' index, drop the unused duplicate 'recent' index.
DROP INDEX IF EXISTS public.nb_product_drafts_recent_idx;

commit;
