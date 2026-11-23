begin;

alter table public.nb_reviews
  add column if not exists photo_urls text[] not null default '{}';

-- Column-level permissions for public reads and review submissions
grant select (photo_urls) on public.nb_reviews to anon;
grant insert (photo_urls) on public.nb_reviews to anon, authenticated;

commit;
