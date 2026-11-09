import { describe, expect, test } from 'bun:test';
import { parseCsv, skuFromImageFilename, validateCatalogueCsv, downloadCsvErrors, assignImportedSku, prepareSkuPhotoBatch } from '../src/lib/bulkCsv';

describe('Catalogue onboarding CSV parser',()=>{
  test('accepts quoted commas, escaped quotes and CRLF',()=>{
    const rows=parseCsv('sku,title,department,category\r\nNB-01,"Ivory, \"\"Royal\"\" Sherwani",men,/men/sherwani\r\n');
    expect(rows[1][1]).toBe('Ivory, "Royal" Sherwani');
  });
  test('rejects incomplete quoted fields',()=>{
    expect(()=>parseCsv('sku,title\nNB-01,"Unclosed')).toThrow();
  });
  test('rejects unexpected characters after a closing quote but allows delimiter whitespace',()=>{
    expect(()=>parseCsv('sku,title\nNB-01,"Ivory"junk')).toThrow('Unexpected character after a closing CSV quote');
    expect(()=>parseCsv('sku,title\nNB-01,"Ivory"x,other')).toThrow('Unexpected character after a closing CSV quote');
    expect(parseCsv('sku,title\r\nNB-01,"Ivory" \t\r\n')).toEqual([
      ['sku','title'],['NB-01','Ivory'],
    ]);
  });
  test('strips a UTF-8 BOM and handles LF, CRLF and CR record endings',()=>{
    expect(parseCsv('\uFEFFa,b\n1,2\r\n3,4\r5,6')).toEqual([
      ['a','b'],['1','2'],['3','4'],['5','6'],
    ]);
  });
  test('normalizes SKU and validates correct department/category',()=>{
    const result=validateCatalogueCsv('sku,title,department,category,sizes\nnb-shw-01,Ivory Sherwani,men,/men/sherwani,38|40|42\n');
    expect(result[0].error).toBeNull();
    expect(result[0].sku).toBe('NB-SHW-01');
    expect(result[0].draft.sizes).toEqual(['38','40','42']);
    expect(result[0].draft.imageUrls).toEqual([]);
  });
  test('rejects duplicate SKU and category mismatch without importing',()=>{
    const data=validateCatalogueCsv('sku,title,department,category\nNB-01,Men Suit,men,/men/suits\nnb-01,Kids Suit,kids,/kids/suits\nNB-02,Bad category,kids,/men/suits\n');
    expect(data[0].error).toBeNull();
    expect(data[1].error).toContain('Duplicate SKU');
    expect(data[2].error).toContain('category');
  });
  test('requires headers and guards SQL/postgrest unsafe title data',()=>{
    expect(()=>validateCatalogueCsv('id,title\n1,Hi')).toThrow('Missing CSV column: department');
    const rows=validateCatalogueCsv('sku,title,department,category\nNB-01,=HYPERLINK,men,/men/suits\n');
    expect(rows[0].draft.title).toBe('=HYPERLINK');
    // CMS renders React text (not HTML) and does not interpolate SQL strings.
  });
  test('reserves database SKUs for CSV rows without manually assigned codes',()=>{
    const rows=validateCatalogueCsv('title,department,category\nIvory Sherwani,men,/men/sherwani/plain\nRoyal Suit,men,/men/suits/handwork\n');
    expect(rows.every(r=>r.error===null&&r.sku==='')).toBe(true);
    const assigned=assignImportedSku(rows[0],'NB-SH-00001');
    expect(assigned.draft.sku).toBe('NB-SH-00001');
    expect(assigned.draft.slug).toBe('ivory-sherwani-nb-sh-00001');
  });
  test('renames ordinary phone photographs for one product without changing image bytes',()=>{
    const files=[new File(['one'],'IMG_1001.jpg',{type:'image/jpeg'}),new File(['two'],'IMG_1002.png',{type:'image/png'})];
    const named=prepareSkuPhotoBatch(files,'nb-sh-00001');
    expect(named.map(f=>f.name)).toEqual(['NB-SH-00001_01.jpg','NB-SH-00001_02.png']);
    expect(named[0].type).toBe('image/jpeg');
    expect(prepareSkuPhotoBatch(files,'')).toEqual(files);
    expect(()=>prepareSkuPhotoBatch(files,'bad')).toThrow('generated SKU');
  });
  test('matches deterministic photo order and rejects unsafe extensions',()=>{
    expect(skuFromImageFilename('NB-SHW-001_02.webp')).toEqual({sku:'NB-SHW-001',order:2});
    expect(skuFromImageFilename('NB-SHW-001_00.webp')).toBeNull();
    expect(skuFromImageFilename('NB-SHW-001_02.svg')).toBeNull();
  });
  test('quotes failure reports',()=>{
    expect(downloadCsvErrors([{rowNumber:2,sku:'NB-01',message:'Invalid "price"'}]))
      .toContain('"Invalid ""price"""');
    expect(downloadCsvErrors([{rowNumber:3,sku:'NB-02',message:'=HYPERLINK(1)'}]))
      .toContain('"\'=HYPERLINK(1)"');
    for(const dangerous of ['\\t=HYPERLINK(1)','\\r+1+1','\\n@SUM(1,2)','\\u0000-1+1','\\uFEFF=1+1']){
      expect(downloadCsvErrors([{rowNumber:4,sku:'NB-03',message:dangerous}]))
        .toContain('"\\''+dangerous+'"');
    }
  });
});
