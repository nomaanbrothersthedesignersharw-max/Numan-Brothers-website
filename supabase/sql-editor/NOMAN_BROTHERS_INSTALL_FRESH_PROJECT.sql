-- =============================================================================
-- NOMAN BROTHERS / SUPABASE / SQL EDITOR ONE-TIME FRESH PROJECT INSTALL
-- BEFORE RUNNING: confirm the active project in your Supabase Dashboard.
-- Reusable for any NEW, EMPTY, client-owned Supabase project.
-- No project reference, service key, admin email or password is hardcoded.
--
-- This single file faithfully concatenates the TWENTY reviewed versioned
-- migrations from this repository, in exact order.
--
-- READ FIRST:
-- 1. Use ONLY the brand-new Noman project, never the unrelated "gym" project.
-- 2. This installer refuses any previously created NB tables/functions/buckets.
-- 3. Paste the WHOLE file into a new Supabase Dashboard > SQL Editor query.
-- 4. All twenty migrations run in ONE PostgreSQL transaction. An SQL error
--    prevents COMMIT; do not manually skip failing statements.
-- 5. No product or client data are seeded. Only route taxonomy is inserted.
-- 6. This SQL Editor method does NOT record entries in Supabase CLI migration
--    history. Do not later run 'supabase db push' on the same project without
--    explicitly reconciling migration history (see installation guide).
-- 7. SQL cannot deploy the nb-media-approval Edge Function, create real Auth
--    accounts, configure Vercel keys, or validate live image/video workflows.
--    Those are required SEPARATE steps after this install.
-- =============================================================================
BEGIN;
SET LOCAL search_path = public, extensions;
SET LOCAL lock_timeout = '10s';

-- Fail closed: never reinstall onto an already-initialized project.
DO $nb_fresh_project_only$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND left(c.relname,3)='nb_'
      AND c.relkind IN ('r','p','v','m')
  ) OR EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND left(p.proname,3)='nb_'
  ) OR EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname='nb_internal'
  ) OR EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id IN ('nb-media', 'nb-media-staging', 'nb-media-public')
  ) THEN
    RAISE EXCEPTION
      'Noman installation stopped: an existing NB schema/bucket was found. Inspect it; do NOT rerun the installer.'
      USING ERRCODE='55000';
  END IF;
END
$nb_fresh_project_only$;

-- =============================================================================
-- 1 / 20: 20261107060000_nomaan_cms.sql
-- Source: supabase/migrations/20261107060000_nomaan_cms.sql
-- =============================================================================
-- Nomaan Brothers CMS: isolated, fail-closed schema. Apply ONLY to a dedicated
-- client-owned Supabase project, never to the connected "gym" project.
-- No demo products, no public-write policies, no destructive legacy-table drops.

create table if not exists public.nb_categories (
  path text primary key check (path ~ '^/(men|kids)(/[a-z0-9-]+)*$'),
  department text not null check (department in ('men','kids')),
  label text not null check (char_length(trim(label)) between 1 and 100),
  description text not null default '',
  image_url text,
  sort_order integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.nb_products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique check (char_length(trim(sku)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(trim(title)) between 2 and 180),
  department text not null check (department in ('men','kids')),
  category_paths text[] not null default '{}',
  description text not null default '',
  fabric text not null default '',
  sizes text[] not null default '{}',
  image_urls text[] not null default '{}',
  video_url text,
  price numeric(12,2) check (price is null or price >= 0),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sort_rank integer not null default 0,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nb_publish_requires_catalog check (
    status <> 'published' or
    (cardinality(category_paths) > 0 and cardinality(image_urls) > 0)
  ),
  constraint nb_product_media_urls check (
    array_to_string(image_urls, ' ') !~* '(javascript:|data:|file:|<)'
    and (video_url is null or video_url ~ '^https://')
  )
);
create index if not exists nb_products_published_idx
  on public.nb_products (department, sort_rank, updated_at desc)
  where status = 'published';
create index if not exists nb_products_categories_idx on public.nb_products using gin (category_paths);

create table if not exists public.nb_media (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique check (storage_path !~ '(^/|[.][.])'),
  original_name text not null check (char_length(original_name) between 1 and 220),
  mime_type text not null check (mime_type in (
    'image/jpeg','image/png','image/webp','image/avif','image/gif',
    'video/mp4','video/webm'
  )),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  alt_text text not null default '' check (char_length(alt_text) <= 400),
  approved boolean not null default false,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nb_media_recent_idx on public.nb_media (created_at desc);

create table if not exists public.nb_home_drafts (
  key text primary key check (key = 'home'),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 30000),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create table if not exists public.nb_home_public (
  key text primary key check (key = 'home'),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 30000),
  version integer not null default 1 check (version > 0),
  published_by uuid references auth.users(id),
  published_at timestamptz not null default now()
);
create table if not exists public.nb_home_revisions (
  id bigint generated always as identity primary key,
  key text not null check (key = 'home'),
  version integer not null check (version > 0),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  published_by uuid references auth.users(id),
  published_at timestamptz not null default now(),
  unique (key, version)
);

create table if not exists public.nb_product_drafts (
  product_id uuid primary key,
  content jsonb not null check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 45000),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
create table if not exists public.nb_product_revisions (
  id bigint generated always as identity primary key,
  product_id uuid not null,
  version integer not null check (version > 0),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  published_by uuid references auth.users(id),
  published_at timestamptz not null default now(),
  unique(product_id, version)
);

-- Roles are assigned by Supabase Auth administration ONLY (app_metadata).
-- Never authorize against mutable user_metadata or just 'authenticated'.
create or replace function public.nb_can_edit()
returns boolean language sql stable security invoker
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'nb_role', '')
      in ('owner','admin','editor');
$$;
create or replace function public.nb_can_publish()
returns boolean language sql stable security invoker
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'nb_role', '')
      in ('owner','admin');
$$;
create or replace function public.nb_is_owner()
returns boolean language sql stable security invoker
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'nb_role', '') = 'owner';
$$;
-- Use the verified Supabase Auth JWT issuer to lock published assets
-- to the intended project, rejecting third-party lookalike URLs.
create or replace function public.nb_media_public_url(path text)
returns text language sql stable security invoker set search_path = ''
as $$
  select case
    when ((select auth.jwt()) ->> 'iss')
      ~ '^https://[a-z0-9-]+[.]supabase[.]co/auth/v1$'
    then regexp_replace((select auth.jwt()) ->> 'iss','/auth/v1$','')
      || '/storage/v1/object/public/nb-media/' || path
    else null
  end;
$$;

create or replace function public.nb_touch_updated_at()
returns trigger language plpgsql security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Protect the materialized public tables from direct REST writes even by
-- publishers. Only nb_publish_product()/nb_publish_home() may perform them.
-- The scope GUC is transaction-local and set only inside role-checked RPCs.
create or replace function public.nb_require_publish_scope()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.nb_can_publish() or
    current_setting('app.nb_publish_scope', true) is distinct from TG_ARGV[0] then
    raise exception 'Use the publishing workflow' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists nb_materialized_product_guard on public.nb_products;
create trigger nb_materialized_product_guard before insert or update on public.nb_products
  for each row execute function public.nb_require_publish_scope('product');
drop trigger if exists nb_materialized_home_guard on public.nb_home_public;
create trigger nb_materialized_home_guard before insert or update on public.nb_home_public
  for each row execute function public.nb_require_publish_scope('home');

-- Published revision history must be created only by an authorized publishing
-- transaction. RLS by itself does not prevent a publisher from forging history.
drop trigger if exists nb_product_revision_guard on public.nb_product_revisions;
create trigger nb_product_revision_guard before insert on public.nb_product_revisions
  for each row execute function public.nb_require_publish_scope('product');
drop trigger if exists nb_home_revision_guard on public.nb_home_revisions;
create trigger nb_home_revision_guard before insert on public.nb_home_revisions
  for each row execute function public.nb_require_publish_scope('home');

drop trigger if exists nb_touch_product on public.nb_products;
create trigger nb_touch_product before update on public.nb_products
  for each row execute function public.nb_touch_updated_at();
drop trigger if exists nb_touch_product_drafts on public.nb_product_drafts;
create trigger nb_touch_product_drafts before update on public.nb_product_drafts
  for each row execute function public.nb_touch_updated_at();
drop trigger if exists nb_touch_media on public.nb_media;
create trigger nb_touch_media before update on public.nb_media
  for each row execute function public.nb_touch_updated_at();
drop trigger if exists nb_touch_categories on public.nb_categories;
create trigger nb_touch_categories before update on public.nb_categories
  for each row execute function public.nb_touch_updated_at();
drop trigger if exists nb_touch_home_draft on public.nb_home_drafts;
create trigger nb_touch_home_draft before update on public.nb_home_drafts
  for each row execute function public.nb_touch_updated_at();

alter table public.nb_categories enable row level security;
alter table public.nb_products enable row level security;
alter table public.nb_product_drafts enable row level security;
alter table public.nb_product_revisions enable row level security;
alter table public.nb_media enable row level security;
alter table public.nb_home_drafts enable row level security;
alter table public.nb_home_public enable row level security;
alter table public.nb_home_revisions enable row level security;

revoke all on public.nb_categories, public.nb_products, public.nb_product_drafts,
  public.nb_product_revisions, public.nb_media,
  public.nb_home_drafts, public.nb_home_public, public.nb_home_revisions
  from public, anon, authenticated;
grant select on public.nb_categories, public.nb_products,
  public.nb_home_public to anon;
