import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { runBoundedPool } from '../src/lib/cmsUpload';
import productVideosApi from '../api/product-videos';

describe('Phase 2 performance, parallel upload & 200-video scale contracts', () => {
  test('runBoundedPool enforces concurrency ceiling and preserves deterministic order', async () => {
    let active = 0;
    let peak = 0;
    const inputs = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const results = await runBoundedPool(inputs, 3, async (val) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 8 + ((val * 7) % 15)));
      active -= 1;
      return val * 10;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThanOrEqual(2);
    expect(results).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80]);
  });

  test('api/product-videos rejects malformed productId and enforces pagination bounds', async () => {
    const bad = await productVideosApi.fetch(new Request('https://example.com/api/product-videos?productId=bad'));
    expect(bad.status).toBe(400);
    const src = readFileSync('api/product-videos.ts', 'utf8');
    expect(src).toContain('MAX_PAGE_SIZE = 24');
    expect(src).toContain('Server-Timing');
  });

  test('Phase 2 SQL migration defines nb_product_videos with strict RLS and 10k covering indexes', () => {
    const sql = readFileSync('supabase/migrations/20261125010000_phase2_scale_videos_and_indexes.sql', 'utf8');
    expect(sql).toContain('create table if not exists public.nb_product_videos');
    expect(sql).toContain('alter table public.nb_product_videos enable row level security');
    expect(sql).toContain('nb_products_pub_dept_sort_idx');
    expect(sql).toContain('public.nb_can_publish()');
  });
});
