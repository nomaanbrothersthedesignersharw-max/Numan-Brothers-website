import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

describe('Phase 1 security, moderation & CI hardening contracts', () => {
  test('restores strict staff moderation on customer reviews without revoking product_id/photo_urls SELECT', () => {
    const sql = readFileSync('supabase/migrations/20261125000000_restore_review_moderation.sql', 'utf8');
    expect(sql).toContain("alter table public.nb_reviews alter column status set default 'pending'");
    expect(sql).toContain("with check (status = 'pending' and source = 'website' and approved_at is null)");
    expect(sql).toContain('revoke insert on public.nb_reviews from anon, authenticated');
    expect(sql).toContain('grant insert (display_name, rating, comment, product_id, photo_urls)');
    expect(sql).toContain('grant select on public.nb_reviews to anon, authenticated');
  });

  test('privileged delete RPCs strictly enforce nb_can_publish and search_path isolation', () => {
    const delProd = readFileSync('supabase/migrations/20261124010000_delete_product_rpc.sql', 'utf8');
    const delMedia = readFileSync('supabase/migrations/20261124040000_permanent_media_delete_rpc.sql', 'utf8');
    for (const sql of [delProd, delMedia]) {
      expect(sql).toContain('public.nb_can_publish()');
      expect(sql).toContain("set search_path = ''");
      expect(sql).toMatch(/revoke all on function .* from public, anon/i);
    }
  });

  test('Playwright smoke script matches current product page CTA and share button', () => {
    const smoke = readFileSync('scripts/qa-browser-smoke.mjs', 'utf8');
    expect(smoke).toContain('(?:Enquire|Inquire) about this design');
    expect(smoke).toContain('Share this design');
  });
});