grant select on public.nb_categories, public.nb_products, public.nb_product_drafts,
  public.nb_product_revisions, public.nb_media,
  public.nb_home_drafts, public.nb_home_public, public.nb_home_revisions
  to authenticated;
grant insert, update on public.nb_products, public.nb_product_drafts, public.nb_media,
  public.nb_home_drafts, public.nb_home_public to authenticated;
grant insert on public.nb_product_revisions to authenticated;
grant insert on public.nb_home_revisions to authenticated;
grant update on public.nb_categories to authenticated;
-- Phase 1 least privilege: no routine hard deletes through the browser API.
-- Soft archive and audited cleanup operations are introduced in later phases.
grant usage, select on sequence public.nb_home_revisions_id_seq,
  public.nb_product_revisions_id_seq to authenticated;

-- Public catalogue reads only enabled categories, approved media metadata,
-- published garments and the approved homepage document.
create policy nb_categories_public_select on public.nb_categories for select
  to anon, authenticated using (active or (select public.nb_can_edit()));
create policy nb_categories_publisher_update on public.nb_categories for update
  to authenticated using ((select public.nb_can_publish()))
  with check ((select public.nb_can_publish()));
create policy nb_products_public_select on public.nb_products for select
  to anon, authenticated using (status = 'published' or (select public.nb_can_edit()));
create policy nb_products_publisher_insert on public.nb_products for insert
  to authenticated with check ((select public.nb_can_publish()) and created_by = (select auth.uid()));
create policy nb_products_publisher_update on public.nb_products for update
  to authenticated using ((select public.nb_can_publish()))
  with check ((select public.nb_can_publish()));
create policy nb_product_drafts_staff_select on public.nb_product_drafts for select
  to authenticated using ((select public.nb_can_edit()));
create policy nb_product_drafts_editor_insert on public.nb_product_drafts for insert
  to authenticated with check (
    (select public.nb_can_edit()) and updated_by = (select auth.uid())
  );
create policy nb_product_drafts_editor_update on public.nb_product_drafts for update
  to authenticated using ((select public.nb_can_edit()))
  with check ((select public.nb_can_edit()) and updated_by = (select auth.uid()));
create policy nb_product_revisions_staff_select on public.nb_product_revisions for select
  to authenticated using ((select public.nb_can_edit()));
create policy nb_product_revisions_publisher_insert on public.nb_product_revisions for insert
  to authenticated with check ((select public.nb_can_publish()) and published_by = (select auth.uid()));
-- No public API delete policy for products; archives replace destructive deletes.

create policy nb_media_staff_select on public.nb_media for select
  to authenticated using ((select public.nb_can_edit()));
create policy nb_media_editor_insert on public.nb_media for insert
  to authenticated with check (
    (select public.nb_can_edit())
    and uploaded_by = (select auth.uid())
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
    and approved = false
  );
create policy nb_media_publisher_update on public.nb_media for update
  to authenticated using ((select public.nb_can_publish()))
  with check ((select public.nb_can_publish()));
-- No direct public API media delete: reconciled cleanup requires a dedicated procedure.

create policy nb_home_drafts_staff_select on public.nb_home_drafts for select
  to authenticated using ((select public.nb_can_edit()));
create policy nb_home_drafts_editor_insert on public.nb_home_drafts for insert
  to authenticated with check ((select public.nb_can_edit()) and updated_by = (select auth.uid()));
create policy nb_home_drafts_editor_update on public.nb_home_drafts for update
  to authenticated using ((select public.nb_can_edit()))
  with check ((select public.nb_can_edit()) and updated_by = (select auth.uid()));
create policy nb_home_public_read on public.nb_home_public for select
  to anon, authenticated using (true);
create policy nb_home_public_publisher_insert on public.nb_home_public for insert
  to authenticated with check ((select public.nb_can_publish()) and published_by = (select auth.uid()));
create policy nb_home_public_publisher_update on public.nb_home_public for update
  to authenticated using ((select public.nb_can_publish()))
  with check ((select public.nb_can_publish()) and published_by = (select auth.uid()));
create policy nb_home_revisions_staff_select on public.nb_home_revisions for select
  to authenticated using ((select public.nb_can_edit()));
create policy nb_home_revisions_publisher_insert on public.nb_home_revisions for insert
  to authenticated with check ((select public.nb_can_publish()) and published_by = (select auth.uid()));

-- A single transactional publish operation includes immutable revision history.
-- SECURITY INVOKER: RLS and grants continue to enforce the caller's role.
create or replace function public.nb_publish_home()
returns integer language plpgsql security invoker
set search_path = ''
as $$
declare
  draft jsonb;
  next_version integer;
begin
  if not public.nb_can_publish() then
    raise exception 'Not authorized to publish' using errcode = '42501';
  end if;
  perform set_config('app.nb_publish_scope','home',true);
  select content into draft from public.nb_home_drafts
    where key = 'home' for update;
  if not found then
    raise exception 'Save a homepage draft before publishing';
  end if;
  if jsonb_typeof(draft) <> 'object' or length(trim(coalesce(draft ->> 'heroTitle',''))) < 4 then
    raise exception 'Homepage draft requires a valid hero title';
  end if;
  if coalesce(draft->>'contactWhatsapp','') <> ''
     and (draft->>'contactWhatsapp') !~ '^[1-9][0-9]{9,14}$' then
    raise exception 'Contact number must be verified and in international digits-only format';
  end if;
  if exists (
    select 1 from (values (draft->>'heroImage'), (draft->>'menImage'),
      (draft->>'kidsImage'), (draft->>'storyImage')) as urls(photo)
    where coalesce(photo,'') <> '' and not exists (
      select 1 from public.nb_media m
        where m.approved and photo = public.nb_media_public_url(m.storage_path)
    )
  ) then
    raise exception 'Homepage images must come from approved media';
  end if;
  select version + 1 into next_version from public.nb_home_public
    where key = 'home' for update;
  next_version := coalesce(next_version, 1);
  insert into public.nb_home_public (key, content, version, published_by, published_at)
    values ('home', draft, next_version, auth.uid(), now())
    on conflict (key) do update set
      content = excluded.content,
      version = excluded.version,
      published_by = excluded.published_by,
      published_at = excluded.published_at;
  insert into public.nb_home_revisions (key, version, content, published_by)
    values ('home', next_version, draft, auth.uid());
  perform set_config('app.nb_publish_scope','',true);
  return next_version;
end;
$$;
revoke all on function public.nb_publish_home() from public, anon, authenticated;
grant execute on function public.nb_publish_home() to authenticated;

-- Product content is edited privately and published atomically. Published rows
-- remain unchanged while editors prepare a new revision.
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
  product_price numeric;
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
  if product_price is not null and product_price < 0 then
    raise exception 'Price cannot be negative';
  end if;
  insert into public.nb_products (
    id,sku,slug,title,department,category_paths,description,fabric,sizes,
    image_urls,video_url,price,status,sort_rank,published_at,created_by
  ) values (
    p_product_id,product_sku,product_slug,product_title,product_dept,paths,
    coalesce(draft->>'description',''),coalesce(draft->>'fabric',''),sizes_value,
    photos,product_video,product_price,'published',
    coalesce((draft->>'sortRank')::integer,0),now(),auth.uid()
  )
  on conflict (id) do update set
    sku = excluded.sku, slug = excluded.slug, title = excluded.title,
    department = excluded.department, category_paths = excluded.category_paths,
    description = excluded.description, fabric = excluded.fabric,
    sizes = excluded.sizes, image_urls = excluded.image_urls,
    video_url = excluded.video_url, price = excluded.price,
    status = 'published', sort_rank = excluded.sort_rank, published_at = now();
  select coalesce(max(version),0)+1 into next_version
    from public.nb_product_revisions where product_id = p_product_id;
  insert into public.nb_product_revisions(product_id,version,content,published_by)
    values (p_product_id,next_version,draft,auth.uid());
  perform set_config('app.nb_publish_scope','',true);
  return next_version;
end;
$$;
revoke all on function public.nb_publish_product(uuid) from public, anon, authenticated;
grant execute on function public.nb_publish_product(uuid) to authenticated;

-- Draft editors can revise their own still-unapproved media descriptions
-- without gaining the right to approve or modify approved assets.
create policy nb_media_editor_update_pending on public.nb_media for update
  to authenticated
  using (
    not approved and uploaded_by = (select auth.uid())
    and (select public.nb_can_edit())
  )
  with check (
    not approved and uploaded_by = (select auth.uid())
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
    and (select public.nb_can_edit())
  );

-- Editors may upload; only owners/admins approve, replace or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nb-media','nb-media',true,52428800,
  array['image/jpeg','image/png','image/webp','image/avif','image/gif','video/mp4','video/webm']
)
on conflict (id) do nothing;

create policy nb_storage_staff_select on storage.objects for select
  to authenticated using (bucket_id = 'nb-media' and (select public.nb_can_edit()));
