/**
 * Edge-cached single-product + related-products JSON endpoint.
 * Serves 1,000–2,000+ concurrent product page views from Vercel's CDN.
 */
const url = process.env.VITE_SUPABASE_URL?.trim() || 'https://uinhybkdzevpxnugtvzf.supabase.co';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || 'sb_publishable_h3Bat2XRHgWACqz-kxCdww_NZsSjO_q';
const baseCols =
  'id,sku,slug,title,department,category_paths,description,fabric,sizes,image_urls,video_url,price,offer_price,customizable,status,sort_rank,created_at,updated_at';

const isUuid = (h: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(h);
const isSku = (h: string) => /^NB-[A-Z]{2,3}-[0-9]{5}$/.test(h);
const isValidHandle = (h: string) =>
  h.length > 0 && h.length <= 120 && (isUuid(h) || isSku(h) || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(h));

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    };
    const handle = new URL(request.url).searchParams.get('id')?.trim() || '';
    if (!isValidHandle(handle)) {
      return new Response(JSON.stringify({ product: null, related: [] }), {
        status: 404,
        headers: { ...headers, 'Cache-Control': 'public, s-maxage=30' },
      });
    }
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key)) {
      return new Response(JSON.stringify({ error: 'CMS not configured' }), {
        status: 503,
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });
    }

    const supaHeaders = { apikey: key, Accept: 'application/json' };
    const col = isUuid(handle) ? 'id' : isSku(handle) ? 'sku' : 'slug';
    try {
      // Try including video_urls (post-migration); fall back cleanly if migration hasn't run yet.
      let res = await fetch(
        `${url}/rest/v1/nb_products?select=${baseCols},video_urls&status=eq.published&${col}=eq.${encodeURIComponent(handle)}&limit=1`,
        { headers: supaHeaders, signal: AbortSignal.timeout(7000) },
      );
      if (res.status === 400) {
        res = await fetch(
          `${url}/rest/v1/nb_products?select=${baseCols}&status=eq.published&${col}=eq.${encodeURIComponent(handle)}&limit=1`,
          { headers: supaHeaders, signal: AbortSignal.timeout(7000) },
        );
      }
      if (!res.ok) throw new Error('Product query failed');
      const rows = (await res.json()) as Record<string, unknown>[];
      const product = Array.isArray(rows) && rows[0] ? rows[0] : null;
      if (!product) {
        return new Response(JSON.stringify({ product: null, related: [] }), {
          status: 404,
          headers: { ...headers, 'Cache-Control': 'public, s-maxage=30' },
        });
      }

      let related: Record<string, unknown>[] = [];
      const paths = Array.isArray(product.category_paths) ? product.category_paths : [];
      const firstPath = typeof paths[0] === 'string' && /^\/[a-z0-9/-]{1,80}$/.test(paths[0]) ? paths[0] : '';
      if (firstPath && typeof product.id === 'string') {
        const relRes = await fetch(
          `${url}/rest/v1/nb_products?select=${baseCols}&status=eq.published&id=neq.${encodeURIComponent(product.id)}&category_paths=ov.{${firstPath}}&order=updated_at.desc&limit=4`,
          { headers: supaHeaders, signal: AbortSignal.timeout(6000) },
        );
        if (relRes.ok) {
          const relRows = (await relRes.json()) as Record<string, unknown>[];
          if (Array.isArray(relRows)) related = relRows;
        }
      }

      return new Response(JSON.stringify({ product, related }), {
        status: 200,
        headers: {
          ...headers,
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600',
        },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Product temporarily unavailable' }), {
        status: 503,
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });
    }
  },
};
