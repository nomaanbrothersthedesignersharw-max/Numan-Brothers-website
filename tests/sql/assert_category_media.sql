-- Negative category artwork tests using the existing fixture owner + media.
-- Must run after assert.sql and assert_staging_integrity.sql.
\set ON_ERROR_STOP on

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('request.jwt.claims','{"iss":"https://test.supabase.co/auth/v1","app_metadata":{"nb_role":"owner"}}',false);
set role authenticated;
do $guard$
declare blocked boolean := false;
begin
  begin
    update public.nb_categories
      set image_url='https://unapproved.example/sherwani.jpg'
      where path='/men/sherwani';
  exception when check_violation then blocked := true;
  end;
  if not blocked then
    raise exception 'Publisher bypassed approved collection artwork checks';
  end if;
  if (select image_url from public.nb_categories where path='/men/sherwani') is not null then
    raise exception 'Invalid banner survived guard';
  end if;

  update public.nb_categories
     set image_url='https://test.supabase.co/storage/v1/object/public/nb-media-public/11111111-1111-4111-8111-111111111111/44444444-4444-4444-8444-444444444444.webp'
     where path='/men/sherwani';
  if (select image_url from public.nb_categories where path='/men/sherwani') is null then
    raise exception 'Approved collection banner was incorrectly rejected';
  end if;
end $guard$;
reset role;

-- The server guard blocks revocation when an approved collection references
-- a photograph even if that photograph is removed from product/homepage.
do $collection$
declare blocked boolean := false;
begin
  -- Existing published product already holds the same asset. The global guard
  -- must still reject the unapproval attempt; the collection is an added check.
  begin
    update public.nb_media set approved=false where original_name='a.webp';
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then raise exception 'Referenced category media was revoked'; end if;
end $collection$;
\echo 'Approved category artwork and safe media-revocation checks PASSED'
