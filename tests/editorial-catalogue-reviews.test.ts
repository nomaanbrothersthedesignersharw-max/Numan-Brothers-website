import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {cleanHome,HOME_TEMPLATE,SOCIAL_KEYS,POLICY_KEYS} from '../src/lib/cmsData';
import {absoluteStoreUrl,whatsappShareUrl} from '../src/lib/catalogShare';
import {SAMPLE_SHERWANI} from '../src/storefront/sampleProduct';
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('editorial CMS and customer-trust changes',()=>{
 test('old homes and untrusted social/policy payloads are normalized',()=>{
   expect(cleanHome(null)).toEqual(HOME_TEMPLATE);
   expect(SOCIAL_KEYS).toContain('linkedin');
   expect(POLICY_KEYS).toEqual(['privacy','terms','returns']);
   const clean=cleanHome({
     socialLinks:{instagram:'javascript:alert(1)',youtube:'https://youtube.com/@example'},
     legalPolicies:{privacy:'Owner copy',terms:5,returns:'r'.repeat(7000)},
     featuredImages:{one:'javascript:bad',two:'https://example.com/approved.webp'},
   });
   expect(clean.socialLinks.instagram).toBe('');
   expect(clean.socialLinks.youtube).toBe('https://youtube.com/@example');
   expect(clean.legalPolicies.privacy).toBe('Owner copy');
   expect(clean.legalPolicies.terms).toBe('');
   expect(clean.legalPolicies.returns.length).toBe(6000);
   expect(clean.featuredImages.one).toBe('');
   expect(clean.featuredImages.two).toBe('https://example.com/approved.webp');
 });
 test('WhatsApp shares canonical catalogue links and approved HTTPS photos without data leaks',()=>{
   const origin='https://numan-brothers-website.vercel.app';
   const link=whatsappShareUrl('Plain Sherwani','/men/sherwani/plain',origin);
   expect(decodeURIComponent(link)).toContain(origin+'/men/sherwani/plain');
   expect(absoluteStoreUrl('/kids',origin)).toBe(origin+'/kids');
   expect(()=>absoluteStoreUrl('//evil.com',origin)).toThrow();
   expect(()=>absoluteStoreUrl('/studio',origin)).toThrow();
   const photos=['https://images.example.com/p1.webp','https://images.example.com/p2.webp','javascript:bad'];
   const share=decodeURIComponent(whatsappShareUrl('Garment','/products/garment-12',origin,photos));
   expect(share).toContain('https://images.example.com/p1.webp');
   expect(share).not.toContain('javascript:');
 });
 test('only one publicly visible demo is offered; no invented prices or inventory seeded',()=>{
   expect(SAMPLE_SHERWANI.slug).toBe('sample-plain-sherwani');
   expect(SAMPLE_SHERWANI.collectionPaths).toEqual(['/men/sherwani/plain']);
   expect(SAMPLE_SHERWANI.title).toContain('Demo Only');
   expect(SAMPLE_SHERWANI.originalPrice).toBeUndefined();
   expect(SAMPLE_SHERWANI.description).toContain('NOT FOR SALE');
   expect(source('src/App.tsx')).toContain('<meta name="robots" content="noindex, nofollow"/>');
   expect(source('src/components/studio/CmsProducts.tsx')).not.toContain('Prepare editable sherwani draft');
   expect(source('src/components/studio/CmsProducts.tsx')).toContain('Update published product');
 });
 test('reviews stay pending and require an administrator to publish',()=>{
   const sql=source('supabase/migrations/20261109113800_site_reviews.sql');
   expect(sql).toContain("status text not null default 'pending'");
   expect(sql).toContain("with check (status='pending' and source='website' and approved_at is null)");
   expect(sql).toContain('public.nb_can_publish()');
   expect(sql).not.toMatch(/security definer/i);
   const review=source('src/components/V2Reviews.tsx');
   expect(review).toContain(".eq('status','approved')");
   expect(review).toContain('Submitted for moderation');
   expect(review).not.toContain('dangerouslySetInnerHTML');
 });
 test('featured images reject unapproved media and block referenced asset deletion',()=>{
   const sql=source('supabase/migrations/20261109120000_featured_media_guard.sql');
   expect(sql).toContain('nb_require_approved_home_featured');
   expect(sql).toContain('m.approved and m.archived_at is null');
   expect(sql).toContain('nb_guard_featured_media_delete');
 });
});
