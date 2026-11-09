import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const sql = readFileSync(new URL('../supabase/migrations/20261107060000_nomaan_cms.sql', import.meta.url),'utf8');
const phase2 = readFileSync(new URL('../supabase/migrations/20261107130000_catalogue_private_media.sql', import.meta.url),'utf8');
const policyRemediation = readFileSync(new URL('../supabase/migrations/20261109213000_consolidate_cms_rls_policies.sql', import.meta.url),'utf8');
describe('CMS migration guardrails (static checks; deploy requires live RLS verification)', () => {
  test('has RLS on every public CMS table', () => {
    for (const table of ['nb_products','nb_categories','nb_media','nb_product_drafts','nb_product_revisions','nb_home_drafts','nb_home_public','nb_home_revisions']) {
      expect(sql).toContain('alter table public.'+table+' enable row level security');
    }
  });
  test('does not allow anonymous writes', () => {
    expect(sql).not.toMatch(/for (insert|update|delete)\s+to anon/i);
    expect(sql).not.toMatch(/allow read, write: if true/i);
    expect(sql).not.toMatch(/security definer/i);
  });
  test('requires server-controlled role for writes and draft-before-publish', () => {
    expect(sql).toContain("auth.jwt()) -> 'app_metadata'");
    expect(sql).toContain('nb_product_drafts_editor_insert');
    expect(sql).toContain('nb_products_publisher_update');
    expect(sql).toContain("public.nb_can_publish()");
    expect(sql).toContain('returns integer language plpgsql security invoker');
    expect(sql).toContain('public.nb_publish_product');
  });
  test('requires controlled publishing transactions for revision history', () => {
    expect(sql).toContain('create trigger nb_product_revision_guard before insert');
    expect(sql).toContain("public.nb_require_publish_scope('product')");
    expect(sql).toContain('create trigger nb_home_revision_guard before insert');
    expect(sql).toContain("public.nb_require_publish_scope('home')");
    expect(sql).not.toMatch(/grant delete on public\.nb_products/i);
    expect(sql).not.toMatch(/grant delete on public\.nb_media/i);
  });
  test('prohibits public pending media and exposes approved delivery separately', () => {
    expect(phase2).toContain("update storage.buckets set public = false where id = 'nb-media'");
    expect(phase2).toContain("'nb-media-staging','nb-media-staging',false");
    expect(phase2).toContain("'nb-media-public','nb-media-public',true");
    expect(phase2).toContain('revoke update on public.nb_media from authenticated');
    expect(phase2).toContain('grant update (alt_text) on public.nb_media to authenticated');
    expect(phase2).not.toMatch(/nb_public_media_staff_insert/);
  });
  test('publishing associations are gated by the publish transaction', () => {
    expect(phase2).toContain('alter table public.nb_product_media enable row level security');
    expect(phase2).toContain('alter table public.nb_product_categories enable row level security');
    expect(phase2).toContain('create trigger nb_product_media_guard');
    expect(phase2).toContain('create trigger nb_product_associations_sync');
  });
  test('scopes storage uploads to authenticated user and dedicated bucket', () => {
    expect(sql).toContain("bucket_id = 'nb-media'");
    expect(sql).toContain("(storage.foldername(name))[1] = (select auth.uid())::text");
  });
  test('consolidates equivalent CMS RLS policies without broadening access', () => {
    expect(policyRemediation).toContain('DROP POLICY IF EXISTS nb_media_editor_update_pending');
    expect(policyRemediation).toContain('DROP POLICY IF EXISTS nb_media_publisher_update');
    expect(policyRemediation).toContain('DROP POLICY IF EXISTS nb_media_staff_update');
    expect(policyRemediation).toContain('CREATE POLICY nb_media_staff_update');
    expect(policyRemediation).toContain('(SELECT public.nb_can_publish())');
    expect(policyRemediation).toContain('NOT approved');
    expect(policyRemediation).toContain('uploaded_by=(SELECT auth.uid())');
    expect(policyRemediation).toContain("split_part(storage_path,'/',1)");
    expect(policyRemediation).toContain('DROP POLICY IF EXISTS nb_reviews_public_read');
    expect(policyRemediation).toContain('DROP POLICY IF EXISTS nb_reviews_staff_read');
    expect(policyRemediation).toContain('DROP POLICY IF EXISTS nb_reviews_authenticated_read');
    expect(policyRemediation).toContain('CREATE POLICY nb_reviews_public_read');
    expect(policyRemediation).toContain('FOR SELECT TO anon');
    expect(policyRemediation).toContain('CREATE POLICY nb_reviews_authenticated_read');
    expect(policyRemediation).toContain('FOR SELECT TO authenticated');
    expect(policyRemediation).toContain("status='approved'");
    expect(policyRemediation).toContain('(SELECT public.nb_can_edit())');
    const anonReadPolicy = policyRemediation.split('CREATE POLICY nb_reviews_public_read')[1]?.split(';')[0] || '';
    expect(anonReadPolicy).not.toContain('nb_can_edit');
  });
});