create policy nb_storage_staff_insert on storage.objects for insert
  to authenticated with check (
    bucket_id = 'nb-media'
    and (select public.nb_can_edit())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy nb_storage_publisher_update on storage.objects for update
  to authenticated using (bucket_id = 'nb-media' and (select public.nb_can_publish()))
  with check (bucket_id = 'nb-media' and (select public.nb_can_publish()));
create policy nb_storage_owner_delete on storage.objects for delete
  to authenticated using (bucket_id = 'nb-media' and (select public.nb_is_owner()));

-- Seed navigation taxonomy, never seed inventory or fake commercial claims.
insert into public.nb_categories (path, department, label, sort_order) values
  ('/men','men','Men''s Wear',1),
  ('/men/kurta-pyjama','men','Kurta Pyjama',10),
  ('/men/pathani','men','Pathani',20),
  ('/men/sherwani','men','Sherwani',30),
  ('/men/sherwani/handwork','men','Handwork Sherwani',31),
  ('/men/sherwani/plain','men','Plain Suits',32),
  ('/men/suits','men','Suits',40),
  ('/men/suits/handwork','men','Handwork Suits',41),
  ('/men/suits/plain','men','Plain Suits',42),
  ('/men/jodhpuri','men','Jodhpuri',50),
  ('/men/marriage','men','Marriage Collection',60),
  ('/men/marriage/jutti','men','Jutti',61),
  ('/men/marriage/pagdi','men','Pagdi',62),
  ('/men/marriage/sadi','men','Sadi',63),
  ('/men/tope','men','Tope',70),
  ('/kids','kids','Kids Wear',100),
  ('/kids/kurta-pyjama','kids','Kurta Pyjama',110),
  ('/kids/sherwani','kids','Sherwani',120),
  ('/kids/pathani','kids','Pathani',130),
  ('/kids/sadi','kids','Sadi',140),
  ('/kids/suits','kids','Suits',150),
  ('/kids/jodhpuri','kids','Jodhpuri',160),
  ('/kids/tope','kids','Tope',170)
on conflict (path) do nothing;

-- =============================================================================
-- 2 / 20: 20261107130000_catalogue_private_media.sql
-- Source: supabase/migrations/20261107130000_catalogue_private_media.sql
-- =============================================================================
-- Phase 2: catalogue associations, indexed search, private upload staging.
-- Forward-only migration. DO NOT apply to legacy Firebase or unrelated gym DB.

-- Refuse an implicit live data migration: approved assets must first be
-- reconciled from the old public bucket to private staging/public delivery.
do $gate$
begin
  if exists (select 1 from public.nb_media where approved)
     or exists (select 1 from public.nb_products where status = 'published') then
    raise exception 'Existing live catalogue/media detected. Perform an audited asset backfill before Phase 2 migration.';
  end if;
end $gate$;

-- The candidate public bucket must not continue exposing pending uploads.
update storage.buckets set public = false where id = 'nb-media';
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nb-media-staging','nb-media-staging',false,52428800,
    array['image/jpeg','image/png','image/webp','image/avif','image/gif','video/mp4','video/webm']),
       ('nb-media-public','nb-media-public',true,52428800,
    array['image/jpeg','image/png','image/webp','image/avif','image/gif','video/mp4','video/webm'])
on conflict (id) do nothing;

-- Clean up permissions inherited from the old upload implementation.
drop policy if exists nb_storage_staff_select on storage.objects;
drop policy if exists nb_storage_staff_insert on storage.objects;
drop policy if exists nb_storage_publisher_update on storage.objects;
drop policy if exists nb_storage_owner_delete on storage.objects;

create policy nb_staging_staff_select on storage.objects for select to authenticated
  using (bucket_id = 'nb-media-staging' and (select public.nb_can_edit()));
create policy nb_staging_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'nb-media-staging'
    and (select public.nb_can_edit())
    and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Only the server-side media promotion function may INSERT into public delivery.
-- Do not grant authenticated INSERT/UPDATE/DELETE on nb-media-public.

-- Approval itself is privileged: editors/admins only update descriptions,
-- not the approved boolean. The Edge Function uses a server-only admin key.
revoke update on public.nb_media from authenticated;
grant update (alt_text) on public.nb_media to authenticated;

-- The same private object path is copied to the public bucket only after
-- approval. Keep URL generation stable for existing draft JSON shapes.
create or replace function public.nb_media_public_url(path text)
returns text language sql stable security invoker set search_path = ''
as $$
  select case
    when ((select auth.jwt()) ->> 'iss')
      ~ '^https://[a-z0-9-]+[.]supabase[.]co/auth/v1$'
    then regexp_replace((select auth.jwt()) ->> 'iss','/auth/v1$','')
      || '/storage/v1/object/public/nb-media-public/' || path
    else null
  end;
$$;

create table public.nb_product_categories (
  product_id uuid not null references public.nb_products(id) on delete cascade,
  category_path text not null references public.nb_categories(path) on delete restrict,
  primary key(product_id,category_path)
);
create index nb_product_categories_route_idx on public.nb_product_categories(category_path,product_id);

create table public.nb_product_media (
  product_id uuid not null references public.nb_products(id) on delete cascade,
  media_id uuid not null references public.nb_media(id) on delete restrict,
  sort_order integer not null check (sort_order >= 0),
  is_cover boolean not null default false,
  primary key(product_id,media_id),
  unique(product_id,sort_order)
);
create unique index nb_product_media_one_cover_idx on public.nb_product_media(product_id) where is_cover;
create index nb_product_media_asset_idx on public.nb_product_media(media_id);

alter table public.nb_product_categories enable row level security;
alter table public.nb_product_media enable row level security;
revoke all on public.nb_product_categories, public.nb_product_media from public, anon, authenticated;
grant select on public.nb_product_categories, public.nb_product_media to anon, authenticated;
grant insert, delete on public.nb_product_categories, public.nb_product_media to authenticated;

-- Anonymous reads are limited to associations of approved published items.
create policy nb_product_categories_read on public.nb_product_categories for select
  to anon, authenticated using (
    (select public.nb_can_edit()) or exists (
      select 1 from public.nb_products p
      where p.id=product_id and p.status='published'
    ));
create policy nb_product_media_read on public.nb_product_media for select
  to anon, authenticated using (
    (select public.nb_can_edit()) or exists (
      select 1 from public.nb_products p
      where p.id=product_id and p.status='published'
    ));
create policy nb_product_categories_write on public.nb_product_categories for insert
  to authenticated with check ((select public.nb_can_publish()));
create policy nb_product_categories_delete on public.nb_product_categories for delete
  to authenticated using ((select public.nb_can_publish()));
create policy nb_product_media_write on public.nb_product_media for insert
  to authenticated with check ((select public.nb_can_publish()));
create policy nb_product_media_delete on public.nb_product_media for delete
  to authenticated using ((select public.nb_can_publish()));

-- Guard the association tables with the existing authorized publication
-- transaction scope; these are not free-form REST edit endpoints.
create or replace function public.nb_require_publish_scope()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.nb_can_publish() or
    current_setting('app.nb_publish_scope', true) is distinct from TG_ARGV[0] then
    raise exception 'Use the publishing workflow' using errcode = '42501';
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger nb_product_categories_guard before insert or delete or update
  on public.nb_product_categories for each row
  execute function public.nb_require_publish_scope('product');
create trigger nb_product_media_guard before insert or delete or update
  on public.nb_product_media for each row
  execute function public.nb_require_publish_scope('product');

-- Read-model associations are rebuilt atomically from the existing,
-- validated published product arrays, without duplicating a second CMS form.
create or replace function public.nb_sync_published_associations()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  delete from public.nb_product_categories where product_id = new.id;
  delete from public.nb_product_media where product_id = new.id;
  if new.status = 'published' then
    insert into public.nb_product_categories(product_id,category_path)
      select distinct new.id, route
      from unnest(new.category_paths) as route;
    insert into public.nb_product_media(product_id,media_id,sort_order,is_cover)
      select new.id, m.id, (photo.ordinality - 1)::integer, photo.ordinality = 1
      from unnest(new.image_urls) with ordinality as photo(url,ordinality)
      join public.nb_media m
        on m.approved and photo.url = public.nb_media_public_url(m.storage_path);
    if (select count(*) from public.nb_product_media where product_id = new.id)
       <> cardinality(new.image_urls) then
      raise exception 'Published product media associations could not be validated';
    end if;
  end if;
  return new;
end;
$$;
create trigger nb_product_associations_sync after insert or update on public.nb_products
  for each row execute function public.nb_sync_published_associations();

-- PostgreSQL GIN expression search for case-insensitive SKU/title filtering.
create extension if not exists pg_trgm;
create index nb_products_title_trgm_idx on public.nb_products using gin (title gin_trgm_ops)
  where status='published';
create index nb_products_sku_trgm_idx on public.nb_products using gin (sku gin_trgm_ops)
  where status='published';
create index nb_products_published_page_idx on public.nb_products
  (department, updated_at desc, id) where status='published';

-- =============================================================================
-- 3 / 20: 20261107150000_studio_product_index.sql
-- Source: supabase/migrations/20261107150000_studio_product_index.sql
-- =============================================================================
-- Phase 3: stable, server-side searchable catalogue index for the staff CMS.
-- A security-invoker view keeps the underlying RLS effective.

create index if not exists nb_product_drafts_recent_idx
  on public.nb_product_drafts(updated_at desc, product_id);

create or replace view public.nb_studio_product_index
with (security_invoker = true)
as
select
  coalesce(p.id,d.product_id) as id,
  coalesce(nullif(d.content->>'title',''),p.title,'(Untitled draft)') as title,
  coalesce(nullif(d.content->>'sku',''),p.sku,'') as sku,
  coalesce(nullif(d.content->>'department',''),p.department,'men') as department,
  case when p.status='published' then 'published'
    when p.status='archived' then 'archived'
    else 'draft' end as status,
  (d.product_id is not null) as has_draft,
  greatest(coalesce(p.updated_at,'epoch'::timestamptz),
    coalesce(d.updated_at,'epoch'::timestamptz)) as updated_at
from public.nb_products p
full outer join public.nb_product_drafts d on p.id=d.product_id;

