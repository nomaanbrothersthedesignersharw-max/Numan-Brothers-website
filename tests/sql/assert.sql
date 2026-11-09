-- Fail fast on unexpected privilege, role or publishing behavior.
\set ON_ERROR_STOP on
\echo 'Checking public access does not grant writes'
set role anon;
do $$
begin
  if (select count(*) from public.nb_products) <> 0 then
    raise exception 'Catalogue was unexpectedly prepopulated';
  end if;
end;
$$;
do $$
declare forbidden boolean := false;
begin
  begin
    insert into public.nb_product_drafts (product_id, content,updated_by)
      values ('99999999-9999-4999-8999-999999999999','{}'::jsonb,'11111111-1111-4111-8111-111111111111');
  exception when insufficient_privilege then forbidden := true;
  end;
  if not forbidden then raise exception 'Anonymous draft write was allowed'; end if;
end;
$$;
reset role;
\echo 'Checking editor permissions'
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('request.jwt.claims','{"iss":"https://test.supabase.co/auth/v1","app_metadata":{"nb_role":"editor"}}',false);
set role authenticated;
do $$
begin
  if not public.nb_can_edit() or public.nb_can_publish() then
    raise exception 'Editor role check is incorrect';
  end if;
end;
$$;
insert into public.nb_media(storage_path,original_name,mime_type,size_bytes,approved,uploaded_by)
  values
  ('11111111-1111-4111-8111-111111111111/44444444-4444-4444-8444-444444444444.webp','a.webp','image/webp',1024,false,
    '11111111-1111-4111-8111-111111111111'),
  ('11111111-1111-4111-8111-111111111111/55555555-5555-4555-8555-555555555555.mp4','garment.mp4','video/mp4',2048,false,
    '11111111-1111-4111-8111-111111111111');
insert into public.nb_home_drafts(key,content,updated_by) values ('home',
 '{"heroTitle":"Crafted for your occasion","heroImage":""}',
 '11111111-1111-4111-8111-111111111111');
insert into public.nb_product_drafts(product_id,content,updated_by) values
  ('22222222-2222-4222-8222-222222222222',
  '{"sku":"NB-CI-1","slug":"ci-kids-sherwani","title":"Kids Sherwani","department":"kids","categoryPaths":["/kids/sherwani"],"imageUrls":["https://test.supabase.co/storage/v1/object/public/nb-media-public/11111111-1111-4111-8111-111111111111/44444444-4444-4444-8444-444444444444.webp"],"videoUrls":["https://test.supabase.co/storage/v1/object/public/nb-media-public/11111111-1111-4111-8111-111111111111/55555555-5555-4555-8555-555555555555.mp4"],"sizes":["M"],"price":"999.00"}',
  '11111111-1111-4111-8111-111111111111');
do $$
declare rejected boolean := false;
begin
  begin
    perform public.nb_publish_home();
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'Editor could publish homepage'; end if;
  rejected:=false;
  begin
    perform public.nb_publish_product('22222222-2222-4222-8222-222222222222');
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'Editor could publish product'; end if;
end;
$$;
-- An editor must not be able to approve media or write a published product.
do $$
declare changed integer := 0; denied boolean := false;
begin
  begin
    update public.nb_media set approved = true;
    get diagnostics changed = row_count;
    if changed = 0 then denied := true; end if;
  exception when insufficient_privilege or check_violation then
    denied := true;
  end;
  if not denied then raise exception 'Editor approved media'; end if;
end;
$$;
reset role;
\echo 'Checking publisher transaction and media approval'
-- Simulate the audited server-side asset promotion (service role), not a browser update.
update public.nb_media set approved=true;
select set_config('request.jwt.claims','{"iss":"https://test.supabase.co/auth/v1","app_metadata":{"nb_role":"owner"}}',false);
set role authenticated;
do $$
begin
  if not public.nb_can_publish() then raise exception 'Owner role missing'; end if;
  if public.nb_publish_home() <> 1 then raise exception 'Invalid homepage version'; end if;
  if public.nb_publish_product('22222222-2222-4222-8222-222222222222') <> 1 then
    raise exception 'Invalid product version';
  end if;
  if (select cardinality(video_urls) from public.nb_products
      where id='22222222-2222-4222-8222-222222222222') <> 1
     or (select video_url from public.nb_products
      where id='22222222-2222-4222-8222-222222222222')
      <> 'https://test.supabase.co/storage/v1/object/public/nb-media-public/11111111-1111-4111-8111-111111111111/55555555-5555-4555-8555-555555555555.mp4' then
    raise exception 'Approved product video gallery was not published or legacy primary URL was not kept';
  end if;
