import type { CatalogProduct } from '../storefront/catalog';
import { COLLECTION_ROUTES } from '../storefront/navigation';
import { getCmsClient } from './supabaseClient';
import { rowToProduct, type CmsProductRow } from './cmsData';

const columns = 'id,sku,slug,title,department,category_paths,description,fabric,sizes,image_urls,video_url,price,offer_price,customizable,status,sort_rank,created_at,updated_at';
export const PUBLIC_PAGE_SIZE = 24;
export interface CataloguePage {
  products: CatalogProduct[];
  count: number;
  page: number;
  pageSize: number;
  error: string | null;
}
const empty = (page:number,error:string|null):CataloguePage =>
  ({products:[],count:0,page,pageSize:PUBLIC_PAGE_SIZE,error});

export function safeCatalogueSearch(value:string):string {
  // Prevent PostgREST filter-grammar injection and keep indexed LIKE queries bounded.
  return value.normalize('NFKC').replace(/[^a-zA-Z0-9 -]/g,' ').trim().replace(/\s+/g,' ').slice(0,72);
}
export function collectionFilterPaths(route:string):string[] {
  return COLLECTION_ROUTES.filter(c=>c.path===route || c.path.startsWith(route+'/'))
    .map(c=>c.path);
}
export type CatalogueSort = 'featured' | 'price_asc' | 'price_desc' | 'newest';

export async function loadCataloguePage(
  opts:{route?:string;query?:string;page?:number;customizable?:boolean;fabric?:string;sort?:CatalogueSort}
):Promise<CataloguePage> {
  const client=getCmsClient();
  const page=Math.max(0,Math.min(100000,Math.floor(opts.page||0)));
  if(!client)return empty(page,'CMS not configured');
  const q=safeCatalogueSearch(opts.query||'');
  if(opts.query && !q)return empty(page,null);
  const fabricFilter=safeCatalogueSearch(opts.fabric||'');
  const categories=opts.route && opts.route!=='/men' && opts.route!=='/kids' ? collectionFilterPaths(opts.route) : [];
  if(opts.route && opts.route!=='/men' && opts.route!=='/kids' && !categories.length)return empty(page,null);

  if (typeof window !== 'undefined') {
    try {
      const sp = new URLSearchParams();
      if (opts.route) sp.set('route', opts.route);
      if (categories.length) sp.set('paths', categories.join(','));
      if (q) sp.set('q', q);
      if (page > 0) sp.set('page', String(page));
      if (opts.customizable) sp.set('customizable', '1');
      if (fabricFilter) sp.set('fabric', fabricFilter);
      if (opts.sort && opts.sort !== 'featured') sp.set('sort', opts.sort);
      const edgeRes = await fetch('/api/catalogue?' + sp.toString(), { headers: { Accept: 'application/json' } });
      if (edgeRes.ok && edgeRes.headers.get('content-type')?.includes('application/json')) {
        const payload = (await edgeRes.json()) as { products?: CmsProductRow[]; count?: number; page?: number; pageSize?: number };
        return {
          products: (payload.products || []).map(rowToProduct),
          count: payload.count ?? 0,
          page: payload.page ?? page,
          pageSize: payload.pageSize ?? PUBLIC_PAGE_SIZE,
          error: null,
        };
      }
    } catch {
      // Fall back to direct Supabase query in local dev
    }
  }

  let builder=client.from('nb_products').select(columns,{count:'planned'})
    .eq('status','published');
  if(opts.route){
    if(opts.route==='/men'||opts.route==='/kids')
      builder=builder.eq('department',opts.route.slice(1));
    else builder=builder.overlaps('category_paths',categories);
  }
  if(q)builder=builder.or('title.ilike.%'+q+'%,sku.ilike.%'+q+'%');
  if(opts.customizable)builder=builder.eq('customizable',true);
  if(fabricFilter)builder=builder.ilike('fabric','%'+fabricFilter+'%');
  if(opts.sort==='price_asc')builder=builder.order('price',{ascending:true,nullsFirst:false}).order('sort_rank',{ascending:true});
  else if(opts.sort==='price_desc')builder=builder.order('price',{ascending:false,nullsFirst:false}).order('sort_rank',{ascending:true});
  else if(opts.sort==='newest')builder=builder.order('updated_at',{ascending:false});
  else builder=builder.order('sort_rank',{ascending:true}).order('updated_at',{ascending:false});
  const {data,count,error}=await builder
    .order('id',{ascending:true})
    .range(page*PUBLIC_PAGE_SIZE,(page+1)*PUBLIC_PAGE_SIZE-1);
  return error?empty(page,error.message):{
    products:((data||[]) as CmsProductRow[]).map(rowToProduct),
    count:count||0,page,pageSize:PUBLIC_PAGE_SIZE,error:null,
  };
}
const isUuid=(handle:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(handle);
const isSku=(handle:string)=>/^NB-[A-Z]{2,3}-[0-9]{5}$/.test(handle);
export const isValidProductHandle=(handle:string):boolean =>
  handle.length<=120 && (isUuid(handle)||isSku(handle)||/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle));

/** Publish-only lookup: readable slugs and existing UUID shares both resolve. */
export async function loadProductById(handle:string):Promise<CatalogProduct|null> {
  if(!isValidProductHandle(handle))return null;
  const client=getCmsClient();if(!client)return null;
  if (typeof window !== 'undefined') {
    try {
      const edgeRes = await fetch('/api/product-data?id=' + encodeURIComponent(handle), {
        headers: { Accept: 'application/json' },
      });
      if (edgeRes.ok && edgeRes.headers.get('content-type')?.includes('application/json')) {
        const payload = (await edgeRes.json()) as { product?: CmsProductRow | null };
        return payload.product ? rowToProduct(payload.product) : null;
      }
      if (edgeRes.status === 404 && edgeRes.headers.get('content-type')?.includes('application/json')) {
        return null;
      }
    } catch {
      // Fall back to direct Supabase query in local dev
    }
  }
  const {data,error}=await client.from('nb_products').select(columns)
    .eq('status','published').eq(isUuid(handle)?'id':isSku(handle)?'sku':'slug',handle).maybeSingle();
  if(error||!data)return null;
  return rowToProduct(data as CmsProductRow);
}
/** Bounded indexed collection recommendations; never expose draft or archived garments. */
export async function loadRelatedProducts(product:CatalogProduct,limit=4):Promise<CatalogProduct[]> {
  const route=product.collectionPaths?.[0];
  const client=getCmsClient();
  if(!client||!route)return [];
  const count=Math.min(6,Math.max(1,Math.floor(limit)));
  if (typeof window !== 'undefined') {
    try {
      const handle = product.slug || product.id;
      const edgeRes = await fetch('/api/product-data?id=' + encodeURIComponent(handle), {
        headers: { Accept: 'application/json' },
      });
      if (edgeRes.ok && edgeRes.headers.get('content-type')?.includes('application/json')) {
        const payload = (await edgeRes.json()) as { related?: CmsProductRow[] };
        if (Array.isArray(payload.related)) return payload.related.slice(0, count).map(rowToProduct);
      }
    } catch {
      // Fall back to direct Supabase query in local dev
    }
  }
  const {data,error}=await client.from('nb_products').select(columns)
    .eq('status','published').neq('id',product.id)
    .overlaps('category_paths',[route])
    .order('updated_at',{ascending:false}).limit(count);
  return error?[]:((data||[]) as CmsProductRow[]).map(rowToProduct);
}
