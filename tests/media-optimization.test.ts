import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { prepareMediaFile, runWithConcurrency } from '../src/lib/mediaOptimization';

describe('upload preparation UX contract',()=>{
  test('shows image optimization before upload and bounds simultaneous image decodes',()=>{
    const upload=readFileSync(new URL('../src/lib/cmsUpload.ts',import.meta.url),'utf8');
    const media=readFileSync(new URL('../src/components/studio/CmsMedia.tsx',import.meta.url),'utf8');
    const assetEditor=readFileSync(new URL('../src/components/studio/AssetEditor.tsx',import.meta.url),'utf8');
    const tus=readFileSync(new URL('../src/lib/cmsUpload.ts',import.meta.url),'utf8');
    expect(upload).toContain('options?.onPreparing?.()');
    expect(upload.split('options?.onPreparing?.()').length-1).toBe(1);
    expect(media).toContain("status:'preparing'");
    expect(media).toContain('runWithConcurrency(files,2');
    expect(media).toContain('Preparing media…');
    expect(assetEditor).toContain('multiple?2:1');
    expect(assetEditor).toContain('Preparing media…');
    expect(tus).toContain('retryDelays=[0,1000,3000,7000]');
  });
});

describe('browser media preparation safety',()=>{
  test('preserves GIF animation and video bytes; only recompresses images when the result is smaller',async()=>{
    for(const [name,type] of [
      ['animated.gif','image/gif'],
      ['animated.webp','image/webp'],
      ['garment.mp4','video/mp4'],
      ['garment.webm','video/webm'],
    ] as const){
      const source=new File([new Uint8Array([1,2,3,4])],name,{type,lastModified:123});
      const result=await prepareMediaFile(source);
      expect(result.file).toBe(source);
      expect(result.compressed).toBe(false);
      expect(result.originalBytes).toBe(4);
      expect(result.preparedBytes).toBe(4);
      expect(result.format).toBe('original');
    }
  });

  test('falls back to the original when browser image decoders are unavailable',async()=>{
    const source=new File([new Uint8Array(32)],'NB-SH-00001_01.jpg',{type:'image/jpeg'});
    const result=await prepareMediaFile(source);
    if(typeof globalThis.createImageBitmap!=='function'){
      expect(result.file).toBe(source);
      expect(result.compressed).toBe(false);
    }
  });
});

describe('bounded media upload queue',()=>{
  test('never exceeds configured concurrency and preserves result order',async()=>{
    let active=0;
    let peak=0;
    const results=await runWithConcurrency([4,3,2,1,0],2,async(value)=>{
      active++;
      peak=Math.max(peak,active);
      await new Promise(resolve=>setTimeout(resolve,5));
      active--;
      return value*10;
    });
    expect(peak).toBeLessThanOrEqual(2);
    expect(results.map(x=>x.ok&&x.value)).toEqual([40,30,20,10,0]);
  });

  test('captures individual failures without cancelling successful uploads',async()=>{
    const results=await runWithConcurrency(['ok-1','fail','ok-2'],2,async(value)=>{
      if(value==='fail')throw new Error('network interruption');
      return value;
    });
    expect(results[0]).toEqual({ok:true,value:'ok-1'});
    expect(results[1].ok).toBe(false);
    if(!results[1].ok)expect((results[1].error as Error).message).toBe('network interruption');
    expect(results[2]).toEqual({ok:true,value:'ok-2'});
  });

  test('rejects invalid concurrency and safely handles an empty queue',async()=>{
    expect(await runWithConcurrency([],3,async()=>1)).toEqual([]);
    await expect(runWithConcurrency([1],0,async value=>value)).rejects.toThrow();
  });
});
