import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { rowToProduct } from '../src/lib/cmsData';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('multi-video product gallery contract',()=>{
  test('maps an ordered video array and preserves the legacy primary video',()=>{
    const product=rowToProduct({
      id:'p1',sku:'NB-SH-00001',slug:'sample-garment',title:'Sample Garment',
      department:'men',category_paths:['/men/sherwani'],description:'',fabric:'',
      sizes:[],image_urls:['https://cdn.example/cover.webp'],
      video_url:'https://cdn.example/first.mp4',
      video_urls:['https://cdn.example/first.mp4','https://cdn.example/second.mp4'],
      price:null,offer_price:null,customizable:false,status:'published',sort_rank:0,
      created_at:'',updated_at:'',
    });
    expect(product.videoUrl).toBe('https://cdn.example/first.mp4');
    expect(product.videoUrls).toEqual([
      'https://cdn.example/first.mp4','https://cdn.example/second.mp4',
    ]);
  });

  test('publish RPC allows at most 200 HTTPS video refs and validates Supabase assets as video media',()=>{
    const sql=source('supabase/migrations/20261109220000_multi_video_gallery.sql');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS video_urls text[]');
    expect(sql).toContain('cardinality(video_urls) <= 200');
    expect(sql).toContain('cardinality(product_videos) > 200');
    expect(sql).toContain("mime_type like 'video/%'");
    expect(sql).toContain('video_urls = excluded.video_urls');
    expect(sql).toContain('offer_price = excluded.offer_price');
    expect(sql).toContain('customizable = excluded.customizable');
    expect(sql).toContain("product_offer := nullif(draft->>'offerPrice','')::numeric");
    expect(sql).toContain('public.nb_media_public_url(m.storage_path)');
    expect(sql).toContain("draft->'videoUrls'");
  });

  test('indexes published and draft video references for fast lifecycle checks',()=>{
    const sql=source('supabase/migrations/20261109233000_video_gallery_lookup_indexes.sql');
    expect(sql).toContain('nb_products_video_urls_gin_idx');
    expect(sql).toContain('USING gin (video_urls)');
    expect(sql).toContain('nb_product_drafts_content_gin_idx');
    expect(sql).toContain('jsonb_path_ops');
  });

  test('video gallery player mounts one selected video and keeps metadata bounded',()=>{
    const view=source('src/components/V2Product.tsx');
    expect(view).toContain('productVideos.length');
    expect(view).toContain('preload="none"');
    expect(view).toContain('visibleVideoIndexes');
    expect(view).toContain('key={videoUrl}');
    expect(view).not.toMatch(/productVideos\.map\([^\n]*<video/);
  });

  test('studio exposes a multi-file video picker and validates the gallery cap',()=>{
    const editor=source('src/components/studio/CmsProducts.tsx');
    expect(editor).toContain('videoUrls:string[]');
    expect(editor).toContain('multiple allowVideo');
    expect(editor).toContain('form.videoUrls.length>200');
  });
});
