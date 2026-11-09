-- Staging package fixture-only verification, run after other role tests.
-- Never execute this test against the real client catalogue.
\set ON_ERROR_STOP on
\echo 'Checking private Storage flags and append-only operational audit'
do $staging$
begin
  if (select public from storage.buckets where id='nb-media-staging') then
    raise exception 'Staging media bucket is public';
  end if;
  if not (select public from storage.buckets where id='nb-media-public') then
    raise exception 'Approved delivery bucket must be publicly readable';
  end if;
  if (select public from storage.buckets where id='nb-media') then
    raise exception 'Legacy upload bucket must not be public';
  end if;
  if (select count(*) from public.nb_audit_events
    where event_type='product_published') < 1 then
    raise exception 'Published product was not audited';
  end if;
  if (select count(*) from public.nb_audit_events
    where event_type='media_approved') < 1 then
    raise exception 'Approved asset transition was not audited';
  end if;
end $staging$;

-- Anonymous access must fail to read audit events even though published
-- catalogue and the public homepage remain visible.
set role anon;
do $anonymous$
declare blocked boolean := false;
begin
  begin
    perform 1 from public.nb_audit_events;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then
    raise exception 'Anonymous audit history exposure';
  end if;
  blocked := false;
  begin
    perform * from public.nb_catalogue_health();
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Anonymous health report exposure'; end if;
end $anonymous$;
reset role;

-- Editor can prepare drafts, but cannot browse manager audit/health reports.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('request.jwt.claims','{"iss":"https://test.supabase.co/auth/v1","app_metadata":{"nb_role":"editor"}}',false);
set role authenticated;
do $editor$
declare blocked boolean := false;
begin
  if exists(select 1 from public.nb_audit_events) then
    raise exception 'Editor can read manager-only audit events';
  end if;
  begin
    perform * from public.nb_catalogue_health();
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Editor can read health report'; end if;
end $editor$;
reset role;

select set_config('request.jwt.claims','{"iss":"https://test.supabase.co/auth/v1","app_metadata":{"nb_role":"owner"}}',false);
set role authenticated;
do $owner$
declare metrics record;
        blocked boolean := false;
begin
  select * into metrics from public.nb_catalogue_health();
  -- One approved image and one approved video are now both first-class media assets.
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='nb_products_video_urls_gin_idx'
  ) or not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='nb_product_drafts_content_gin_idx'
  ) then
    raise exception 'Video reference lookup indexes are missing';
  end if;

  if not exists (
    select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace
    where e.extname='pg_trgm' and n.nspname='extensions'
  ) then
    raise exception 'pg_trgm extension is not isolated in the extensions schema';
  end if;

  if metrics.published_products <> 1 or metrics.approved_assets <> 2 then
    raise exception 'Manager health metrics invalid';
  end if;
  if (select count(*) from public.nb_audit_events) < 2 then
    raise exception 'Manager cannot read audit history';
  end if;
  begin
    insert into public.nb_audit_events(event_type,entity_type,entity_id)
    values('media_approved','media','forged');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Owner forged an audit event'; end if;
end $owner$;
reset role;

-- Even service-level SQL cannot unapprove a public asset still referenced
-- by a published product. Ordinary UI role already lacks this permission.
do $referenced$
declare blocked boolean := false;
begin
  begin
    update public.nb_media set approved=false where original_name='a.webp';
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then
    raise exception 'Revocation of referenced published image was allowed';
  end if;
  if not (select approved from public.nb_media where original_name='a.webp') then
    raise exception 'Revoke guard did not preserve media approval';
  end if;
end $referenced$;

\echo 'Staging schema audit / private Storage integrity PASSED'
