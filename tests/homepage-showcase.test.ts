import { describe, expect, it } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import V2HomeShowcase from '../src/components/V2HomeShowcase';
import { HOME_TEMPLATE } from '../src/lib/cmsData';
import type { CatalogProduct } from '../src/storefront/catalog';

const SAMPLE_PRODUCTS: CatalogProduct[] = [
  {
    id: '03a2d78a-9305-48b3-8eca-3e31973ea260',
    sku: 'NB-SU-00003',
    slug: 'obsidian-crystal-handwork-suit',
    title: 'Obsidian Crystal & Champagne-Gold Handwork Suit',
    department: 'men',
    category: '/men/suits/handwork',
    categoryPaths: ['/men/suits/handwork'],
    description: 'Couture jet-black handwork suit.',
    images: [
      'https://example.supabase.co/storage/v1/object/public/nb-media-public/front.webp',
      'https://example.supabase.co/storage/v1/object/public/nb-media-public/right.webp',
    ],
    originalPrice: 8499,
    offerPrice: 7499,
    customizable: true,
    sizes: ['38', '40', '42'],
  },
  {
    id: 'f3f7baad-d51d-4bc5-b176-54c234276752',
    sku: 'NB-PA-00001',
    slug: 'deep-peacock-teal-pathani-blazer',
    title: 'Deep Peacock Teal Double-Breasted Blazer & Pathani Salwar Ensemble',
    department: 'men',
    category: '/men/pathani',
    categoryPaths: ['/men/pathani'],
    description: 'Contemporary Pathani fusion ensemble.',
    images: [
      'https://example.supabase.co/storage/v1/object/public/nb-media-public/teal-front.webp',
    ],
    originalPrice: 6999,
    offerPrice: 5999,
    customizable: true,
    sizes: ['38', '40'],
  },
];

describe('V2HomeShowcase — Luxury Storefront Category Strip & Live Arrivals', () => {
  it('renders signature category tiles and live published products with INR pricing and second-angle hover image', () => {
    const html = renderToStaticMarkup(
      React.createElement(V2HomeShowcase, {
        products: SAMPLE_PRODUCTS,
        home: HOME_TEMPLATE,
        categories: [],
        onNavigate: () => {},
      }),
    );

    expect(html).toContain('Signature Silhouettes');
    expect(html).toContain('Latest from the Atelier');
    expect(html).toContain('Obsidian Crystal &amp; Champagne-Gold Handwork Suit');
    expect(html).toContain('Deep Peacock Teal Double-Breasted Blazer &amp; Pathani Salwar Ensemble');
    expect(html).toContain('Customizable');
    expect(html).toContain('NB-SU-00003');
    expect(html).toContain('right.webp');
    expect(html).toContain('role="tablist"');
  });
});
