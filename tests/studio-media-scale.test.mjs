import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('staff sign-in remains secure while technical diagnostics are hidden',()=>{
  const s=source('src/components/CmsStudio.tsx');
  assert.match(s,/signInWithPassword/);
  assert.match(s,/cmsRole\(user\?\.app_metadata\?\.nb_role\)/);
  assert.doesNotMatch(s,/Connection checks|serviceStatus|setServiceStatus/);
  assert.match(s,/Need access\? Contact the store administrator/);
});
test('six Studio pages are grouped, including dedicated bulk imports',()=>{
  const s=source('src/components/CmsStudio.tsx');
  for(const id of ['dashboard','products','collections','media','imports','homepage'])
    assert.match(s,new RegExp("id:'"+id+"'"));
  assert.match(s,/studioGroups\.map/);
  assert.match(s,/visitedSections\.has\('imports'\)/);
  assert.match(s,/hidden=\{section!=='imports'\}/);
  assert.doesNotMatch(s,/\.limit\(300\)|loadMedia\(\)/);
});
test('media library filters by MIME and paginates on the server',()=>{
  const s=source('src/components/studio/CmsMedia.tsx');
  assert.match(s,/request=request\.like\('mime_type',typeFilter\+'\/%'\)/);
  assert.match(s,/\.range\(page\*30,page\*30\+29\)/);
  assert.match(s,/seq!==requestSequence\.current/);
  assert.doesNotMatch(s,/showBulk|<CmsImports/);
});
test('media asset chooser only queries after opening',()=>{
  const s=source('src/components/studio/AssetEditor.tsx');
  assert.match(s,/if\(!showLibrary\)\{setLoading\(false\);return;\}/);
  assert.match(s,/reload,showLibrary\]/);
  assert.match(s,/\.range\(page\*24,page\*24\+23\)/);
});
test('upload validation and private TUS chunking remain unchanged',()=>{
  const s=source('src/lib/cmsUpload.ts');
  assert.match(s,/MAX_MEDIA_SIZE = 50 \* 1024 \* 1024/);
  assert.match(s,/TUS_CHUNK_SIZE = 6 \* 1024 \* 1024/);
  assert.match(s,/nb-media-staging/);
  assert.match(s,/resumableUpload\(client,path,uploadFile,onProgress\)/);
});

test('admin studio does not fetch public catalogue data in the background',()=>{
  const s=source('src/App.tsx');
  assert.match(s,/if\(isStudioPath\)return;/);
  assert.match(s,/\}, \[isStudioPath\]\);/);
});
