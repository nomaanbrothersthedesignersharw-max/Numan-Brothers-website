begin;

-- Enable trigram indexing so ILIKE '%...%' product & SKU search uses GIN indexes
-- instead of sequential table scans under high concurrency.
create extension if not exists pg_trgm;

create index if not exists nb_products_title_trgm_idx
  on public.nb_products using gin (title gin_trgm_ops)
  where status = 'published';

create index if not exists nb_products_sku_trgm_idx
  on public.nb_products using gin (sku gin_trgm_ops)
  where status = 'published';

create index if not exists nb_products_published_global_idx
  on public.nb_products (sort_rank asc, updated_at desc, id asc)
  where status = 'published';

commit;
