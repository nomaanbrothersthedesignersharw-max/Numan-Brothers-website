import { COLLECTION_ROUTES } from '../src/storefront/navigation';

const apiUrl = process.env.VITE_SUPABASE_URL?.trim() || '';
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '';
const configured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(apiUrl) &&
  /^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(publishableKey);

const PAGE_SIZE = 24;
const SELECT = [
  'id','sku','slug','title','department','category_paths','description','fabric',
  'sizes','image_urls','video_url','video_urls','price','offer_price',
  'customizable','status','sort_rank','created_at','updated_at',
].join(',');
const baseHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};
const listingCache = 'public, max-age=10, s-maxage=45, stale-while-revalidate=180';
const productCache = 'public, max-age=20, s-maxage=90, stale-while-revalidate=600';
const relatedCache = 'public, max-age=20, s-maxage=60, stale-while-revalidate=300';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const isSku = (value: string) => /^NB-[A-Z]{2,3}-[0-9]{5}$/.test(value);
const isProductHandle = (value: string) =>
  value.length > 0 && value.length <= 120 &&
  (isUuid(value) || isSku(value) || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value));
const cleanSearch = (value: string) =>
  value.normalize('NFKC').replace(/[^a-zA-Z0-9 -]/g, ' ').trim().replace(/\s+/g, ' ').slice(0, 72);
const isCollectionPath = (path: string) => COLLECTION_ROUTES.some((item) => item.path === path);
const collectionPaths = (path: string) => COLLECTION_ROUTES
  .filter((item) => item.path === path || item.path.startsWith(path + '/'))
  .map((item) => item.path);

function json(status: number, body: unknown, cache = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...baseHeaders, 'Cache-Control': cache },
  });
}

async function readRows(url: URL): Promise<unknown[]> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { apikey: publishableKey, Accept: 'application/json' },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error('Public catalogue upstream request failed');
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new Error('Invalid public catalogue response');
  return value;
}

function baseUrl(): URL {
  const url = new URL(apiUrl + '/rest/v1/nb_products');
  url.searchParams.set('select', SELECT);
  url.searchParams.set('status', 'eq.published');
  return url;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { ...baseHeaders, Allow: 'GET', 'Cache-Control': 'no-store' },
      });
    }
    if (!configured) return json(503, { error: 'Public catalogue is not configured' });

    const params = new URL(request.url).searchParams;
    const product = params.get('product');
    const related = params.get('related');
    const route = params.get('route') || '';
    const query = params.get('q') || '';
    const requestedPage = params.get('page') || '0';

    try {
      if (product !== null) {
        if (!isProductHandle(product)) return json(400, { error: 'Invalid product handle' });
        const url = baseUrl();
        url.searchParams.set(isUuid(product) ? 'id' : isSku(product) ? 'sku' : 'slug', 'eq.' + product);
        url.searchParams.set('limit', '1');
        const rows = await readRows(url);
        return json(200, { product: rows[0] ?? null }, productCache);
      }

      if (related !== null) {
        if (!isUuid(related) || !isCollectionPath(route)) return json(400, { error: 'Invalid related-products request' });
        const limitValue = Number(params.get('limit') || '4');
        const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(6, Math.floor(limitValue))) : 4;
        const url = baseUrl();
        url.searchParams.set('id', 'neq.' + related);
        url.searchParams.set('category_paths', 'ov.{' + route + '}');
        url.searchParams.set('order', 'updated_at.desc,id.asc');
        url.searchParams.set('limit', String(limit));
        const rows = await readRows(url);
        return json(200, { products: rows }, relatedCache);
      }

      const page = /^\d{1,6}$/.test(requestedPage) ? Number(requestedPage) : -1;
      if (!Number.isSafeInteger(page) || page < 0 || page > 10000) return json(400, { error: 'Invalid catalogue page' });
      const url = baseUrl();

      if (route) {
        if (!isCollectionPath(route)) return json(400, { error: 'Unknown collection' });
        if (route === '/men' || route === '/kids') {
          url.searchParams.set('department', 'eq.' + route.slice(1));
        } else {
          const paths = collectionPaths(route);
          if (!paths.length) {
            return json(200, { products: [], page, pageSize: PAGE_SIZE, hasMore: false }, listingCache);
          }
          url.searchParams.set('category_paths', 'ov.{' + paths.join(',') + '}');
        }
      }

      const safeQuery = cleanSearch(query);
      if (query && !safeQuery) {
        return json(200, { products: [], page, pageSize: PAGE_SIZE, hasMore: false }, listingCache);
      }
      if (safeQuery) {
        url.searchParams.set('or', '(title.ilike.*' + safeQuery + '*,sku.ilike.*' + safeQuery + '*)');
      }

      // Fetch one extra row to determine if another page exists. Avoid COUNT(*)
      // for every public catalogue/search request.
      url.searchParams.set('order', 'sort_rank.asc,updated_at.desc,id.asc');
      url.searchParams.set('limit', String(PAGE_SIZE + 1));
      url.searchParams.set('offset', String(page * PAGE_SIZE));
      const rows = await readRows(url);
      return json(200, {
        products: rows.slice(0, PAGE_SIZE),
        page,
        pageSize: PAGE_SIZE,
        hasMore: rows.length > PAGE_SIZE,
      }, listingCache);
    } catch {
      return json(503, { error: 'Published catalogue is temporarily unavailable' });
    }
  },
};
