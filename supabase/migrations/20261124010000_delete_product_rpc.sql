begin;

-- Function to safely and permanently delete a product and all related rows from Supabase
create or replace function public.nb_delete_product(p_product_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  -- Only owners or admins may permanently delete garments
  if not public.nb_can_publish() then
    raise exception 'Only store owners or admins may permanently delete garments' using errcode = '42501';
  end if;

  -- Set publish scope so system triggers permit deletion
  perform set_config('app.nb_publish_scope', 'product', true);

  -- Delete associations and drafts
  delete from public.nb_product_categories where product_id = p_product_id;
  delete from public.nb_product_media where product_id = p_product_id;
  delete from public.nb_product_revisions where product_id = p_product_id;
  delete from public.nb_product_drafts where product_id = p_product_id;
  delete from public.nb_reviews where product_id = p_product_id;

  -- Delete from nb_products
  delete from public.nb_products where id = p_product_id;

  -- Reset publish scope
  perform set_config('app.nb_publish_scope', '', true);

  return true;
end;
$$;

revoke all on function public.nb_delete_product(uuid) from public, anon;
grant execute on function public.nb_delete_product(uuid) to authenticated;

-- Allow authenticated publishers to delete from nb_products when policy allows
drop policy if exists nb_products_publisher_delete on public.nb_products;
create policy nb_products_publisher_delete on public.nb_products
  for delete to authenticated
  using ((select public.nb_can_publish()));

grant delete on public.nb_products to authenticated;

commit;
