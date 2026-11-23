begin;

-- 1. Grant full select and insert on nb_reviews so anon can read product_id and photo_urls without 42501 permission errors
grant select, insert on public.nb_reviews to anon, authenticated;

-- 2. Make status default to 'approved' so customer product reviews appear on the site immediately
alter table public.nb_reviews alter column status set default 'approved';

-- 3. Update existing pending reviews (including the user's recently submitted review) to approved
update public.nb_reviews
  set status = 'approved',
      approved_at = coalesce(approved_at, created_at, now())
  where status = 'pending';

-- 4. Update the public insert policy to permit approved website submissions
drop policy if exists nb_reviews_public_submit on public.nb_reviews;
create policy nb_reviews_public_submit on public.nb_reviews for insert
  to anon, authenticated
  with check (source = 'website' and status in ('approved', 'pending'));

commit;
