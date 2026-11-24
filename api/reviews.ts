/**
 * Edge-cached public approved reviews endpoint (store-wide or per-product).
 */
const url = process.env.VITE_SUPABASE_URL?.trim() || 'https://uinhybkdzevpxnugtvzf.supabase.co';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || 'sb_publishable_h3Bat2XRHgWACqz-kxCdww_NZsSjO_q';
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const NOIR_SHERWANI_ID = '788f30aa-6d01-43a8-a345-9ae15074cc3e';

interface ReviewRow {
  id: string;
  display_name: string;
  rating?: number;
  comment: string;
  created_at: string;
  product_id?: string | null;
  photo_urls?: string[];
}

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

    const productId = new URL(request.url).searchParams.get('productId')?.trim() || '';
    if (productId && !isUuid(productId)) {
      return new Response(JSON.stringify({ reviews: [], averageRating: 0, totalCount: 0 }), {
        status: 400,
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });
    }

    try {
      const filter = productId
        ? `&or=(product_id.eq.${encodeURIComponent(productId)},product_id.is.null)`
        : '';
      let res = await fetch(
        `${url}/rest/v1/nb_reviews?select=id,display_name,rating,comment,created_at,product_id,photo_urls&status=eq.approved${filter}&order=created_at.desc&limit=24`,
        {
          headers: { apikey: key, Accept: 'application/json' },
          signal: AbortSignal.timeout(7000),
        },
      );
      if (!res.ok) {
        res = await fetch(
          `${url}/rest/v1/nb_reviews?select=id,display_name,rating,comment,created_at,product_id&status=eq.approved${filter}&order=created_at.desc&limit=24`,
          {
            headers: { apikey: key, Accept: 'application/json' },
            signal: AbortSignal.timeout(7000),
          },
        );
      }
      if (!res.ok && !productId) {
        res = await fetch(
          `${url}/rest/v1/nb_reviews?select=id,display_name,rating,comment,created_at&status=eq.approved&order=created_at.desc&limit=12`,
          {
            headers: { apikey: key, Accept: 'application/json' },
            signal: AbortSignal.timeout(7000),
          },
        );
      }
      if (!res.ok) throw new Error('Reviews query failed');
      const raw = (await res.json()) as ReviewRow[];
      const all = Array.isArray(raw) ? raw : [];
      const list = productId
        ? all
            .filter((r) => {
              if (r.product_id === productId) return true;
              if (r.product_id == null && productId.toLowerCase() === NOIR_SHERWANI_ID && r.id === '08981c6a-a99c-4d77-95eb-28f9f02cc0db') {
                return true;
              }
              return false;
            })
            .slice(0, 12)
        : all.slice(0, 12);

      const totalCount = list.length;
      const averageRating = totalCount
        ? Number((list.reduce((sum, r) => sum + Number(r.rating || 0), 0) / totalCount).toFixed(1))
        : 0;
      return new Response(JSON.stringify({ reviews: list, averageRating, totalCount }), {
        status: 200,
        headers: {
          ...headers,
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Reviews temporarily unavailable' }), {
        status: 503,
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });
    }
  },
};
