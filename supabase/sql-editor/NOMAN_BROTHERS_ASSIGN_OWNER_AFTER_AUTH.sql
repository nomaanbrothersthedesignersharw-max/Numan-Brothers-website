-- =============================================================================
-- NOMAN BROTHERS - ONE VERIFIED OWNER ACCOUNT (RUN AFTER FRESH CMS INSTALL)
-- =============================================================================
-- Step 1: Supabase Dashboard > Authentication > Users > Add user.
--         Create the client's actual Gmail and a strong password *there*;
--         verify/confirm the email with the owner.
-- Step 2: Change ONLY the owner_email value below to that verified Gmail.
-- Step 3: Run this file in the SQL Editor of the SAME project as Vercel.
-- Step 4: Sign out of /studio and sign back in to refresh JWT role claims.
--
-- NEVER put a plaintext password, service_role key or client Gmail password
-- into this script, GitHub, Vercel VITE_* variables, or frontend source code.
-- This script does not create Auth users; Auth must create credentials safely.
-- It refuses to override any different existing privileged staff account.
-- =============================================================================

begin;

do $nb_assign_owner$
declare
  owner_email text := 'REPLACE_WITH_VERIFIED_CLIENT_EMAIL@example.com';
  owner_id uuid;
  conflicting_staff integer;
begin
  if owner_email = 'REPLACE_WITH_VERIFIED_CLIENT_EMAIL@example.com'
     or owner_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'First replace owner_email with the verified owner Gmail from Authentication > Users';
  end if;

  select id into owner_id
  from auth.users
  where lower(email) = lower(trim(owner_email))
    and email_confirmed_at is not null;

  if owner_id is null then
    raise exception 'A matching confirmed Auth user was not found. Create/confirm the user in Authentication > Users first.';
  end if;

  select count(*) into conflicting_staff
  from auth.users
  where id <> owner_id
    and coalesce(raw_app_meta_data->>'nb_role','') in ('owner','admin','editor');

  if conflicting_staff > 0 then
    raise exception 'Another CMS staff account already has access. Review that account before commissioning a single-owner project.';
  end if;

  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data,'{}'::jsonb) || '{"nb_role":"owner"}'::jsonb
  where id = owner_id;

  if not exists(
    select 1 from auth.users
    where id = owner_id and raw_app_meta_data->>'nb_role'='owner'
  ) then
    raise exception 'Owner assignment could not be verified';
  end if;

  raise notice 'Verified owner metadata assigned. Refresh the CMS Auth session to activate the owner role.';
end;
$nb_assign_owner$;

commit;

-- Read-only verification: expect exactly one confirmed owner, no other staff.
select
  email,
  (raw_app_meta_data->>'nb_role') as cms_role,
  (email_confirmed_at is not null) as confirmed
from auth.users
where raw_app_meta_data->>'nb_role' in ('owner','admin','editor')
order by email;
