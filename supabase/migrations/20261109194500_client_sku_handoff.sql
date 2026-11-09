begin;
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
commit;
