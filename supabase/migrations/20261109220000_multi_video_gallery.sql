BEGIN;

-- Add a first-class, bounded video gallery while keeping video_url as the
-- compatibility field for older storefront clients and SEO consumers.
ALTER TABLE public.nb_products
  ADD COLUMN IF NOT EXISTS video_urls text[] NOT NULL DEFAULT '{}';

DO $video_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.nb_products'::regclass
      AND conname='nb_products_video_urls_limit'
  ) THEN
    ALTER TABLE public.nb_products
      ADD CONSTRAINT nb_products_video_urls_limit
      CHECK (
        cardinality(video_urls) <= 200
        AND array_to_string(video_urls,' ') !~* '(javascript:|data:|file:|<)'
      );
  END IF;
END
$video_constraint$;

create or replace function public.nb_publish_product(p_product_id uuid)
returns integer language plpgsql security invoker set search_path = ''
as $$
declare
  draft jsonb;
  next_version integer;
  paths text[];
  photos text[];
  sizes_value text[];
  product_sku text;
  product_slug text;
  product_title text;
  product_dept text;
  product_video text;
  product_videos text[];
  product_price numeric;
  product_offer numeric;
  product_customizable boolean;
begin
  if not public.nb_can_publish() then
    raise exception 'Not authorized to publish' using errcode = '42501';
  end if;
  perform set_config('app.nb_publish_scope','product',true);
  select content into draft from public.nb_product_drafts
    where product_id = p_product_id for update;
  if not found then
    raise exception 'Save a product draft before publishing';
  end if;
  product_sku := trim(coalesce(draft->>'sku',''));
  product_slug := trim(coalesce(draft->>'slug',''));
  product_title := trim(coalesce(draft->>'title',''));
  product_dept := coalesce(draft->>'department','');
  product_video := nullif(trim(coalesce(draft->>'videoUrl','')), '');
  if jsonb_typeof(coalesce(draft->'videoUrls','[]'::jsonb)) <> 'array' then
    raise exception 'Video gallery must be an array';
  end if;
  select coalesce(array_agg(url order by ordinal), '{}') into product_videos
    from (
      select distinct on (url) url, ordinal
      from (
        select trim(value) as url, ordinal::integer as ordinal
        from jsonb_array_elements_text(coalesce(draft->'videoUrls','[]'::jsonb))
          with ordinality as entries(value,ordinal)
        union all
        select product_video, 0 where product_video is not null
      ) as candidates
      where url is not null and url <> ''
      order by url,ordinal
    ) as videos;
  if cardinality(product_videos) > 200 then
    raise exception 'A product can contain at most 200 video links';
  end if;
  if exists(select 1 from unnest(product_videos) as item(url) where url !~ '^https://') then
    raise exception 'Every product video must use HTTPS';
  end if;
  if exists (
    select 1 from unnest(product_videos) as item(url)
    where position('/storage/v1/object/public/nb-media-public/' in url)>0
      and not exists (
        select 1 from public.nb_media m
        where m.approved and m.mime_type like 'video/%'
          and url=public.nb_media_public_url(m.storage_path)
      )
  ) then
    raise exception 'Product videos must be approved video assets from this Media library';
  end if;
  product_video := coalesce(product_video, product_videos[1]);
  if length(product_title) < 2 or length(product_title) > 180
    or length(product_sku) < 2 or length(product_sku) > 80
    or product_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or product_dept not in ('men','kids') then
    raise exception 'Invalid SKU, title, slug or department';
  end if;
  if jsonb_typeof(draft->'categoryPaths') <> 'array'
    or jsonb_typeof(draft->'imageUrls') <> 'array'
    or jsonb_typeof(coalesce(draft->'sizes','[]'::jsonb)) <> 'array' then
    raise exception 'Invalid product category or image list';
  end if;
  select coalesce(array_agg(val), '{}') into paths
    from jsonb_array_elements_text(draft->'categoryPaths') as vals(val);
  select coalesce(array_agg(val), '{}') into photos
    from jsonb_array_elements_text(draft->'imageUrls') as vals(val);
  select coalesce(array_agg(val), '{}') into sizes_value
    from jsonb_array_elements_text(coalesce(draft->'sizes','[]'::jsonb)) as vals(val);
  if cardinality(paths) = 0 or cardinality(photos) = 0 then
    raise exception 'Choose a collection and at least one approved image';
  end if;
  if exists (
    select 1 from unnest(paths) as routes(route)
    where not exists (
      select 1 from public.nb_categories c
      where c.path = route and c.active and c.department = product_dept
    )
  ) then
    raise exception 'A category is inactive, invalid or in the wrong department';
  end if;
  if exists (
    select 1 from unnest(photos) as photos_input(photo)
    where not exists (
      select 1 from public.nb_media m
      where m.approved and photo = public.nb_media_public_url(m.storage_path)
    )
  ) then
    raise exception 'Publish images from the approved media library only';
  end if;
  if product_video is not null and product_video !~ '^https://' then
    raise exception 'Videos must use HTTPS';
  end if;
  product_price := nullif(draft->>'price','')::numeric;
  product_offer := nullif(draft->>'offerPrice','')::numeric;
  product_customizable := coalesce((draft->>'customizable')::boolean,false);
  if product_price is not null and product_price < 0 then
    raise exception 'Price cannot be negative';
  end if;
  if product_offer is not null and (product_price is null or product_offer < 0 or product_offer >= product_price) then
    raise exception 'Offer price must be non-negative and lower than the original price';
  end if;
  insert into public.nb_products (
    id,sku,slug,title,department,category_paths,description,fabric,sizes,
    image_urls,video_url,video_urls,price,offer_price,customizable,status,sort_rank,published_at,created_by
  ) values (
    p_product_id,product_sku,product_slug,product_title,product_dept,paths,
    coalesce(draft->>'description',''),coalesce(draft->>'fabric',''),sizes_value,
    photos,product_video,product_videos,product_price,product_offer,product_customizable,'published',
    coalesce((draft->>'sortRank')::integer,0),now(),auth.uid()
  )
  on conflict (id) do update set
    sku = excluded.sku, slug = excluded.slug, title = excluded.title,
    department = excluded.department, category_paths = excluded.category_paths,
    description = excluded.description, fabric = excluded.fabric,
    sizes = excluded.sizes, image_urls = excluded.image_urls,
    video_url = excluded.video_url, video_urls = excluded.video_urls, price = excluded.price,
    offer_price = excluded.offer_price, customizable = excluded.customizable,
    status = 'published', sort_rank = excluded.sort_rank, published_at = now();
  select coalesce(max(version),0)+1 into next_version
    from public.nb_product_revisions where product_id = p_product_id;
  insert into public.nb_product_revisions(product_id,version,content,published_by)
    values (p_product_id,next_version,draft,auth.uid());
  perform set_config('app.nb_publish_scope','',true);
  return next_version;
end;
$$;

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
         SELECT 1 FROM unnest(coalesce(p.video_urls,'{}'::text[])) AS video(url)
         WHERE right(coalesce(video.url,''), length(suffix))=suffix
       )
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
           CASE WHEN jsonb_typeof(d.content->'videoUrls')='array'
                THEN d.content->'videoUrls' ELSE '[]'::jsonb END
         ) AS video(url)
         WHERE right(coalesce(video.url,''), length(suffix))=suffix
       )
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

COMMIT;
