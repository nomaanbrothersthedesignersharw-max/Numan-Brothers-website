const apiUrl = process.env.VITE_SUPABASE_URL?.trim() || '';
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '';
const configured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(apiUrl) &&
  /^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(publishableKey);

const productsSelect = [
  'id','sku','slug','title','department','category_paths','description','fabric',
  'sizes','image_urls','video_url','video_urls','price','offer_price',
  'customizable','status','sort_rank','created_at','updated_at',
].join(',');

const cacheHeaders = {
  'Cache-Control': 'public, max-age=20, s-maxage=60, stale-while-revalidate=300',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

async function readRows(path: string): Promise<unknown[]> {
  const response = await fetch(apiUrl + path, {
    method: 'GET',
    headers: { apikey: publishableKey, Accept: 'application/json' },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Public catalogue upstream request failed');
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new Error('Invalid public catalogue response');
  return value;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
      });
    }
    if (!configured) {
      return new Response(JSON.stringify({ error: 'Public catalogue is not configured' }), {
        status: 503,
        headers: { ...cacheHeaders, 'Cache-Control': 'no-store' },
      });
    }

    try {
      const [products, homepage, categories] = await Promise.all([
        readRows('/rest/v1/nb_products?select=' + encodeURIComponent(productsSelect) +
          '&status=eq.published&order=sort_rank.asc,updated_at.desc,id.asc&limit=12'),
        readRows('/rest/v1/nb_home_public?select=content&key=eq.home&limit=1'),
        readRows('/rest/v1/nb_categories?select=path,department,label,description,image_url,active,sort_order' +
          '&active=eq.true&order=sort_order.asc,path.asc'),
      ]);

      return new Response(JSON.stringify({
        products,
        homepage: (homepage[0] as { content?: unknown } | undefined)?.content ?? null,
        categories,
      }), { status: 200, headers: cacheHeaders });
    } catch {
      return new Response(JSON.stringify({ error: 'Published storefront data is temporarily unavailable' }), {
        status: 503,
        headers: { ...cacheHeaders, 'Cache-Control': 'no-store' },
      });
    }
  },
};
