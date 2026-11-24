begin;

-- Phase 1 (#1 & #5): Restore strict staff moderation on customer reviews while keeping
-- product_id and photo_urls readable on approved reviews without 42501 permission errors.
alter table public.nb_reviews alter column status set default 'pending';

-- Restrict anon/authenticated INSERT to the exact public submission columns (cannot inject status='approved')
revoke insert on public.nb_reviews from anon, authenticated;
grant insert (display_name, rating, comment, product_id, photo_urls)
  on public.nb_reviews to anon, authenticated;

-- Keep SELECT on approved rows (including product_id and photo_urls) guarded by RLS (status='approved')
grant select on public.nb_reviews to anon, authenticated;

drop policy if exists nb_reviews_public_submit on public.nb_reviews;
create policy nb_reviews_public_submit on public.nb_reviews for insert
  to anon, authenticated
  with check (status = 'pending' and source = 'website' and approved_at is null);

-- Verify privileged RPCs are strictly revoked from public/anon
revoke all on function public.nb_delete_product(uuid) from public, anon;
revoke all on function public.nb_delete_media_permanently(uuid) from public, anon;

commit;
