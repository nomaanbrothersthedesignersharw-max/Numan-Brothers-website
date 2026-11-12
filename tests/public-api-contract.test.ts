import { describe, expect, test } from 'bun:test';
import { COLLECTION_ROUTES } from '../src/storefront/navigation';
import { PUBLIC_COLLECTION_PATHS } from '../api/collectionPaths.mjs';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

describe('Cached public catalogue endpoints', () => {
  test('server route manifest stays aligned with the storefront taxonomy', () => {
    expect(PUBLIC_COLLECTION_PATHS).toEqual(COLLECTION_ROUTES.map((route) => route.path));
  });
  test('homepage data uses a short shared CDN cache and only published products', () => {
    const source = read('api/storefront.ts');
    expect(source).toContain('s-maxage=60');
    expect(source).toContain('stale-while-revalidate=300');
    expect(source).toContain('status=eq.published');
    expect(source).not.toContain('service_role');
    expect(source).not.toContain('nb_product_drafts');
  });

  test('catalogue pages are bounded and detect another page without exact COUNT(*)', () => {
    const source = read('api/catalogue.ts');
    expect(source).toContain('PAGE_SIZE + 1');
    expect(source).toContain('hasMore: rows.length > PAGE_SIZE');
    expect(source).toContain("'status', 'eq.published'");
    expect(source).not.toContain('count=exact');
    expect(source).toContain('s-maxage=45');
  });

  test('local browser fixture mocks the same-origin public data API contract', () => {
    const source = read('scripts/qa-browser-smoke.mjs');
    expect(source).toContain("page.route('**/api/storefront'");
    expect(source).toContain("page.route('**/api/catalogue**'");
    expect(source).toContain('homepage,categories:[]');
    expect(source).toContain('hasMore:false');
    expect(source).toContain('configuredSocial');
  });

  test('private commissioning checks stay non-cacheable', () => {
    const source = read('api/cms-status.ts');
    expect(source).toContain("'Cache-Control':'no-store, max-age=0'");
  });
});
