import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const migrationNames = [
  '20261107060000_nomaan_cms.sql',
  '20261107130000_catalogue_private_media.sql',
  '20261107150000_studio_product_index.sql',
  '20261107170000_bulk_import_jobs.sql',
  '20261107172000_match_approved_media.sql',
  '20261107195000_studio_index_role_gate.sql',
  '20261107199000_import_owner_idempotency.sql',
  '20261107210000_catalogue_integrity_audit.sql',
  '20261107223000_category_media_publish_guard.sql',
  '20261107234500_cms_archive_and_discard.sql',
  '20261107235900_catalogue_media_merchandising.sql',
  '20261108001500_home_media_security.sql',
  '20261109113800_site_reviews.sql',
  '20261109120000_featured_media_guard.sql',
  '20261109190000_media_lifecycle_scale_indexes.sql',
  '20261109194500_client_sku_handoff.sql',
  '20261109210000_sku_counter_least_privilege.sql',
  '20261109213000_consolidate_cms_rls_policies.sql',
  '20261109220000_multi_video_gallery.sql',
  '20261109230000_move_pg_trgm_extension.sql',
];
const bundle = readFileSync('supabase/sql-editor/NOMAN_BROTHERS_INSTALL_FRESH_PROJECT.sql','utf8');

test('all twenty migrations are included byte-for-byte in source order with only transaction wrappers removed',()=>{
  const positions=[];
  for(let index=0;index<migrationNames.length;index++){
    const source=readFileSync('supabase/migrations/'+migrationNames[index],'utf8');
    assert.equal((source.match(/^begin;\s*$/gmi)||[]).length,1);
    assert.equal((source.match(/^commit;\s*$/gmi)||[]).length,1);
    const sql=source.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'').trim();
    const pos=bundle.indexOf(sql);
    assert.ok(pos!==-1,'Missing/unmodified source migration: '+migrationNames[index]);
    positions.push(pos);
  }
  assert.deepEqual(positions,[...positions].sort((a,b)=>a-b),'Migration order changed');
});
test('one transactional install with fresh-project refusal and postflight RLS audit',()=>{
  assert.equal((bundle.match(/^BEGIN;$/gm)||[]).length,1);
  assert.equal((bundle.match(/^COMMIT;$/gm)||[]).length,1);
  assert.match(bundle,/nb_fresh_project_only/);
  assert.match(bundle,/nb_install_assert/);
  assert.match(bundle,/has_schema_privilege/);
  assert.match(bundle,/nb-media-staging/);
  assert.doesNotMatch(bundle,/^\\(?:set|echo|i)\s/gm);
  assert.doesNotMatch(bundle,/zazdxmukmcayblsteulk/);
  assert.match(bundle,/client-owned Supabase project/);
});

test('existing-project SQL completion includes latest security, video gallery and extension migrations',()=>{
  const complete = readFileSync('supabase/sql-editor/NOMAN_BROTHERS_COMPLETE_EXISTING_TABLES.sql','utf8');
  for (const name of migrationNames.slice(-4)) {
    const source = readFileSync('supabase/migrations/'+name,'utf8');
    const sql = source.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'').trim();
    assert.ok(complete.includes(sql),'Existing-project completion omits '+name);
  }
});
