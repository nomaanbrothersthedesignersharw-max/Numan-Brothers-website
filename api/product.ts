import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalOrigin, renderNotFoundHtml, renderProductHtml } from './_seo.mjs';

let cachedTemplate:string|null=null;
function template():string {
  if(cachedTemplate)return cachedTemplate;
  // Bundled by Vercel functions.includeFiles; preserve original empty-root build shell,
  // which points to unhashed development JavaScript assets.
  cachedTemplate=readFileSync(resolve(process.cwd(),'dist/_shell.html'),'utf8');
  return cachedTemplate;
}
export default {
  async fetch(request:Request):Promise<Response>{
    if(request.method!=='GET')return new Response('Method not allowed',{status:405});
    const handle=new URL(request.url).searchParams.get('id')||'';
    // Read-only, explicitly marked demo route. Not a database row or sale item.
    if(handle==='sample-plain-sherwani'){
      try{
        const origin=canonicalOrigin(process.env.SITE_CANONICAL_URL||'')||new URL(request.url).origin;
        const html=renderProductHtml(template(),{
          id:'11111111-1111-4111-8111-111111111112',slug:'sample-plain-sherwani',
          sku:'NB-SHW-DEMO-001',title:'Sample Plain Sherwani — Demo Only',
          department:'men',status:'published',fabric:'Illustrative garment concept',
          description:'DEMO / NOT FOR SALE. Artwork is illustrative, not real showroom stock.',
          image_urls:[origin+'/editorial/sherwani.svg'],price:null,offer_price:null,
        },origin);
        return new Response(html.replace('</head>','<meta name="robots" content="noindex, nofollow"/>\n</head>'),{
          status:200,headers:{'Content-Type':'text/html; charset=utf-8',
            'X-Content-Type-Options':'nosniff','Cache-Control':'public, s-maxage=90'},
        });
      }catch{return new Response('Demo temporarily unavailable',{status:503});}
    }
    const isUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(handle);
    const isSku=/^NB-[A-Z]{2,3}-[0-9]{5}$/.test(handle);
    const headers={
      'Content-Type':'text/html; charset=utf-8',
      'X-Content-Type-Options':'nosniff',
      'Cache-Control':'public, s-maxage=90, stale-while-revalidate=600',
    };
    if(handle.length>120 || !(isUuid||isSku||/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)))
      return new Response('Invalid product',{status:404,headers});
    const api=process.env.VITE_SUPABASE_URL||'';
    const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'';
    if(!/^https:\/\/[a-z0-9-]+[.]supabase[.]co$/.test(api)||!key.startsWith('sb_publishable_'))
      return new Response('Public catalogue unavailable',{status:503,headers:{...headers,'Cache-Control':'no-store'}});
    let html:string;
    try{html=template()}
    catch{return new Response('Build template unavailable',{status:503,headers:{...headers,'Cache-Control':'no-store'}})}
    try{
      const url=new URL(api+'/rest/v1/nb_products');
      url.searchParams.set(isUuid?'id':isSku?'sku':'slug','eq.'+handle);
      url.searchParams.set('status','eq.published');
      url.searchParams.set('select','id,slug,sku,title,department,description,fabric,image_urls,price,offer_price,status');
      url.searchParams.set('limit','1');
      const response=await fetch(url,{headers:{apikey:key,Accept:'application/json'},
        signal:AbortSignal.timeout(10000),redirect:'error'});
      if(!response.ok)throw new Error('CMS data unavailable');
      const items=await response.json() as Record<string,unknown>[];
      if(!Array.isArray(items)||items.length===0)
        return new Response(renderNotFoundHtml(html),{status:404,headers:{...headers,'Cache-Control':'public, s-maxage=30'}});
      const body=renderProductHtml(html,items[0],canonicalOrigin(process.env.SITE_CANONICAL_URL||''));
      return new Response(body,{status:200,headers});
    }catch{
      return new Response('Catalogue temporarily unavailable',{status:503,headers:{...headers,'Cache-Control':'no-store'}});
    }
  },
};
