-- Client-owned CMS SKU invariants. Runs only inside disposable CI Postgres.
\set ON_ERROR_STOP on
begin;
do $taxonomy$
begin
  if (select label from public.nb_categories where path='/men/sherwani/plain') <> 'Plain Sherwani' then
    raise exception 'Plain sherwani category mislabeled as suits';
  end if;
  if (select label from public.nb_categories where path='/men/suits/plain') <> 'Plain Suits' then
    raise exception 'Plain suits no longer in correct collection';
  end if;
  if not exists(
    select 1 from pg_trigger where tgrelid='public.nb_products'::regclass
      and tgname='nb_keep_published_sku' and not tgisinternal
  ) then raise exception 'Published SKU identity guard missing'; end if;
end;
$taxonomy$;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims',
  '{"iss":"https://test.supabase.co/auth/v1","app_metadata":{"nb_role":"owner"}}',true);
set local role authenticated;
do $serial$
declare a text[];b text[];
begin
  a:=public.nb_reserve_skus('/men/sherwani/plain',2);
  b:=public.nb_reserve_skus('/men/suits/handwork',1);
  if cardinality(a)<>2 or a[1] !~ '^NB-SH-[0-9]{5}$'
    or a[2] !~ '^NB-SH-[0-9]{5}$' or a[1]=a[2] then
    raise exception 'Sherwani serial generator failed';
  end if;
  if cardinality(b)<>1 or b[1] !~ '^NB-SU-[0-9]{5}$' then
    raise exception 'Suits serial generator failed';
  end if;
  if split_part(a[1],'-',2)=split_part(b[1],'-',2) then
    raise exception 'Distinct garment types share SKU prefix';
  end if;
end;
$serial$;
reset role;
do $immutability$
declare denied boolean:=false;
begin
  begin
    update public.nb_products set sku='NB-SH-99999' where sku='NB-CI-1';
  exception when check_violation then denied:=true;
  end;
  if not denied then raise exception 'Published product SKU was editable'; end if;
end;
$immutability$;
rollback;
\echo 'Permanent SKU and customer taxonomy checks PASSED'
