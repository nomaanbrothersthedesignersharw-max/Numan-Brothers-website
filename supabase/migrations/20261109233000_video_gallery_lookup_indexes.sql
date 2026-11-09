BEGIN;
-- Fast reference checks when a video asset is being removed or replaced.
-- Both PostgREST contains() lookups use PostgreSQL @> operators, supported
-- by these GIN indexes (array_ops and jsonb_path_ops respectively).
CREATE INDEX IF NOT EXISTS nb_products_video_urls_gin_idx
  ON public.nb_products USING gin (video_urls);

CREATE INDEX IF NOT EXISTS nb_product_drafts_content_gin_idx
  ON public.nb_product_drafts USING gin (content jsonb_path_ops);

ANALYZE public.nb_products;
ANALYZE public.nb_product_drafts;
COMMIT;
