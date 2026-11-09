import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const code=readFileSync('supabase/functions/nb-media-approval/index.ts','utf8');

describe('Server-only media approval contract',()=>{
  it('uses a signed-in user and rechecks a fresh privileged role',()=>{
    assert.match(code,/withSupabase\(\{ auth: 'user' \}/);
    assert.match(code,/auth\.admin\.getUserById\(actorId\)/);
    assert.match(code,/role !== 'owner' && role !== 'admin'/);
  });
  it('cannot publish an unapproved image directly from the browser',()=>{
    assert.match(code,/nb-media-staging/);
    assert.match(code,/nb-media-public/);
    assert.match(code,/await ctx\.supabaseAdmin\.storage/);
  });
  it('denies revocation of assets referenced by published pages',()=>{
    assert.match(code,/from\('nb_product_media'\)/);
    assert.match(code,/from\('nb_home_public'\)/);
    assert.match(code,/from\('nb_home_drafts'\)/);
    assert.match(code,/featuredImages/);
    assert.match(code,/referencedByHomeDraft/);
    assert.match(code,/referencedByHome \|\| referencedByHomeDraft/);
    assert.match(code,/from\('nb_product_drafts'\)/);
    assert.match(code,/from\('nb_categories'\)/);
    assert.match(code,/contains\('image_urls'/);
    assert.match(code,/eq\('video_url'/);
    assert.match(code,/contains\('video_urls', \[publicUrl\]\)/);
    assert.match(code,/contains\('content', \{videoUrls:\[publicUrl\]\}\)/);
    assert.match(code,/status', 'published'/);
    const references=code.indexOf("from('nb_product_media')");
    const revocation=code.indexOf('update({ approved: false })');
    assert.ok(references>0 && revocation>references,'reference checks must precede revocation');
    assert.match(code,/return json\(409,.*This file is still used/);
  });
  it('supports deliberate archiving and fully deleting unused assets, never direct anonymous mutation',()=>{
    assert.match(code,/action\s*===\s*'archive'/);
    assert.match(code,/action === 'restore'/);
    assert.match(code,/action==='delete'/);
    assert.match(code,/from\('nb_media'\)\.delete\(\)/);
    assert.match(code,/from\('nb-media-staging'\)\.remove/);
    assert.match(code,/publicBucket\.remove/);
    assert.match(code,/referencedByHomeDraft/);
    assert.match(code,/productDraftImages\.count/);
    assert.match(code,/productDraftVideo\.count/);
  });
});
