begin;

alter table public.nb_reviews
  add column if not exists product_id uuid references public.nb_products(id) on delete cascade;

create index if not exists nb_reviews_product_public_idx
  on public.nb_reviews (product_id, status, approved_at desc, created_at desc);

grant insert (display_name, rating, comment, product_id)
  on public.nb_reviews to anon, authenticated;

commit;
