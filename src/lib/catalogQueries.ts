import type { CatalogProduct } from '../storefront/catalog';
import { COLLECTION_ROUTES } from '../storefront/navigation';
import { getCmsClient } from './supabaseClient';
import { rowToProduct, type CmsProductRow } from './cmsData';

const columns = 'id,sku,slug,title,department,category_paths,description,fabric,sizes,image_urls,video_url,video_urls,price,offer_price,customizable,status,sort_rank,created_at,updated_at';
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
export async function loadCataloguePage(
  opts:{route?:string;query?:string;page?:number}
):Promise<CataloguePage> {
  const client=getCmsClient();
  const page=Math.max(0,Math.min(100000,Math.floor(opts.page||0)));
  if(!client)return empty(page,'CMS not configured');
  const q=safeCatalogueSearch(opts.query||'');
  if(opts.query && !q)return empty(page,null);
  let builder=client.from('nb_products').select(columns,{count:'exact'})
    .eq('status','published');
  if(opts.route){
    if(opts.route==='/men'||opts.route==='/kids')
      builder=builder.eq('department',opts.route.slice(1));
    else {
      const categories=collectionFilterPaths(opts.route);
      if(!categories.length)return empty(page,null);
      builder=builder.overlaps('category_paths',categories);
    }
  }
  if(q)builder=builder.or('title.ilike.%'+q+'%,sku.ilike.%'+q+'%');
  const {data,count,error}=await builder.order('sort_rank',{ascending:true})
    .order('updated_at',{ascending:false})
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
  const {data,error}=await client.from('nb_products').select(columns)
    .eq('status','published').neq('id',product.id)
    .overlaps('category_paths',[route])
    .order('updated_at',{ascending:false}).limit(count);
  return error?[]:((data||[]) as CmsProductRow[]).map(rowToProduct);
}
