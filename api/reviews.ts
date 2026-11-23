/**
 * Edge-cached public approved reviews endpoint (store-wide or per-product).
 */
const url = process.env.VITE_SUPABASE_URL?.trim() || '';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '';
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

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
      return new Response(JSON.stringify({ reviews: [], averageRating: 0, totalCount: 0 }), {
        status: 200,
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });
    }

    const productId = new URL(request.url).searchParams.get('productId')?.trim() || '';
    if (productId && !isUuid(productId)) {
      return new Response(JSON.stringify({ reviews: [], averageRating: 0, totalCount: 0 }), {
        status: 400,
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });
    }

    try {
      const filter = productId ? `&product_id=eq.${encodeURIComponent(productId)}` : '';
      let res = await fetch(
        `${url}/rest/v1/nb_reviews?select=id,display_name,rating,comment,created_at,product_id,photo_urls&status=eq.approved${filter}&order=approved_at.desc&limit=12`,
        {
          headers: { apikey: key, Accept: 'application/json' },
          signal: AbortSignal.timeout(7000),
        },
      );
      if (res.status === 400) {
        // Fallback without photo_urls if migration is pending
        res = await fetch(
          `${url}/rest/v1/nb_reviews?select=id,display_name,rating,comment,created_at,product_id&status=eq.approved${filter}&order=approved_at.desc&limit=12`,
          {
            headers: { apikey: key, Accept: 'application/json' },
            signal: AbortSignal.timeout(7000),
          },
        );
      }
      if (res.status === 400 && !productId) {
        // Pre-migration fallback without product_id column
        res = await fetch(
          `${url}/rest/v1/nb_reviews?select=id,display_name,rating,comment,created_at&status=eq.approved&order=approved_at.desc&limit=6`,
          {
            headers: { apikey: key, Accept: 'application/json' },
            signal: AbortSignal.timeout(7000),
          },
        );
      }
      if (!res.ok) throw new Error('Reviews query failed');
      const reviews = (await res.json()) as { rating?: number }[];
      const list = Array.isArray(reviews) ? reviews : [];
      const totalCount = list.length;
      const averageRating = totalCount
        ? Number((list.reduce((sum, r) => sum + Number(r.rating || 0), 0) / totalCount).toFixed(1))
        : 0;
      return new Response(JSON.stringify({ reviews: list, averageRating, totalCount }), {
        status: 200,
        headers: {
          ...headers,
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
        },
      });
    } catch {
      return new Response(JSON.stringify({ reviews: [], averageRating: 0, totalCount: 0 }), {
        status: 200,
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });
    }
  },
};
