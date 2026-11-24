import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderProductHtml } from '../api/_seo.mjs';

const ROOT = join(import.meta.dir, '..');
const SHELL = '<!doctype html><html><head><title>NB</title></head><body><div id="root"></div></body></html>';

describe('Phase 5: Website Quality, SEO & Accessibility', () => {
  it('emits enriched Product JSON-LD with InStock, NewCondition, AggregateRating and BreadcrumbList', () => {
    const html = renderProductHtml(
      SHELL,
      {
        id: '03a2d78a-9305-48b3-8eca-3e31973ea260',
        slug: 'obsidian-crystal-handwork-suit',
        sku: 'NB-SU-00003',
        title: 'Obsidian Crystal Handwork Suit',
        department: 'men',
        description: 'Tailored jet-black couture suit with champagne-gold crystal handwork.',
        image_urls: ['https://example.supabase.co/storage/v1/object/public/nb-media-public/suit.webp'],
        price: 8499,
        offer_price: 7499,
        rating_value: 4.9,
        review_count: 14,
      },
      'https://nomaanbrothers.com',
    );

    expect(html).toContain('"availability":"https://schema.org/InStock"');
    expect(html).toContain('"itemCondition":"https://schema.org/NewCondition"');
    expect(html).toContain('"@type":"AggregateRating"');
    expect(html).toContain('"ratingValue":4.9');
    expect(html).toContain('"reviewCount":14');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('https://nomaanbrothers.com/men');
  });

  it('publishes ClothingStore LocalBusiness structured data for Warangal showroom in App.tsx', () => {
    const app = readFileSync(join(ROOT, 'src', 'App.tsx'), 'utf8');
    expect(app).toContain("'@type': 'ClothingStore'");
    expect(app).toContain("addressLocality: 'Warangal'");
    expect(app).toContain("streetAddress: 'Mandi Bazar'");
  });

  it('supports Escape & Arrow keyboard navigation in product zoom and review lightboxes', () => {
    const prod = readFileSync(join(ROOT, 'src', 'components', 'V2Product.tsx'), 'utf8');
    const rev = readFileSync(join(ROOT, 'src', 'components', 'V2Reviews.tsx'), 'utf8');
    expect(prod).toContain("e.key === 'Escape'");
    expect(prod).toContain("e.key === 'ArrowRight'");
    expect(prod).toContain('aria-modal="true"');
    expect(rev).toContain("e.key === 'Escape'");
    expect(rev).toContain('aria-modal="true"');
  });

  it('includes the owner launch readiness checklist', () => {
    const doc = readFileSync(join(ROOT, 'docs', 'LAUNCH_READINESS_CHECKLIST.md'), 'utf8');
    expect(doc).toContain('Leaked Password Protection');
    expect(doc).toContain('iPhone Safari');
    expect(doc).toContain('Android Chrome');
  });
});