revoke all on public.nb_studio_product_index from public,anon,authenticated;
grant select on public.nb_studio_product_index to authenticated;

-- =============================================================================
-- 4 / 20: 20261107170000_bulk_import_jobs.sql
-- Source: supabase/migrations/20261107170000_bulk_import_jobs.sql
-- =============================================================================
-- Phase 4: resumable audit-friendly catalogue onboarding jobs.
-- Import jobs record validated drafts; no publishing or stock-accounting writes.

-- Enforce the same SKU identity across unpublished drafts, case-insensitively.
create unique index if not exists nb_product_drafts_unique_sku_idx
  on public.nb_product_drafts (upper(trim(content->>'sku')))
  where trim(coalesce(content->>'sku','')) <> '';

create table public.nb_import_jobs (
  id uuid primary key default gen_random_uuid(),
  import_key text not null unique check (import_key ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('csv','images')),
  filename text not null check (char_length(filename) between 1 and 240),
  status text not null default 'pending'
    check (status in ('pending','running','completed','completed_with_errors','failed','cancelled')),
  total_count integer not null default 0 check (total_count between 0 and 200000),
  processed_count integer not null default 0 check (processed_count >= 0),
  success_count integer not null default 0 check (success_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nb_import_counts_consistent check (
    processed_count <= total_count
    and processed_count = success_count + skipped_count + error_count
  )
);
create index nb_import_jobs_recent_idx on public.nb_import_jobs(created_by,created_at desc);

create table public.nb_import_rows (
  job_id uuid not null references public.nb_import_jobs(id) on delete restrict,
  row_number integer not null check (row_number >= 1),
  sku text not null check (char_length(sku) between 2 and 80),
  status text not null default 'pending'
    check (status in ('pending','imported','skipped','failed')),
  product_id uuid,
  media_id uuid references public.nb_media(id) on delete restrict,
  message text not null default '' check (char_length(message) <= 1000),
  created_at timestamptz not null default now(),
  primary key(job_id,row_number)
);
create index nb_import_rows_status_idx on public.nb_import_rows(job_id,status);

create trigger nb_touch_import_job before update on public.nb_import_jobs
  for each row execute function public.nb_touch_updated_at();

alter table public.nb_import_jobs enable row level security;
alter table public.nb_import_rows enable row level security;
revoke all on public.nb_import_jobs, public.nb_import_rows from public,anon,authenticated;
grant select,insert,update on public.nb_import_jobs,public.nb_import_rows to authenticated;

create policy nb_import_jobs_staff_select on public.nb_import_jobs for select to authenticated
  using ((select public.nb_can_edit()));
create policy nb_import_jobs_owner_insert on public.nb_import_jobs for insert to authenticated
  with check ((select public.nb_can_edit()) and created_by=(select auth.uid()));
create policy nb_import_jobs_owner_update on public.nb_import_jobs for update to authenticated
  using ((select public.nb_can_edit()) and created_by=(select auth.uid()))
  with check ((select public.nb_can_edit()) and created_by=(select auth.uid()));

create policy nb_import_rows_staff_select on public.nb_import_rows for select to authenticated
  using ((select public.nb_can_edit()));
create policy nb_import_rows_owner_insert on public.nb_import_rows for insert to authenticated
  with check ((select public.nb_can_edit()) and exists(
    select 1 from public.nb_import_jobs j where j.id=job_id and j.created_by=(select auth.uid())
  ));
create policy nb_import_rows_owner_update on public.nb_import_rows for update to authenticated
  using ((select public.nb_can_edit()) and exists(
    select 1 from public.nb_import_jobs j where j.id=job_id and j.created_by=(select auth.uid())
  ))
  with check ((select public.nb_can_edit()) and exists(
    select 1 from public.nb_import_jobs j where j.id=job_id and j.created_by=(select auth.uid())
  ));

-- =============================================================================
-- 5 / 20: 20261107172000_match_approved_media.sql
-- Source: supabase/migrations/20261107172000_match_approved_media.sql
-- =============================================================================
-- Server-side SKU matching for approved assets. Never overwrites a manual
-- gallery or publishes content; staff explicitly reviews linked draft images.

alter table public.nb_media add column if not exists filename_sku text
  generated always as (
    case when original_name ~* '^[a-z0-9_-]+_[0-9]{2,4}[.](jpg|jpeg|png|webp|avif|gif)$'
    then upper(regexp_replace(original_name, '_[0-9]{2,4}[.](jpg|jpeg|png|webp|avif|gif)$', '', 'i'))
    else null end
  ) stored;
create index if not exists nb_media_import_filename_idx
  on public.nb_media(filename_sku,original_name) where approved;

-- Iterate in stable UUID order so batches can be resumed without offsets.
create or replace function public.nb_link_approved_media(
  p_after uuid default null, p_limit integer default 100
)
returns table(processed integer, linked integer, next_after uuid)
language plpgsql security invoker set search_path = ''
as $$
declare
  product_row record;
  matches text[];
begin
  if not public.nb_can_edit() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 100 then
    raise exception 'Batch size must be between 1 and 100';
  end if;
  processed := 0; linked := 0; next_after := p_after;
  for product_row in
    select d.product_id, d.content
    from public.nb_product_drafts d
    where p_after is null or d.product_id > p_after
    order by d.product_id
    limit p_limit
  loop
    processed := processed+1;
    next_after := product_row.product_id;
    if jsonb_typeof(product_row.content->'imageUrls') = 'array'
       and jsonb_array_length(product_row.content->'imageUrls') > 0 then
      continue;
    end if;
    select array_agg(public.nb_media_public_url(m.storage_path)
        order by substring(m.original_name from '_([0-9]{2,4})[.]')::integer,m.id)
      into matches
    from public.nb_media m
    where m.approved
      and m.filename_sku = upper(trim(product_row.content->>'sku'))
      and m.mime_type like 'image/%';
    if coalesce(cardinality(matches),0) > 0 then
      update public.nb_product_drafts d
      set content=jsonb_set(d.content,'{imageUrls}',to_jsonb(matches),true),
          updated_by=auth.uid()
      where d.product_id=product_row.product_id;
      linked := linked+1;
    end if;
  end loop;
  return next;
end;
$$;
revoke all on function public.nb_link_approved_media(uuid,integer) from public,anon,authenticated;
grant execute on function public.nb_link_approved_media(uuid,integer) to authenticated;

-- =============================================================================
-- 6 / 20: 20261107195000_studio_index_role_gate.sql
-- Source: supabase/migrations/20261107195000_studio_index_role_gate.sql
-- =============================================================================
-- Phase 6: the public product RLS policy alone is not sufficient to
-- protect the staff-only union view from roleless authenticated callers.
-- Explicitly require a privileged CMS staff role at the view boundary.

create or replace view public.nb_studio_product_index
with (security_invoker = true)
as
select
  coalesce(p.id,d.product_id) as id,
  coalesce(nullif(d.content->>'title',''),p.title,'(Untitled draft)') as title,
  coalesce(nullif(d.content->>'sku',''),p.sku,'') as sku,
  coalesce(nullif(d.content->>'department',''),p.department,'men') as department,
  case when p.status='published' then 'published'
    when p.status='archived' then 'archived'
    else 'draft' end as status,
  (d.product_id is not null) as has_draft,
  greatest(coalesce(p.updated_at,'epoch'::timestamptz),
    coalesce(d.updated_at,'epoch'::timestamptz)) as updated_at
from public.nb_products p
full outer join public.nb_product_drafts d on p.id=d.product_id
where public.nb_can_edit();


revoke all on public.nb_studio_product_index from public,anon,authenticated;
grant select on public.nb_studio_product_index to authenticated;

-- =============================================================================
-- 7 / 20: 20261107199000_import_owner_idempotency.sql
-- Source: supabase/migrations/20261107199000_import_owner_idempotency.sql
-- =============================================================================
-- Phase 6 reconciliation: imported files must be scoped to their uploader.
-- Two authorized staff members can import the same CSV independently without
-- receiving another staff member's job ID or modifying their audit trail.

alter table public.nb_import_jobs
  drop constraint if exists nb_import_jobs_import_key_key;

create unique index if not exists nb_import_jobs_owner_fingerprint_uq
  on public.nb_import_jobs(created_by, import_key);

-- =============================================================================
-- 8 / 20: 20261107210000_catalogue_integrity_audit.sql
-- Source: supabase/migrations/20261107210000_catalogue_integrity_audit.sql
-- =============================================================================
-- Noman Brothers: production-candidate catalogue integrity and audit controls.
-- NEW CLIENT/STAGING PROJECT ONLY, after all preceding versioned migrations.
-- No inventories, orders, payment records or dummy customer merchandise.

create schema if not exists nb_internal;
revoke all on schema nb_internal from public, anon, authenticated;

-- Keep a compact immutable operational record without storing private draft
-- payloads, client passwords, raw API credentials or original upload bytes.
create table public.nb_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  event_type text not null check (event_type in (
    'product_published','homepage_published','category_updated',
    'media_approved','media_revoked','import_status_changed'
  )),
  entity_type text not null check (entity_type in (
    'product','homepage','category','media','import'
  )),
  entity_id text not null check (length(entity_id) between 1 and 128),
  meta jsonb not null default '{}'::jsonb
    check (jsonb_typeof(meta)='object' and octet_length(meta::text) <= 2000),
  occurred_at timestamptz not null default now()
);
create index nb_audit_events_recent_idx
  on public.nb_audit_events(occurred_at desc, id desc);
create index nb_audit_events_entity_idx
  on public.nb_audit_events(entity_type, entity_id, occurred_at desc);

