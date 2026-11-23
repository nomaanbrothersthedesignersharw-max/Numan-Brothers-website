begin;

-- Support multiple garment videos per product (up to 6 HTTPS URLs) while keeping
-- legacy video_url synchronized as the primary video.
alter table public.nb_products
  add column if not exists video_urls text[] not null default '{}';

alter table public.nb_products
  drop constraint if exists nb_product_video_urls;

alter table public.nb_products
  add constraint nb_product_video_urls check (
    array_to_string(video_urls, ' ') !~* '(javascript:|data:|file:|<)'
  );

create or replace function public.nb_sync_product_video_urls()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  draft_videos jsonb;
  parsed text[] := '{}';
  item text;
begin
  select content->'videoUrls' into draft_videos
  from public.nb_product_drafts
  where product_id = new.id;

  if jsonb_typeof(draft_videos) = 'array' then
    for item in
      select value
      from jsonb_array_elements_text(draft_videos) as t(value)
      where value ~ '^https://'
      limit 6
    loop
      parsed := array_append(parsed, item);
    end loop;
  end if;

  if cardinality(parsed) > 0 then
    new.video_urls := parsed;
    new.video_url := parsed[1];
  elsif new.video_url is not null and new.video_url ~ '^https://' then
    new.video_urls := array[new.video_url];
  else
    new.video_urls := '{}';
  end if;

  return new;
end;
$$;

drop trigger if exists nb_sync_product_video_urls_trg on public.nb_products;
create trigger nb_sync_product_video_urls_trg
  before insert or update on public.nb_products
  for each row execute function public.nb_sync_product_video_urls();

revoke all on function public.nb_sync_product_video_urls() from public, anon, authenticated;

-- Backfill existing published rows that have a single video_url
update public.nb_products
set video_urls = array[video_url]
where video_url is not null and video_url ~ '^https://' and cardinality(video_urls) = 0;

commit;
