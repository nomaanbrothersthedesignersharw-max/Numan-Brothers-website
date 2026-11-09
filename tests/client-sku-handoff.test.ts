import {describe,test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
const source=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

describe('client-owned CMS handoff',()=>{
  test('maintains separate Sherwani and Suits subcategories, never Plain Suits under Sherwani',()=>{
    const navigation=source('src/storefront/navigation.ts');
    expect(navigation).toContain("{ label: 'Plain Sherwani', path: '/men/sherwani/plain' }");
    expect(navigation).toContain("{ label: 'Plain Suits', path: '/men/suits/plain' }");
    const migration=source('supabase/migrations/20261109194500_client_sku_handoff.sql');
    expect(migration).toContain("where path='/men/sherwani/plain'");
    expect(migration).toContain("set label='Plain Sherwani'");
  });
  test('requires permanent SKU identity and server-side role-based batch reservation',()=>{
    const sql=source('supabase/migrations/20261109194500_client_sku_handoff.sql');
    expect(sql).toContain('nb_keep_published_sku');
    expect(sql).toContain('old.sku is distinct from new.sku');
    expect(sql).toContain('security invoker');
    expect(sql).toContain('public.nb_can_edit()');
    expect(sql).toContain('p_count > 100');
    const ui=source('src/components/studio/CmsProducts.tsx');
    expect(ui).toContain('aria-label="Permanent auto-generated SKU"');
    expect(ui).toContain('readOnly');
    expect(ui).toContain('Update published product');
    expect(ui).toContain('Edit published product');
    expect(ui).toContain('item.sku');
    expect(ui).not.toContain('setSkuEdited');
  });
  test('allows read-only SKU product lookup and safe photo batch tagging',()=>{
    const publicRoute=source('src/lib/catalogQueries.ts');
    const seoRoute=source('api/product.ts');
    expect(publicRoute).toContain("isSku(handle)?'sku':'slug'");
    expect(seoRoute).toContain("isSku?'sku':'slug'");
    const importer=source('src/lib/importEngine.ts');
    expect(importer).toContain("client.rpc('nb_reserve_skus'");
    expect(importer).toContain("status:'pending'");
    expect(importer).toContain('categoryPath:options?.categoryPath');
    const ui=source('src/components/studio/CmsImports.tsx');
    expect(ui).toContain('prepareSkuPhotoBatch');
    expect(ui).toContain('photoDepartment');
    expect(ui).toContain('photoCategory');
    expect(ui).toContain('Download product SKUs for photo labels');
  });
  test('keeps admin bootstrap strictly separate from customer passwords and live installer',()=>{
    const install=source('supabase/sql-editor/NOMAN_BROTHERS_INSTALL_FRESH_PROJECT.sql');
    const owner=source('supabase/sql-editor/NOMAN_BROTHERS_ASSIGN_OWNER_AFTER_AUTH.sql');
    expect(install).toContain('20261109194500_client_sku_handoff.sql');
    expect(owner).toContain('raw_app_meta_data');
    expect(owner).toContain("nb_role");
    expect(owner).toContain('email_confirmed_at');
    expect(owner).not.toContain('INSERT INTO auth.users');
    expect(owner).not.toContain('encrypted_password');
  });
});