alter table public.nb_audit_events enable row level security;
revoke all on public.nb_audit_events from public, anon, authenticated;
grant select on public.nb_audit_events to authenticated;
create policy nb_audit_owner_read on public.nb_audit_events
  for select to authenticated
  using ((select public.nb_can_publish()));

-- Only this database-owned trigger function can append audit events.
-- No API user can call it directly: it lives outside exposed public schema.
create or replace function nb_internal.nb_record_catalogue_event()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  kind text;
  type_name text;
  record_id text;
  detail jsonb := '{}'::jsonb;
begin
  case TG_TABLE_NAME
    when 'nb_products' then
      if new.status <> 'published' then return new; end if;
      kind := 'product_published'; type_name := 'product';
      record_id := new.id::text; detail := jsonb_build_object('sku',new.sku);
    when 'nb_home_public' then
      kind := 'homepage_published'; type_name := 'homepage';
      record_id := 'home'; detail := jsonb_build_object('version',new.version);
    when 'nb_categories' then
      if TG_OP = 'UPDATE' and
        row(new.description,new.image_url,new.active,new.sort_order) is not distinct from
        row(old.description,old.image_url,old.active,old.sort_order) then
        return new;
      end if;
      kind := 'category_updated'; type_name := 'category';
      record_id := new.path;
    when 'nb_media' then
      if new.approved is not distinct from old.approved then return new; end if;
      kind := case when new.approved then 'media_approved' else 'media_revoked' end;
      type_name := 'media'; record_id := new.id::text;
    when 'nb_import_jobs' then
      if new.status is not distinct from old.status then return new; end if;
      kind := 'import_status_changed'; type_name := 'import';
      record_id := new.id::text; detail := jsonb_build_object('status',new.status);
    else
      raise exception 'Unexpected audit trigger target' using errcode = '42501';
  end case;
  insert into public.nb_audit_events(actor_id,event_type,entity_type,entity_id,meta)
    values (auth.uid(), kind, type_name, record_id, detail);
  return new;
end
$$;
revoke all on function nb_internal.nb_record_catalogue_event() from public, anon, authenticated;

create trigger nb_audit_products after insert or update on public.nb_products
  for each row execute function nb_internal.nb_record_catalogue_event();
create trigger nb_audit_home after insert or update on public.nb_home_public
  for each row execute function nb_internal.nb_record_catalogue_event();
create trigger nb_audit_categories after update on public.nb_categories
  for each row execute function nb_internal.nb_record_catalogue_event();
create trigger nb_audit_media after update of approved on public.nb_media
  for each row execute function nb_internal.nb_record_catalogue_event();
create trigger nb_audit_import_jobs after update of status on public.nb_import_jobs
  for each row execute function nb_internal.nb_record_catalogue_event();

-- Independent, server-side guard: even a service-role update cannot revoke a
-- file that a published product/homepage/collection still references.
-- This complements Edge Function preflight checks and protects against
-- administrative mistakes. Media bytes still require Storage reconciliation.
create or replace function nb_internal.nb_guard_media_revocation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  suffix text := '/nb-media-public/' || old.storage_path;
begin
  if old.approved is true and new.approved is false then
    if exists (
      select 1 from public.nb_product_media pm
      join public.nb_products p on p.id = pm.product_id
      where pm.media_id=old.id and p.status='published'
    ) or exists (
      select 1 from public.nb_products p
      where p.status='published'
        and (
          right(coalesce(p.video_url,''),length(suffix)) = suffix
          or exists (
            select 1 from unnest(p.image_urls) as photo(url)
            where right(photo.url,length(suffix)) = suffix
          )
        )
    ) or exists (
      select 1 from public.nb_categories c
      where right(coalesce(c.image_url,''),length(suffix)) = suffix
        and c.active
    ) or exists (
      select 1 from public.nb_home_public h
      where exists (
        select 1 from (values
          (h.content->>'heroImage'), (h.content->>'menImage'),
          (h.content->>'kidsImage'), (h.content->>'storyImage')
        ) as asset(url)
        where right(coalesce(asset.url,''),length(suffix)) = suffix
      )
    ) then
      raise exception 'Media is referenced by published content; unpublish or replace it first'
        using errcode = '23503';
    end if;
  end if;
  return new;
end
$$;
revoke all on function nb_internal.nb_guard_media_revocation() from public, anon, authenticated;
create trigger nb_approved_media_reference_guard
  before update of approved on public.nb_media
  for each row execute function nb_internal.nb_guard_media_revocation();

-- Additional indexes for large approved-media libraries and the staff studio.
create index nb_media_approved_recent_idx
  on public.nb_media(created_at desc,id desc) where approved;
create index nb_media_filename_trgm_idx
  on public.nb_media using gin (original_name gin_trgm_ops);
create index nb_product_drafts_changed_idx
  on public.nb_product_drafts(updated_at desc,product_id);
create index nb_product_revisions_recent_idx
  on public.nb_product_revisions(product_id,published_at desc);

-- Observe catalogue size without reading private staff/media data.
-- Metrics are returned only to a signed-in manager. Security invoker by default.
create or replace function public.nb_catalogue_health()
returns table(
  published_products bigint, private_drafts bigint, approved_assets bigint,
  pending_assets bigint, total_import_jobs bigint
)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not public.nb_can_publish() then
    raise exception 'Manager access required' using errcode='42501';
  end if;
  return query
  select
    (select count(*) from public.nb_products p where p.status='published'),
    (select count(*) from public.nb_product_drafts),
    (select count(*) from public.nb_media m where m.approved),
    (select count(*) from public.nb_media m where not m.approved),
    (select count(*) from public.nb_import_jobs);
end
$$;
revoke all on function public.nb_catalogue_health() from public, anon, authenticated;
grant execute on function public.nb_catalogue_health() to authenticated;

-- =============================================================================
-- 9 / 20: 20261107223000_category_media_publish_guard.sql
-- Source: supabase/migrations/20261107223000_category_media_publish_guard.sql
-- =============================================================================
-- Prevent bypassing the approved-media library when changing a public
-- collection banner directly through the Data API.
-- Forward-only; safe after the integrity/audit migration and taxonomy seed.

create or replace function nb_internal.nb_require_approved_category_image()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.image_url is distinct from old.image_url
     and nullif(trim(new.image_url),'') is not null
     and not exists (
       select 1 from public.nb_media m
       where m.approved
         and m.mime_type like 'image/%'
         and new.image_url = public.nb_media_public_url(m.storage_path)
     )
  then
    raise exception 'Collection artwork must be an approved image from this project'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function nb_internal.nb_require_approved_category_image() from public, anon, authenticated;

create trigger nb_category_image_approval_guard
  before update of image_url on public.nb_categories
  for each row execute function nb_internal.nb_require_approved_category_image();

-- =============================================================================
-- =============================================================================
-- 10 / 20: 20261107234500_cms_archive_and_discard.sql
-- Source: supabase/migrations/20261107234500_cms_archive_and_discard.sql
-- =============================================================================
-- Forward-only CMS inventory operations: archive products and discard drafts.
-- Production was provisioned via the SQL Editor installer; see migration ledger.

create or replace function public.nb_archive_product(p_product_id uuid)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare current_status text;
begin
  if not public.nb_can_publish() then raise exception 'Only owners/admins may archive garments' using errcode='42501'; end if;
  select status into current_status from public.nb_products where id=p_product_id for update;
  if not found then raise exception 'Product not found' using errcode='P0002'; end if;
  if current_status='archived' then return true; end if;
  perform set_config('app.nb_publish_scope','product',true);
  update public.nb_products set status='archived', published_at=null where id=p_product_id;
  perform set_config('app.nb_publish_scope','',true);
  return true;
end;$$;
revoke all on function public.nb_archive_product(uuid) from public, anon;
grant execute on function public.nb_archive_product(uuid) to authenticated;
grant delete on public.nb_product_drafts to authenticated;
drop policy if exists nb_product_drafts_editor_delete on public.nb_product_drafts;
create policy nb_product_drafts_editor_delete on public.nb_product_drafts
for delete to authenticated using (
  (select public.nb_can_publish()) or
  ((select public.nb_can_edit()) and updated_by=(select auth.uid()))
);

-- =============================================================================
-- =============================================================================
-- 11 / 20: 20261107235900_catalogue_media_merchandising.sql
-- Source: supabase/migrations/20261107235900_catalogue_media_merchandising.sql
-- =============================================================================
-- Noman Brothers catalog merchandising and media organisation. Forward-only.
-- Correct display labels WITHOUT breaking historical routes or product-category URLs.

alter table public.nb_products
  add column if not exists offer_price numeric(12,2),
  add column if not exists customizable boolean not null default false;
alter table public.nb_products drop constraint if exists nb_offer_below_original;
alter table public.nb_products add constraint nb_offer_below_original
  check(offer_price is null or (price is not null and offer_price>=0 and offer_price<price));
alter table public.nb_media
  add column if not exists department text,
  add column if not exists category_path text,
  add column if not exists archived_at timestamptz;
alter table public.nb_media drop constraint if exists nb_media_department_choice;
alter table public.nb_media add constraint nb_media_department_choice
  check(department is null or department in ('men','kids'));
alter table public.nb_media drop constraint if exists nb_media_category_route;
alter table public.nb_media add constraint nb_media_category_route
  check(category_path is null or
    (department is not null and category_path ~ '^/(men|kids)(/[a-z0-9-]+)*$'
     and split_part(category_path,'/',2)=department));
create index if not exists nb_media_library_filter_idx
  on public.nb_media(department,category_path,created_at desc) where archived_at is null;
