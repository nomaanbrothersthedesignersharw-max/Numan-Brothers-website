import { describe, expect, test } from 'bun:test';
import { PUBLIC_PAGE_SIZE, collectionFilterPaths, safeCatalogueSearch, isValidProductHandle } from '../src/lib/catalogQueries';
import {productPath} from '../src/storefront/catalog';

describe('Scalable public catalogue query contract', () => {
  test('pages are bounded to 24 products', () => {
    expect(PUBLIC_PAGE_SIZE).toBe(24);
  });
  test('all sherwani subcollections appear in a parent collection filter', () => {
    expect(collectionFilterPaths('/men/sherwani')).toContain('/men/sherwani/handwork');
    expect(collectionFilterPaths('/men/sherwani')).toContain('/men/sherwani/plain');
    expect(collectionFilterPaths('/men/sherwani')).not.toContain('/kids/sherwani');
  });
  test('removes PostgREST query grammar and limits search length', () => {
    expect(safeCatalogueSearch('silk %, (title.ilike.*), sherwani')).not.toContain('%');
    expect(safeCatalogueSearch('b'.repeat(200))).toHaveLength(72);
    expect(safeCatalogueSearch('  Ivory   Sherwani  ')).toBe('Ivory Sherwani');
  });
});

describe('Unique public product URLs',()=>{
  test('prefer published CMS slug but preserve UUID URLs',()=>{
    const id='11111111-1111-4111-8111-111111111111';
    expect(productPath({id,slug:'ivory-sherwani-nb-sh-00001'})).toBe('/products/ivory-sherwani-nb-sh-00001');
    expect(productPath({id})).toBe('/products/'+id);
    expect(productPath({id,slug:'bad/unsafe'})).toBe('/products/'+id);
  });
  test('rejects malformed handles while accepting UUID',()=>{
    expect(isValidProductHandle('ivory-sherwani-nb-sh-00001')).toBe(true);
    expect(isValidProductHandle('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isValidProductHandle('NB-SH-00001')).toBe(true);
    expect(isValidProductHandle('NB-SU-00002')).toBe(true);
    for(const bad of ['','%2F','../../../etc/passwd','Sneaky,or.eq','a'.repeat(121)])
      expect(isValidProductHandle(bad)).toBe(false);
  });
});
