begin;

-- 1. Link the existing uploaded photo review ("Mohammed Imran") directly to Noir Crystal Handwork Indo-Western Sherwani (NB-SH-00004)
update public.nb_reviews
  set product_id = '788f30aa-6d01-43a8-a345-9ae15074cc3e'
  where id = '08981c6a-a99c-4d77-95eb-28f9f02cc0db'
    and product_id is null
    and exists (select 1 from public.nb_products where id = '788f30aa-6d01-43a8-a345-9ae15074cc3e');

-- 2. Allow store owners/admins in Studio to re-link product_id and permanently delete spam reviews
grant update (status, product_id) on public.nb_reviews to authenticated;
grant delete on public.nb_reviews to authenticated;

drop policy if exists nb_reviews_publisher_delete on public.nb_reviews;
create policy nb_reviews_publisher_delete on public.nb_reviews for delete
  to authenticated using ((select public.nb_can_publish()));

commit;