create table if not exists public.nb_sku_counters(
  prefix text primary key check(prefix ~ '^[A-Z]{2,3}$'),
  next_number bigint not null check(next_number>0)
);
alter table public.nb_sku_counters enable row level security;
grant select,insert,update on public.nb_sku_counters to authenticated;
drop policy if exists nb_sku_counter_staff on public.nb_sku_counters;
create policy nb_sku_counter_staff on public.nb_sku_counters for all to authenticated
  using ((select public.nb_can_edit()))
  with check ((select public.nb_can_edit()));
create index if not exists nb_draft_sku_unique
  on public.nb_product_drafts ((content->>'sku'))
  where nullif(content->>'sku','') is not null;

create or replace function public.nb_next_sku(p_category_path text)
returns text language plpgsql security invoker set search_path = ''
as $sku$
declare
  piece text;
  parent_piece text;
  code text;
  num bigint;
  result_sku text;
begin
  if not public.nb_can_edit() then
    raise exception 'Staff access required for SKU generation' using errcode='42501';
  end if;
  if not exists (select 1 from public.nb_categories
                 where path=p_category_path and active) then
    raise exception 'Choose an active collection first';
  end if;
  piece:=split_part(p_category_path,'/',3);
  parent_piece:=split_part(p_category_path,'/',4);
  if piece in ('sherwani','suits') then
    null; -- Subcategories share the parent garment's serial range.
  elsif piece='marriage' and parent_piece<>'' then
    piece:=parent_piece;
  end if;
  code:=case piece
    when 'kurta-pyjama' then 'KP'
    when 'pathani' then 'PA'
    when 'jodhpuri' then 'JP'
    when 'tope' then 'TB'
    when 'tobh' then 'TB'
    when 'sherwani' then 'SH'
    when 'suits' then 'SU'
    when 'jutti' then 'JT'
    when 'jooti' then 'JT'
    when 'pagdi' then 'PG'
    when 'sadi' then 'SD'
    when 'sadiri' then 'SD'
    else 'OT' end;
  for iter in 1..100000 loop
    insert into public.nb_sku_counters(prefix,next_number) values(code,2)
      on conflict(prefix) do update
        set next_number=public.nb_sku_counters.next_number+1
      returning next_number-1 into num;
    if num>99999 then raise exception 'SKU numbering capacity reached'; end if;
    result_sku:='NB-'||code||'-'||lpad(num::text,5,'0');
    exit when not exists (select 1 from public.nb_products where sku=result_sku)
          and not exists (select 1 from public.nb_product_drafts where content->>'sku'=result_sku);
  end loop;
  return result_sku;
end;
$sku$;
revoke all on function public.nb_next_sku(text) from public,anon;
grant execute on function public.nb_next_sku(text) to authenticated;

CREATE OR REPLACE FUNCTION public.nb_publish_product(p_product_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
      where m.approved and m.archived_at is null and photo = public.nb_media_public_url(m.storage_path)
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
  if product_offer is not null and
    (product_price is null or product_offer < 0 or product_offer >= product_price) then
    raise exception 'Offer price must be lower than the actual price';
  end if;
  if product_price is not null and product_price < 0 then
    raise exception 'Price cannot be negative';
  end if;
  insert into public.nb_products (
    id,sku,slug,title,department,category_paths,description,fabric,sizes,
    image_urls,video_url,price,offer_price,customizable,status,sort_rank,published_at,created_by
  ) values (
    p_product_id,product_sku,product_slug,product_title,product_dept,paths,
    coalesce(draft->>'description',''),coalesce(draft->>'fabric',''),sizes_value,
    photos,product_video,product_price,product_offer,product_customizable,'published',
    coalesce((draft->>'sortRank')::integer,0),now(),auth.uid()
  )
  on conflict (id) do update set
    sku = excluded.sku, slug = excluded.slug, title = excluded.title,
    department = excluded.department, category_paths = excluded.category_paths,
    description = excluded.description, fabric = excluded.fabric,
    sizes = excluded.sizes, image_urls = excluded.image_urls,
    video_url = excluded.video_url, price = excluded.price,
    offer_price = excluded.offer_price, customizable = excluded.customizable,
    status = 'published', sort_rank = excluded.sort_rank, published_at = now();
  select coalesce(max(version),0)+1 into next_version
    from public.nb_product_revisions where product_id = p_product_id;
  insert into public.nb_product_revisions(product_id,version,content,published_by)
    values (p_product_id,next_version,draft,auth.uid());
  perform set_config('app.nb_publish_scope','',true);
  return next_version;
end;
$function$;


CREATE OR REPLACE FUNCTION public.nb_publish_home()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  draft jsonb;
  next_version integer;
begin
  if not public.nb_can_publish() then
    raise exception 'Not authorized to publish' using errcode = '42501';
  end if;
  perform set_config('app.nb_publish_scope','home',true);
  select content into draft from public.nb_home_drafts
    where key = 'home' for update;
  if not found then
    raise exception 'Save a homepage draft before publishing';
  end if;
  if jsonb_typeof(draft) <> 'object' or length(trim(coalesce(draft ->> 'heroTitle',''))) < 4 then
    raise exception 'Homepage draft requires a valid hero title';
  end if;
  if coalesce(draft->>'contactWhatsapp','') <> ''
     and (draft->>'contactWhatsapp') !~ '^[1-9][0-9]{9,14}$' then
    raise exception 'Contact number must be verified and in international digits-only format';
  end if;
  if exists (
    select 1 from (values (draft->>'heroImage'), (draft->>'menImage'),
      (draft->>'kidsImage'), (draft->>'storyImage')) as urls(photo)
    where coalesce(photo,'') <> '' and not exists (
      select 1 from public.nb_media m
        where m.approved and m.archived_at is null and photo = public.nb_media_public_url(m.storage_path)
    )
  ) then
    raise exception 'Homepage images must come from approved media';
  end if;
  select version + 1 into next_version from public.nb_home_public
    where key = 'home' for update;
  next_version := coalesce(next_version, 1);
  insert into public.nb_home_public (key, content, version, published_by, published_at)
    values ('home', draft, next_version, auth.uid(), now())
    on conflict (key) do update set
      content = excluded.content,
      version = excluded.version,
      published_by = excluded.published_by,
      published_at = excluded.published_at;
  insert into public.nb_home_revisions (key, version, content, published_by)
    values ('home', next_version, draft, auth.uid());
  perform set_config('app.nb_publish_scope','',true);
  return next_version;
end;
$function$;


update public.nb_categories set label=case
  when path in ('/men/tope','/kids/tope') then 'Tobh'
  when path='/men/marriage/jutti' then 'Jooti'
  when path in ('/men/marriage/sadi','/kids/sadi') then 'Sadiri'
  else label end
where path in ('/men/tope','/kids/tope','/men/marriage/jutti',
               '/men/marriage/sadi','/kids/sadi');

-- =============================================================================
-- 12 / 20: 20261108001500_home_media_security.sql
-- Source: supabase/migrations/20261108001500_home_media_security.sql
-- =============================================================================
-- Guard optional website CMS video/background assets during publish and archive.

CREATE OR REPLACE FUNCTION public.nb_publish_home()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  draft jsonb;
  next_version integer;
begin
  if not public.nb_can_publish() then
    raise exception 'Not authorized to publish' using errcode = '42501';
  end if;
  perform set_config('app.nb_publish_scope','home',true);
  select content into draft from public.nb_home_drafts
    where key = 'home' for update;
  if not found then
    raise exception 'Save a homepage draft before publishing';
  end if;
  if jsonb_typeof(draft) <> 'object' or length(trim(coalesce(draft ->> 'heroTitle',''))) < 4 then
    raise exception 'Homepage draft requires a valid hero title';
  end if;
  if coalesce(draft->>'contactPhone','') <> '' and (draft->>'contactPhone') !~ '^[1-9][0-9]{9,14}$' then
    raise exception 'Call phone must be international digits';
  end if;
  if coalesce(draft->>'contactWhatsapp','') <> ''
     and (draft->>'contactWhatsapp') !~ '^[1-9][0-9]{9,14}$' then
    raise exception 'Contact number must be verified and in international digits-only format';
  end if;
  if exists (
    select 1 from (values (draft->>'heroImage'), (draft->>'menImage'),
      (draft->>'kidsImage'), (draft->>'storyImage'),
      (draft->>'customizationImage')) as urls(photo)
    where coalesce(photo,'') <> '' and not exists (
      select 1 from public.nb_media m
        where m.approved and m.archived_at is null and photo = public.nb_media_public_url(m.storage_path)
    )
  ) then
    raise exception 'Homepage images must come from approved media';
  end if;
  if jsonb_typeof(coalesce(draft->'sectionVideos','{}'::jsonb)) <> 'object'
    or exists (
      select 1 from jsonb_each_text(coalesce(draft->'sectionVideos','{}'::jsonb)) v(key,url)
      where coalesce(v.url,'')<>'' and not exists (
        select 1 from public.nb_media m
        where m.approved and m.archived_at is null and m.mime_type like 'video/%'
          and v.url=public.nb_media_public_url(m.storage_path)
      )
    ) then
    raise exception 'Section videos must be approved video assets';
  end if;
  select version + 1 into next_version from public.nb_home_public
    where key = 'home' for update;
  next_version := coalesce(next_version, 1);
  insert into public.nb_home_public (key, content, version, published_by, published_at)
    values ('home', draft, next_version, auth.uid(), now())
    on conflict (key) do update set
      content = excluded.content,
      version = excluded.version,
      published_by = excluded.published_by,
      published_at = excluded.published_at;
  insert into public.nb_home_revisions (key, version, content, published_by)
    values ('home', next_version, draft, auth.uid());
  perform set_config('app.nb_publish_scope','',true);
  return next_version;
end;
$function$;
CREATE OR REPLACE FUNCTION nb_internal.nb_guard_media_revocation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  suffix text := '/nb-media-public/' || old.storage_path;
begin
  if old.approved is true and new.approved is false then
    if exists (
      select 1 from public.nb_product_media pm
      join public.nb_products p on p.id = pm.product_id
      where pm.media_id=old.id and p.status='published'
    ) or exists (
      select 1 from public.nb_products p
      where p.status='published'
        and (
          right(coalesce(p.video_url,''),length(suffix)) = suffix
          or exists (
            select 1 from unnest(p.image_urls) as photo(url)
            where right(photo.url,length(suffix)) = suffix
          )
        )
    ) or exists (
      select 1 from public.nb_categories c
      where right(coalesce(c.image_url,''),length(suffix)) = suffix
        and c.active
    ) or exists (
      select 1 from public.nb_home_public h
      where exists (
        select 1 from (values
          (h.content->>'heroImage'), (h.content->>'menImage'),
          (h.content->>'kidsImage'), (h.content->>'storyImage'),
          (h.content->>'customizationImage')
        ) as asset(url)
        where right(coalesce(asset.url,''),length(suffix)) = suffix
      )
    ) or exists (
      select 1 from public.nb_home_public h
        cross join lateral jsonb_each_text(coalesce(h.content->'sectionVideos','{}'::jsonb)) sv(key,url)
      where right(sv.url,length(suffix))=suffix
    ) then
      raise exception 'Media is referenced by published content; unpublish or replace it first'
        using errcode = '23503';
    end if;
  end if;
  return new;
end
$function$;
CREATE OR REPLACE FUNCTION nb_internal.nb_require_approved_category_image()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.image_url is distinct from old.image_url
     and nullif(trim(new.image_url),'') is not null
     and not exists (
       select 1 from public.nb_media m
       where m.approved and m.archived_at is null
         and m.mime_type like 'image/%'
         and new.image_url = public.nb_media_public_url(m.storage_path)
     )
  then
    raise exception 'Collection artwork must be an approved image from this project'
      using errcode = '23514';
  end if;
  return new;
end;
$function$;

-- =============================================================================
-- 13 / 20: 20261109113800_site_reviews.sql
-- Source: supabase/migrations/20261109113800_site_reviews.sql
-- =============================================================================
-- Only owner-approved, first-party reviews are displayed. No scraped testimonials.
create table if not exists public.nb_reviews (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 70),
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(btrim(comment)) between 20 and 1200),
  source text not null default 'website' check (source='website'),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists nb_reviews_public_index
  on public.nb_reviews (status, approved_at desc, created_at desc);
