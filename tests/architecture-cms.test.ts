import React from 'react';
import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import V2Collection from '../src/components/V2Collection';
import { getCollection } from '../src/storefront/navigation';

const productStudio = readFileSync(new URL('../src/components/studio/CmsProducts.tsx',import.meta.url),'utf8');
const homepageStudio = readFileSync(new URL('../src/components/studio/CmsHomepage.tsx',import.meta.url),'utf8');
const app = readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const main = readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const studio = readFileSync(new URL('../src/components/CmsStudio.tsx',import.meta.url),'utf8');
const sql = readFileSync(new URL('../supabase/migrations/20261107223000_category_media_publish_guard.sql',import.meta.url),'utf8');

describe('Catalogue-only release architecture and CMS readiness',()=>{
  test('mounts Vercel Analytics exactly once for the whole SPA',()=>{
    expect(app).not.toContain('Analytics');
    expect(main.match(/<Analytics\s*\/>/g) || []).toHaveLength(1);
  });
  test('does not accidentally expose old checkout and client-side payment in the new storefront',()=>{
    expect(existsSync(new URL('../src/components/CartDrawer.tsx',import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/components/AdminPortal.tsx',import.meta.url))).toBe(false);
    expect(app).not.toContain('CartDrawer');
    expect(app).not.toContain('onPlaceOrder');
    expect(app).toContain('<CmsStudio/>');
  });
  test('keeps visited Studio editors mounted when switching between tabs',()=>{
    expect(studio).toContain('visitedSections');
    expect(studio).toContain("visitedSections.has('products')");
    expect(studio).toContain("visitedSections.has('media')");
    expect(studio).toContain("hidden={section!=='products'}");
    expect(studio).toContain("hidden={section!=='media'}");
    expect(studio).toContain('switchSection(item.id)');
  });
  test('creates an immediately persisted draft and debounces every field edit',()=>{
    expect(productStudio).toContain('const persistDraft=useCallback');
    expect(productStudio).toContain("setTimeout(()=>{void persistDraft(productId,snapshot);},650)");
    expect(productStudio).toContain("client.from('nb_product_drafts').upsert");
    expect(productStudio).toContain("setId(productId)");
    expect(productStudio).toContain("void persistDraft(productId,fresh)");
    expect(productStudio).toContain("const flushed=await persistDraft(currentId,latestFormRef.current)");
    expect(productStudio).toContain('Auto-save failed');
    expect(productStudio).toContain('Draft saved automatically');
  });
  test('product editor flushes the current draft before leaving or starting another product',()=>{
    expect(productStudio).toContain('const backToList=async()=>');
    expect(productStudio).toContain('const create=async()=>');
    expect(productStudio).toContain('await persistDraft(currentId,latestFormRef.current)');
    expect(productStudio).toContain('onClick={()=>void backToList()}');
  });
  test('does not reject old approved images when the 300-asset preview cache is incomplete',()=>{
    expect(productStudio).not.toContain('approvedImages.some(');
    expect(productStudio).toContain("client.rpc('nb_publish_product'");
    expect(productStudio).toContain('AssetEditor client={client}');
  });
  test('renders a read-only history of product and homepage version numbers',()=>{
    expect(productStudio).toContain("from('nb_product_revisions')");
    expect(homepageStudio).toContain("from('nb_home_revisions')");
    expect(productStudio).toContain('Published history');
    expect(homepageStudio).toContain('Published homepage versions');
  });
  test('collection artwork is published to its actual page and overlaid for readability',()=>{
    const route=getCollection('/men/sherwani');
    expect(route).toBeDefined();
    const html=renderToStaticMarkup(React.createElement(V2Collection,{
      route:route!,products:[],onNavigate:()=>{},
      bannerImage:'https://assets.example.com/approved.webp',
    }));
    expect(html).toContain('https://assets.example.com/approved.webp');
    expect(html).toContain('blur-[36px]');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('Sherwani');
    expect(app).toContain('categoryOverride?.image_url');
  });
  test('database enforces approved category images even for direct authorized data API writes',()=>{
    expect(sql).toContain('nb_require_approved_category_image');
    expect(sql).toContain('m.approved');
    expect(sql).toContain("m.mime_type like 'image/%'");
    expect(sql).toContain('nb_category_image_approval_guard');
  });
});
