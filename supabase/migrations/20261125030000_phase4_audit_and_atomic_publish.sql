-- Phase 4 (#22, #26, #27): Expand immutable CMS audit history to record
-- product archival, permanent product deletion, permanent media deletion,
-- and customer review moderation/deletion with actor_id and timestamp.

begin;

-- 1. Expand allowed event_type and entity_type values on public.nb_audit_events
alter table public.nb_audit_events
  drop constraint if exists nb_audit_events_event_type_check;

alter table public.nb_audit_events
  add constraint nb_audit_events_event_type_check check (event_type in (
    'product_published',
    'product_archived',
    'product_deleted',
    'homepage_published',
    'category_updated',
    'media_approved',
    'media_revoked',
    'media_deleted',
    'review_moderated',
    'review_deleted',
    'import_status_changed'
  ));

alter table public.nb_audit_events
  drop constraint if exists nb_audit_events_entity_type_check;

alter table public.nb_audit_events
  add constraint nb_audit_events_entity_type_check check (entity_type in (
    'product',
    'homepage',
    'category',
    'media',
    'review',
    'import'
  ));

-- 2. Trigger function for product archive/delete, media delete, and review moderation/delete
create or replace function nb_internal.nb_record_lifecycle_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
  v_entity text;
  v_id text;
  v_meta jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'nb_products' then
    v_entity := 'product';
    if tg_op = 'DELETE' then
      v_event := 'product_deleted';
      v_id := old.id::text;
      v_meta := jsonb_build_object('sku', old.sku, 'status', old.status);
    elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'archived' then
      v_event := 'product_archived';
      v_id := new.id::text;
      v_meta := jsonb_build_object('sku', new.sku, 'previous_status', old.status);
    else
      return coalesce(new, old);
    end if;

  elsif tg_table_name = 'nb_media' and tg_op = 'DELETE' then
    v_entity := 'media';
    v_event := 'media_deleted';
    v_id := old.id::text;
    v_meta := jsonb_build_object('storage_path', old.storage_path, 'approved', old.approved);

  elsif tg_table_name = 'nb_reviews' then
    v_entity := 'review';
    if tg_op = 'DELETE' then
      v_event := 'review_deleted';
      v_id := old.id::text;
      v_meta := jsonb_build_object('rating', old.rating, 'status', old.status);
    elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
      v_event := 'review_moderated';
      v_id := new.id::text;
      v_meta := jsonb_build_object('from', old.status, 'to', new.status, 'rating', new.rating);
    else
      return coalesce(new, old);
    end if;
  else
    return coalesce(new, old);
  end if;

  insert into public.nb_audit_events (actor_id, event_type, entity_type, entity_id, meta)
  values (auth.uid(), v_event, v_entity, v_id, v_meta);

  return coalesce(new, old);
end;
$$;

revoke all on function nb_internal.nb_record_lifecycle_event() from public, anon, authenticated;

drop trigger if exists nb_audit_product_lifecycle on public.nb_products;
create trigger nb_audit_product_lifecycle
  after update or delete on public.nb_products
  for each row execute function nb_internal.nb_record_lifecycle_event();

drop trigger if exists nb_audit_media_delete on public.nb_media;
create trigger nb_audit_media_delete
  after delete on public.nb_media
  for each row execute function nb_internal.nb_record_lifecycle_event();

drop trigger if exists nb_audit_review_lifecycle on public.nb_reviews;
create trigger nb_audit_review_lifecycle
  after update or delete on public.nb_reviews
  for each row execute function nb_internal.nb_record_lifecycle_event();

commit;