-- Identical repeat posts must not crowd the queue. This is not a substitute for
-- edge CAPTCHA/IP abuse controls when submission volumes grow.
create unique index if not exists nb_reviews_duplicate_guard
  on public.nb_reviews (lower(btrim(display_name)),md5(lower(btrim(comment))))
  where status in ('pending','approved');
alter table public.nb_reviews enable row level security;
revoke all on public.nb_reviews from public,anon,authenticated;
grant select (id,display_name,rating,comment,source,status,created_at,approved_at)
  on public.nb_reviews to anon;
grant insert (display_name,rating,comment) on public.nb_reviews to anon,authenticated;
grant select on public.nb_reviews to authenticated;
grant update (status) on public.nb_reviews to authenticated;

create policy nb_reviews_public_read on public.nb_reviews for select
  to anon,authenticated using (status='approved');
create policy nb_reviews_staff_read on public.nb_reviews for select
  to authenticated using ((select public.nb_can_edit()));
create policy nb_reviews_public_submit on public.nb_reviews for insert
  to anon,authenticated with check (status='pending' and source='website' and approved_at is null);
create policy nb_reviews_publisher_moderate on public.nb_reviews for update
  to authenticated using ((select public.nb_can_publish()))
  with check ((select public.nb_can_publish()));

create or replace function public.nb_stamp_review_approval()
returns trigger language plpgsql security invoker set search_path=''
as $review_stamp$
begin
  if new.status='approved' and old.status is distinct from 'approved' then
    new.approved_at:=now();
  elsif new.status<>'approved' then
    new.approved_at:=null;
  end if;
  return new;
end;
$review_stamp$;
drop trigger if exists nb_review_approval_stamp on public.nb_reviews;
create trigger nb_review_approval_stamp before update on public.nb_reviews
  for each row execute function public.nb_stamp_review_approval();
revoke all on function public.nb_stamp_review_approval() from public,anon,authenticated;

-- =============================================================================
-- 14 / 20: 20261109120000_featured_media_guard.sql
-- Source: supabase/migrations/20261109120000_featured_media_guard.sql
-- =============================================================================
-- Additional CMS hero/card imagery must belong to an approved public asset.
-- Never accept unreviewed remote photos in a published customer-facing card.
create or replace function nb_internal.nb_require_approved_home_featured()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
begin
  if jsonb_typeof(coalesce(new.content->'featuredImages','{}'::jsonb)) <> 'object' then
    raise exception 'Featured images must be a keyed object' using errcode='23514';
  end if;
  if exists (
    select 1 from jsonb_each_text(coalesce(new.content->'featuredImages','{}'::jsonb)) v(key,url)
    where v.key not in ('one','two','three')
       or (coalesce(v.url,'') <> '' and not exists (
         select 1 from public.nb_media m
         where m.approved and m.archived_at is null and m.mime_type like 'image/%'
           and v.url=public.nb_media_public_url(m.storage_path)
       ))
  ) then
    raise exception 'Featured card image must be an approved library photograph'
      using errcode='23514';
  end if;
  return new;
end;
$function$;
drop trigger if exists nb_guard_published_featured on public.nb_home_public;
create trigger nb_guard_published_featured before insert or update on public.nb_home_public
  for each row execute function nb_internal.nb_require_approved_home_featured();

-- Do not archive, revoke or delete a published featured photo before replacing it.
create or replace function nb_internal.nb_guard_featured_media_removal()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
declare
  suffix text:='/nb-media-public/'||old.storage_path;
begin
  if tg_op='DELETE' or (old.approved and
      (new.approved is false or new.archived_at is not null)) then
    if exists(
      select 1 from public.nb_home_public h
        cross join lateral jsonb_each_text(coalesce(h.content->'featuredImages','{}'::jsonb)) v(key,url)
      where right(coalesce(v.url,''),length(suffix))=suffix
    ) then
      raise exception 'Featured photo is published. Replace or remove it in Website CMS before archiving/deleting'
        using errcode='23503';
    end if;
  end if;
  if tg_op='DELETE' then return old;end if;
  return new;
end;
$function$;
drop trigger if exists nb_guard_featured_media_update on public.nb_media;
create trigger nb_guard_featured_media_update before update on public.nb_media
  for each row execute function nb_internal.nb_guard_featured_media_removal();
drop trigger if exists nb_guard_featured_media_delete on public.nb_media;
create trigger nb_guard_featured_media_delete before delete on public.nb_media
  for each row execute function nb_internal.nb_guard_featured_media_removal();
revoke all on function nb_internal.nb_require_approved_home_featured() from public,anon,authenticated;
revoke all on function nb_internal.nb_guard_featured_media_removal() from public,anon,authenticated;

-- =============================================================================
-- =============================================================================
-- 15 / 20: 20261109190000_media_lifecycle_scale_indexes.sql
-- Source: supabase/migrations/20261109190000_media_lifecycle_scale_indexes.sql
-- =============================================================================
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

-- =============================================================================
-- 16 / 20: 20261109194500_client_sku_handoff.sql
-- Source: supabase/migrations/20261109194500_client_sku_handoff.sql
-- =============================================================================
-- Client-handoff compatibility: one authoritative database, category taxonomy,
-- immutable published garment SKU and batched auto-SKU reservation.
-- Historical published products and existing serial counters are preserved.

update public.nb_categories
  set label='Plain Sherwani'
where path='/men/sherwani/plain' and label is distinct from 'Plain Sherwani';

-- An NB-SH-00001 SKU is a permanent business identifier. Changing a public
-- product's SKU would strand existing photo filenames, CSV references and
-- customer searches. Titles, descriptions, categories, images and price can
-- still be edited by publishing a new version with the same SKU.
create or replace function nb_internal.nb_keep_published_sku()
returns trigger language plpgsql security invoker set search_path=''
as $sku_identity$
begin
  if old.sku is distinct from new.sku then
    raise exception 'This product SKU is permanent. Create a new garment for a different SKU.'
      using errcode='23514';
  end if;
  return new;
end;
$sku_identity$;
revoke all on function nb_internal.nb_keep_published_sku() from public,anon,authenticated;
drop trigger if exists nb_keep_published_sku on public.nb_products;
create trigger nb_keep_published_sku
  before update of sku on public.nb_products
  for each row execute function nb_internal.nb_keep_published_sku();

-- Batch import can reserve up to 100 serial IDs in one authenticated RPC;
-- nb_next_sku locks the per-garment counter through INSERT ON CONFLICT UPDATE.
-- Counter gaps after abandoned drafts are safe; SKUs are never reused.
create or replace function public.nb_reserve_skus(p_category_path text,p_count integer)
returns text[] language plpgsql security invoker set search_path=''
as $reserve$
declare
  result text[] := '{}';
  i integer;
