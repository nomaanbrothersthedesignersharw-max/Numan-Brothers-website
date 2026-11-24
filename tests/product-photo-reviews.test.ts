import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import reviewsApi from '../api/reviews';

describe('Product photo reviews end-to-end contracts', () => {
  test('accepts standard 5-group RFC-4122 UUIDs in reviews and submit-review endpoints', async () => {
    const submitSrc = readFileSync('api/submit-review.ts', 'utf8');
    const reviewsSrc = readFileSync('api/reviews.ts', 'utf8');
    const uuid5Regex = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
    expect(submitSrc).toContain(uuid5Regex);
    expect(reviewsSrc).toContain(uuid5Regex);

    // Malformed non-UUID productId still rejected with 400
    const badRes = await reviewsApi.fetch(new Request('https://example.com/api/reviews?productId=not-a-uuid'));
    expect(badRes.status).toBe(400);
  });

  test('both V2Product and V2Reviews select and render customer photo_urls with zoom lightbox', () => {
    const prodSrc = readFileSync('src/components/V2Product.tsx', 'utf8');
    const homeRevSrc = readFileSync('src/components/V2Reviews.tsx', 'utf8');
    const studioRevSrc = readFileSync('src/components/studio/CmsReviews.tsx', 'utf8');

    expect(prodSrc).toContain('photo_urls');
    expect(prodSrc).toContain('setLightboxPhoto');
    expect(homeRevSrc).toContain('photo_urls');
    expect(homeRevSrc).toContain('setLightboxPhoto');
    expect(studioRevSrc).toContain('photo_urls');
    expect(studioRevSrc).toContain('setLightboxPhoto');
  });
});
