/**
 * Edge-cached public approved reviews endpoint.
 */
const url = process.env.VITE_SUPABASE_URL?.trim() || '';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '';

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
      return new Response(JSON.stringify({ reviews: [] }), {
        status: 200,
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });
    }

    try {
      const res = await fetch(
        `${url}/rest/v1/nb_reviews?select=id,display_name,rating,comment,created_at&status=eq.approved&order=approved_at.desc&limit=6`,
        {
          headers: { apikey: key, Accept: 'application/json' },
          signal: AbortSignal.timeout(7000),
        },
      );
      if (!res.ok) throw new Error('Reviews query failed');
      const reviews = (await res.json()) as unknown[];
      return new Response(JSON.stringify({ reviews: Array.isArray(reviews) ? reviews : [] }), {
        status: 200,
        headers: {
          ...headers,
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
        },
      });
    } catch {
      return new Response(JSON.stringify({ reviews: [] }), {
        status: 200,
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });
    }
  },
};