begin
  if not (select public.nb_can_edit()) then
    raise exception 'Staff access required' using errcode='42501';
  end if;
  if p_count is null or p_count < 1 or p_count > 100 then
    raise exception 'Reserve 1 to 100 products at a time' using errcode='22023';
  end if;
  for i in 1..p_count loop
    result := array_append(result,public.nb_next_sku(p_category_path));
  end loop;
  return result;
end;
$reserve$;
revoke all on function public.nb_reserve_skus(text,integer) from public,anon,authenticated;
grant execute on function public.nb_reserve_skus(text,integer) to authenticated;

-- Sanity check that a garment's SKU counter is still restricted to staff.
do $checks$
begin
  if not exists(
    select 1 from pg_policies
    where schemaname='public' and tablename='nb_sku_counters'
  ) or not exists(
    select 1 from pg_trigger where tgrelid='public.nb_products'::regclass
      and tgname='nb_keep_published_sku' and not tgisinternal
  ) then
    raise exception 'SKU role gate or identity guard is missing';
  end if;
end;
$checks$;

-- =============================================================================
-- 17 / 20: 20261109210000_sku_counter_least_privilege.sql
-- Source: supabase/migrations/20261109210000_sku_counter_least_privilege.sql
-- =============================================================================
-- SKU counters are written only through the staff-gated reservation flow.
-- RLS remains the row-level authorization layer; table ACLs are narrowed so
-- the public role cannot issue direct counter operations and staff can only
-- perform the operations required by nb_next_sku() (SELECT/INSERT/UPDATE).
REVOKE ALL PRIVILEGES ON TABLE public.nb_sku_counters FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.nb_sku_counters FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.nb_sku_counters TO authenticated;

DO $sku_acl_assert$
BEGIN
  IF has_table_privilege('anon','public.nb_sku_counters','SELECT')
    OR has_table_privilege('anon','public.nb_sku_counters','INSERT')
    OR has_table_privilege('anon','public.nb_sku_counters','UPDATE')
    OR has_table_privilege('anon','public.nb_sku_counters','DELETE')
    OR has_table_privilege('anon','public.nb_sku_counters','TRUNCATE')
    OR has_table_privilege('anon','public.nb_sku_counters','REFERENCES')
    OR has_table_privilege('anon','public.nb_sku_counters','TRIGGER')
  THEN
    RAISE EXCEPTION 'Anonymous SKU counter privileges must be revoked';
  END IF;

  IF NOT (
    has_table_privilege('authenticated','public.nb_sku_counters','SELECT')
    AND has_table_privilege('authenticated','public.nb_sku_counters','INSERT')
    AND has_table_privilege('authenticated','public.nb_sku_counters','UPDATE')
  ) OR has_table_privilege('authenticated','public.nb_sku_counters','DELETE')
    OR has_table_privilege('authenticated','public.nb_sku_counters','TRUNCATE')
    OR has_table_privilege('authenticated','public.nb_sku_counters','REFERENCES')
    OR has_table_privilege('authenticated','public.nb_sku_counters','TRIGGER')
  THEN
    RAISE EXCEPTION 'Authenticated SKU counter privileges are not least-privilege';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='nb_sku_counters'
      AND policyname='nb_sku_counter_staff'
      AND cmd='ALL'
      AND roles @> ARRAY['authenticated']::name[]
  ) THEN
    RAISE EXCEPTION 'Staff-only SKU counter RLS policy is missing';
  END IF;
END
$sku_acl_assert$;

-- =============================================================================
-- 18 / 20: 20261109213000_consolidate_cms_rls_policies.sql
-- Source: supabase/migrations/20261109213000_consolidate_cms_rls_policies.sql
-- =============================================================================
-- Preserve the existing OR semantics while avoiding multiple permissive
-- UPDATE/SELECT policies for the same authenticated role.
DROP POLICY IF EXISTS nb_media_editor_update_pending ON public.nb_media;
DROP POLICY IF EXISTS nb_media_publisher_update ON public.nb_media;
DROP POLICY IF EXISTS nb_media_staff_update ON public.nb_media;

CREATE POLICY nb_media_staff_update ON public.nb_media
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.nb_can_publish())
    OR (
      NOT approved
      AND uploaded_by=(SELECT auth.uid())
      AND (SELECT public.nb_can_edit())
    )
  )
  WITH CHECK (
    (SELECT public.nb_can_publish())
    OR (
      NOT approved
      AND uploaded_by=(SELECT auth.uid())
      AND split_part(storage_path,'/',1)=((SELECT auth.uid())::text)
      AND (SELECT public.nb_can_edit())
    )
  );

DROP POLICY IF EXISTS nb_reviews_public_read ON public.nb_reviews;
DROP POLICY IF EXISTS nb_reviews_staff_read ON public.nb_reviews;
DROP POLICY IF EXISTS nb_reviews_authenticated_read ON public.nb_reviews;

-- Keep the public policy free of staff-only function dependencies.
-- Authenticated users get one policy that grants the union of public-approved
-- rows and the additional staff-visible rows.
CREATE POLICY nb_reviews_public_read ON public.nb_reviews
  FOR SELECT TO anon
  USING (status='approved');

CREATE POLICY nb_reviews_authenticated_read ON public.nb_reviews
  FOR SELECT TO authenticated
  USING (
    status='approved'
    OR (SELECT public.nb_can_edit())
  );

DO $policy_assert$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='nb_media'
      AND policyname IN ('nb_media_editor_update_pending','nb_media_publisher_update')
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='nb_media'
      AND policyname='nb_media_staff_update' AND cmd='UPDATE'
  ) THEN
    RAISE EXCEPTION 'Media update policy consolidation failed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='nb_reviews'
      AND policyname='nb_reviews_staff_read'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='nb_reviews'
      AND policyname='nb_reviews_public_read' AND cmd='SELECT'
      AND roles=ARRAY['anon']::name[]
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='nb_reviews'
      AND policyname='nb_reviews_authenticated_read' AND cmd='SELECT'
      AND roles=ARRAY['authenticated']::name[]
  ) THEN
    RAISE EXCEPTION 'Reviews read policy consolidation failed';
  END IF;
END
$policy_assert$;

-- =============================================================================
-- 19 / 20: 20261109220000_multi_video_gallery.sql
-- Source: supabase/migrations/20261109220000_multi_video_gallery.sql
-- =============================================================================
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

-- Final install verification: fail the whole transaction if a required security
-- boundary, RPC, media bucket or multi-video column is missing.
-- =============================================================================
-- 20 / 20: 20261109230000_move_pg_trgm_extension.sql
-- Source: supabase/migrations/20261109230000_move_pg_trgm_extension.sql
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS extensions;
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
    -- The schema is created above for local PostgreSQL test parity.
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

DO $nb_install_assert$
DECLARE
  missing_tables text[];
BEGIN
  SELECT array_agg(required.table_name ORDER BY required.table_name)
    INTO missing_tables
  FROM unnest(ARRAY[
    'nb_categories','nb_products','nb_media','nb_home_drafts',
    'nb_home_public','nb_home_revisions','nb_product_drafts',
    'nb_product_revisions','nb_product_media','nb_product_categories',
    'nb_import_jobs','nb_import_rows','nb_audit_events','nb_sku_counters'
  ]) AS required(table_name)
  WHERE to_regclass('public.' || required.table_name) IS NULL;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Required CMS tables are missing: %', missing_tables;
  END IF;

  IF NOT (
    (SELECT relrowsecurity FROM pg_class WHERE oid='public.nb_products'::regclass)
    AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.nb_media'::regclass)
    AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.nb_product_drafts'::regclass)
    AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.nb_sku_counters'::regclass)
  ) THEN
    RAISE EXCEPTION 'Required CMS row-level security is not enabled';
  END IF;

  IF has_table_privilege('anon','public.nb_product_drafts','SELECT')
    OR has_table_privilege('anon','public.nb_media','SELECT')
    OR has_table_privilege('anon','public.nb_sku_counters','SELECT')
    OR has_table_privilege('anon','public.nb_sku_counters','INSERT')
    OR has_table_privilege('anon','public.nb_sku_counters','UPDATE')
    OR has_table_privilege('anon','public.nb_sku_counters','DELETE')
    OR has_table_privilege('anon','public.nb_sku_counters','TRUNCATE')
  THEN
    RAISE EXCEPTION 'Anonymous access to private CMS data or SKU counters is too broad';
  END IF;

  IF has_schema_privilege('anon','nb_internal','USAGE')
    OR has_schema_privilege('authenticated','nb_internal','USAGE')
  THEN
    RAISE EXCEPTION 'Internal CMS schema must not be directly accessible to API roles';
  END IF;

  IF NOT has_function_privilege('authenticated','public.nb_publish_product(uuid)','EXECUTE')
    OR has_function_privilege('anon','public.nb_publish_product(uuid)','EXECUTE')
  THEN
    RAISE EXCEPTION 'Product publishing RPC privileges are incorrect';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nb_products' AND column_name='video_urls'
  ) THEN
    RAISE EXCEPTION 'Multi-video product gallery column is missing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='nb-media-staging')
    OR NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='nb-media-public')
  THEN
    RAISE EXCEPTION 'Private staging and public media buckets must both exist';
  END IF;
END
$nb_install_assert$;

COMMIT;

-- SUCCESS (if query completed and transaction COMMITted):
-- Next: Edge Function, Auth owner, Vercel publishable key + deployment.
-- See docs/ACTIVATE_LIVE_CMS.md and docs/NOMAN_SQL_EDITOR_COPY_PASTE.md.
