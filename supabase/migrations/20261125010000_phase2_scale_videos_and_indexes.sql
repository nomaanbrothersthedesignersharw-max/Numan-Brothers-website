begin;

-- Phase 2 (#7): Covering partial indexes for 10,000+ published products without sequential scans
create index if not exists nb_products_pub_dept_sort_idx
  on public.nb_products (department, sort_rank asc, updated_at desc, id asc)
  where status = 'published';

create index if not exists nb_products_pub_price_idx
  on public.nb_products (price asc, sort_rank asc, id asc)
  where status = 'published' and price is not null;

create index if not exists nb_products_pub_custom_idx
  on public.nb_products (department, sort_rank asc, id asc)
  where status = 'published' and customizable = true;

-- Phase 2 (#9): Normalized product videos table supporting 100-200+ videos per product
-- with paginated delivery and async transcoding metadata (HLS/MP4/poster thumbnail).
create table if not exists public.nb_product_videos (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.nb_products(id) on delete cascade,
  media_id uuid references public.nb_media(id) on delete set null,
  playback_url text not null check (playback_url ~ '^https://'),
  thumbnail_url text check (thumbnail_url is null or thumbnail_url ~ '^https://'),
  title text not null default '' check (char_length(title) <= 180),
  duration_sec integer check (duration_sec is null or duration_sec >= 0),
  sort_order integer not null default 0,
  status text not null default 'ready' check (status in ('processing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, playback_url)
);

create index if not exists nb_product_videos_product_order_idx
  on public.nb_product_videos (product_id, sort_order asc, created_at desc)
  where status = 'ready';

alter table public.nb_product_videos enable row level security;
revoke all on public.nb_product_videos from public, anon, authenticated;
grant select on public.nb_product_videos to anon, authenticated;
grant insert, update, delete on public.nb_product_videos to authenticated;

drop policy if exists nb_product_videos_public_read on public.nb_product_videos;
create policy nb_product_videos_public_read on public.nb_product_videos
  for select to anon, authenticated
  using (
    status = 'ready'
    and exists (
      select 1 from public.nb_products p
      where p.id = product_id and p.status = 'published'
    )
  );

drop policy if exists nb_product_videos_staff_read on public.nb_product_videos;
create policy nb_product_videos_staff_read on public.nb_product_videos
  for select to authenticated
  using ((select public.nb_can_edit()));

drop policy if exists nb_product_videos_publisher_write on public.nb_product_videos;
create policy nb_product_videos_publisher_write on public.nb_product_videos
  for all to authenticated
  using ((select public.nb_can_publish()))
  with check ((select public.nb_can_publish()));

-- Backfill any existing product videos from nb_products.video_urls into nb_product_videos
insert into public.nb_product_videos (product_id, playback_url, sort_order, status)
select p.id, v.url, (v.ord - 1)::integer, 'ready'
from public.nb_products p
cross join lateral unnest(p.video_urls) with ordinality as v(url, ord)
where v.url ~ '^https://'
on conflict (product_id, playback_url) do nothing;

commit;