end;
$$;
-- Reject a media URL hosted on any other domain, even if its path
-- duplicates an otherwise approved Storage object.
do $$
declare blocked boolean := false;
begin
  update public.nb_product_drafts
    set content = jsonb_set(content, '{imageUrls}',
      '["https://attacker.example/storage/v1/object/public/nb-media-public/11111111-1111-4111-8111-111111111111/44444444-4444-4444-8444-444444444444.webp"]'::jsonb)
    where product_id='22222222-2222-4222-8222-222222222222';
  begin
    perform public.nb_publish_product('22222222-2222-4222-8222-222222222222');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Unapproved external media URL was accepted'; end if;
  update public.nb_product_drafts
    set content = jsonb_set(content, '{imageUrls}',
      '["https://test.supabase.co/storage/v1/object/public/nb-media-public/11111111-1111-4111-8111-111111111111/44444444-4444-4444-8444-444444444444.webp"]'::jsonb)
    where product_id='22222222-2222-4222-8222-222222222222';
end;
$$;
-- The owner may publish via RPC, but must not directly mutate a live row.
do $$
declare denied boolean := false;
begin
  begin
    update public.nb_products set title='Bypassed publishing' where sku='NB-CI-1';
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'Owner could bypass product publishing'; end if;

  denied:=false;
  begin
    update public.nb_home_public set content='{"heroTitle":"Bypassed"}'::jsonb where key='home';
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'Owner could bypass homepage publishing'; end if;

  if (select count(*) from public.nb_product_revisions where product_id =
    '22222222-2222-4222-8222-222222222222') <> 1 then
    raise exception 'Product revision was not recorded';
  end if;
  if (select count(*) from public.nb_home_revisions where key='home') <> 1 then
    raise exception 'Homepage revision was not recorded';
  end if;
end;
$$;
-- Confirm revision history cannot be overwritten through the Data API.
do $$
declare forbidden boolean := false;
begin
  begin
    update public.nb_home_revisions set version=9 where key='home';
  exception when insufficient_privilege then forbidden:=true;
  end;
  if not forbidden then raise exception 'Published revisions are mutable'; end if;
end;
$$;
-- Direct approval is not permitted through an owner browser session.
do $media_gate$
declare denied boolean := false;
begin
  begin
    update public.nb_media set approved = false where original_name = 'a.webp';
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Client can mutate approval status directly'; end if;
end $media_gate$;

-- Publishers must use the RPC even for writing revision history. An owner
-- cannot forge a published version or permanently remove a live catalogue row.
do $phase1$
declare denied boolean := false;
begin
  begin
    insert into public.nb_product_revisions(product_id,version,content,published_by)
    values ('22222222-2222-4222-8222-222222222222',99,
      '{"title":"Forged product revision"}'::jsonb,
      '11111111-1111-4111-8111-111111111111');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Owner forged product revision history'; end if;

  denied := false;
  begin
    insert into public.nb_home_revisions(key,version,content,published_by)
    values ('home',99,'{"heroTitle":"Forged homepage"}'::jsonb,
      '11111111-1111-4111-8111-111111111111');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Owner forged homepage revision history'; end if;

  denied := false;
  begin
    delete from public.nb_products where sku='NB-CI-1';
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Direct product deletion was allowed'; end if;

  denied := false;
  begin
    delete from public.nb_media where original_name='a.webp';
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Direct media deletion was allowed'; end if;

  if (select count(*) from public.nb_products where sku='NB-CI-1') <> 1 then
    raise exception 'A publishing-protected product was deleted';
  end if;
  if (select count(*) from public.nb_product_revisions) <> 1 or
     (select count(*) from public.nb_home_revisions) <> 1 then
    raise exception 'Revision history was tampered with';
  end if;
end;
$phase1$;
-- Confirm unpublished/draft HTML cannot be publicly selected.
reset role;
select set_config('request.jwt.claims','{}',false);
select set_config('request.jwt.claim.sub','',false);
set role anon;
do $$
declare count_products integer; count_pages integer; forbidden boolean := false;
begin
  select count(*) into count_products from public.nb_products;
  select count(*) into count_pages from public.nb_home_public;
  if count_products<>1 or count_pages<>1 then raise exception 'Published rows not visible'; end if;
  begin
    perform 1 from public.nb_home_drafts;
  exception when insufficient_privilege then forbidden:=true;
  end;
  if not forbidden then raise exception 'Anonymous user could read homepage drafts'; end if;
end;
$$;
reset role;
\echo 'CMS PostgreSQL security and publish tests PASSED'
