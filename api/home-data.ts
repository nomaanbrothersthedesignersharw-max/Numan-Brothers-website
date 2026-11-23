/**
 * Edge-cached public homepage & category bootstrap endpoint.
 * Absorbs 1,000–2,000+ concurrent visitors at Vercel's CDN instead of hitting Supabase Postgres.
 */
const url = process.env.VITE_SUPABASE_URL?.trim() || '';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '';

const productCols =
  'id,sku,slug,title,department,category_paths,description,fabric,sizes,image_urls,video_url,price,offer_price,customizable,status,sort_rank,created_at,updated_at';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    };
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key)) {
      return new Response(JSON.stringify({ error: 'CMS not configured' }), {
        status: 503,
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });
    }

    const supaHeaders = { apikey: key, Accept: 'application/json' };
    try {
      const [productsRes, homeRes, categoriesRes] = await Promise.all([
        fetch(
          `${url}/rest/v1/nb_products?select=${productCols}&status=eq.published&order=sort_rank.asc&limit=12`,
          { headers: supaHeaders, signal: AbortSignal.timeout(8000) },
        ),
        fetch(
          `${url}/rest/v1/nb_home_public?select=content&key=eq.home&limit=1`,
          { headers: supaHeaders, signal: AbortSignal.timeout(8000) },
        ),
        fetch(
          `${url}/rest/v1/nb_categories?select=path,department,label,description,image_url,active,sort_order&active=eq.true`,
          { headers: supaHeaders, signal: AbortSignal.timeout(8000) },
        ),
      ]);

      if (!productsRes.ok || !homeRes.ok || !categoriesRes.ok) {
        throw new Error('Upstream catalogue query failed');
      }

      const [products, homeRows, categories] = await Promise.all([
        productsRes.json(),
        homeRes.json(),
        categoriesRes.json(),
      ]);

      const homeContent = Array.isArray(homeRows) && homeRows[0] ? homeRows[0].content : null;
      return new Response(
        JSON.stringify({ products: products || [], homeContent, categories: categories || [] }),
        {
          status: 200,
          headers: {
            ...headers,
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600',
          },
        },
      );
    } catch {
      return new Response(JSON.stringify({ error: 'Unable to read published catalogue' }), {
        status: 503,
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });
    }
  },
};
