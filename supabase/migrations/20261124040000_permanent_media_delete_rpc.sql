begin;

-- 1. Allow authenticated store owners/admins (nb_can_publish) to directly delete objects from Storage buckets
drop policy if exists nb_storage_publisher_select_all on storage.objects;
create policy nb_storage_publisher_select_all on storage.objects
  for select to authenticated
  using (
    bucket_id in ('nb-media-staging', 'nb-media-public', 'nb-media')
    and (select public.nb_can_publish())
  );

drop policy if exists nb_storage_publisher_delete on storage.objects;
create policy nb_storage_publisher_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('nb-media-staging', 'nb-media-public', 'nb-media')
    and (select public.nb_can_publish())
  );

-- 2. Atomic RPC to detach any product/homepage/category/draft references to an image or video
-- and permanently delete its nb_media metadata row, returning storage_path for S3 byte removal.
create or replace function public.nb_delete_media_permanently(p_media_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
  v_suffix text;
  v_key text;
begin
  if not public.nb_can_publish() then
    raise exception 'Only store owners or admins may permanently delete media' using errcode = '42501';
  end if;

  select storage_path into v_path
  from public.nb_media
  where id = p_media_id
  for update;

  if not found then
    return null;
  end if;

  v_suffix := '/nb-media-public/' || v_path;

  -- A) Scrub product drafts FIRST (before nb_products so nb_sync_product_video_urls trigger sees clean drafts)
  update public.nb_product_drafts d
  set content = (
    jsonb_set(
      jsonb_set(
        case
          when right(coalesce(d.content->>'videoUrl', ''), length(v_suffix)) = v_suffix
            then d.content - 'videoUrl'
          else d.content
        end,
        '{imageUrls}',
        coalesce(
          (
            select jsonb_agg(u)
            from jsonb_array_elements_text(
              case when jsonb_typeof(d.content->'imageUrls') = 'array' then d.content->'imageUrls' else '[]'::jsonb end
            ) as u
            where right(coalesce(u, ''), length(v_suffix)) <> v_suffix
          ),
          '[]'::jsonb
        ),
        true
      ),
      '{videoUrls}',
      coalesce(
        (
          select jsonb_agg(u)
          from jsonb_array_elements_text(
            case when jsonb_typeof(d.content->'videoUrls') = 'array' then d.content->'videoUrls' else '[]'::jsonb end
          ) as u
          where right(coalesce(u, ''), length(v_suffix)) <> v_suffix
        ),
        '[]'::jsonb
      ),
      true
    )
  )
  where right(coalesce(d.content->>'videoUrl', ''), length(v_suffix)) = v_suffix
     or exists (
       select 1 from jsonb_array_elements_text(
         case when jsonb_typeof(d.content->'imageUrls') = 'array' then d.content->'imageUrls' else '[]'::jsonb end
       ) as u where right(coalesce(u, ''), length(v_suffix)) = v_suffix
     )
     or exists (
       select 1 from jsonb_array_elements_text(
         case when jsonb_typeof(d.content->'videoUrls') = 'array' then d.content->'videoUrls' else '[]'::jsonb end
       ) as u where right(coalesce(u, ''), length(v_suffix)) = v_suffix
     );

  -- B) Scrub homepage drafts
  update public.nb_home_drafts d
  set content = (
    select jsonb_set(
      jsonb_set(
        (
          select coalesce(jsonb_object_agg(
            kv.key,
            case
              when kv.key in ('heroImage','menImage','kidsImage','storyImage','customizationImage')
                   and jsonb_typeof(kv.value) = 'string'
                   and right(kv.value #>> '{}', length(v_suffix)) = v_suffix
                then to_jsonb(''::text)
              else kv.value
            end
          ), '{}'::jsonb)
          from jsonb_each(d.content) as kv(key, value)
        ),
        '{featuredImages}',
        coalesce(
          (
            select jsonb_object_agg(
              f.key,
              case when right(coalesce(f.val, ''), length(v_suffix)) = v_suffix then '' else f.val end
            )
            from jsonb_each_text(
              case when jsonb_typeof(d.content->'featuredImages') = 'object' then d.content->'featuredImages' else '{}'::jsonb end
            ) as f(key, val)
          ),
          '{}'::jsonb
        ),
        true
      ),
      '{sectionVideos}',
      coalesce(
        (
          select jsonb_object_agg(s.key, s.val)
          from jsonb_each_text(
            case when jsonb_typeof(d.content->'sectionVideos') = 'object' then d.content->'sectionVideos' else '{}'::jsonb end
          ) as s(key, val)
          where right(coalesce(s.val, ''), length(v_suffix)) <> v_suffix
        ),
        '{}'::jsonb
      ),
      true
    )
  )
  where d.key = 'home';

  -- C) Scrub homepage public (under home publish scope)
  perform set_config('app.nb_publish_scope', 'home', true);
  update public.nb_home_public h
  set content = (
    select jsonb_set(
      jsonb_set(
        (
          select coalesce(jsonb_object_agg(
            kv.key,
            case
              when kv.key in ('heroImage','menImage','kidsImage','storyImage','customizationImage')
                   and jsonb_typeof(kv.value) = 'string'
                   and right(kv.value #>> '{}', length(v_suffix)) = v_suffix
                then to_jsonb(''::text)
              else kv.value
            end
          ), '{}'::jsonb)
          from jsonb_each(h.content) as kv(key, value)
        ),
        '{featuredImages}',
        coalesce(
          (
            select jsonb_object_agg(
              f.key,
              case when right(coalesce(f.val, ''), length(v_suffix)) = v_suffix then '' else f.val end
            )
            from jsonb_each_text(
              case when jsonb_typeof(h.content->'featuredImages') = 'object' then h.content->'featuredImages' else '{}'::jsonb end
            ) as f(key, val)
          ),
          '{}'::jsonb
        ),
        true
      ),
      '{sectionVideos}',
      coalesce(
        (
          select jsonb_object_agg(s.key, s.val)
          from jsonb_each_text(
            case when jsonb_typeof(h.content->'sectionVideos') = 'object' then h.content->'sectionVideos' else '{}'::jsonb end
          ) as s(key, val)
          where right(coalesce(s.val, ''), length(v_suffix)) <> v_suffix
        ),
        '{}'::jsonb
      ),
      true
    )
  )
  where h.key = 'home';

  -- D) Scrub categories
  update public.nb_categories
  set image_url = null
  where right(coalesce(image_url, ''), length(v_suffix)) = v_suffix;

  -- E) Scrub published & archived products and product_media (under product publish scope)
  perform set_config('app.nb_publish_scope', 'product', true);

  delete from public.nb_product_media where media_id = p_media_id;

  update public.nb_products p
  set
    image_urls = coalesce(
      array(
        select u from unnest(p.image_urls) as u
        where right(coalesce(u, ''), length(v_suffix)) <> v_suffix
      ),
      '{}'
    ),
    video_urls = coalesce(
      array(
        select u from unnest(p.video_urls) as u
        where right(coalesce(u, ''), length(v_suffix)) <> v_suffix
      ),
      '{}'
    ),
    video_url = case
      when right(coalesce(p.video_url, ''), length(v_suffix)) = v_suffix then null
      else p.video_url
    end,
    status = case
      when p.status = 'published' and not exists (
        select 1 from unnest(p.image_urls) as u
        where right(coalesce(u, ''), length(v_suffix)) <> v_suffix
      ) then 'archived'
      else p.status
    end,
    published_at = case
      when p.status = 'published' and not exists (
        select 1 from unnest(p.image_urls) as u
        where right(coalesce(u, ''), length(v_suffix)) <> v_suffix
      ) then null
      else p.published_at
    end
  where right(coalesce(p.video_url, ''), length(v_suffix)) = v_suffix
     or exists (select 1 from unnest(p.image_urls) as u where right(coalesce(u, ''), length(v_suffix)) = v_suffix)
     or exists (select 1 from unnest(p.video_urls) as u where right(coalesce(u, ''), length(v_suffix)) = v_suffix);

  perform set_config('app.nb_publish_scope', '', true);

  -- F) Now all lifecycle triggers are satisfied; delete the media metadata row
  delete from public.nb_media where id = p_media_id;

  return v_path;
end;
$$;

revoke all on function public.nb_delete_media_permanently(uuid) from public, anon;
grant execute on function public.nb_delete_media_permanently(uuid) to authenticated;

commit;
