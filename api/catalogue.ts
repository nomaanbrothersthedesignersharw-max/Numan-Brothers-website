/**
 * Edge-cached public catalogue query endpoint with PostgREST filter safety.
 * Uses Prefer: count=planned for high-concurrency scalability.
 */
const url = process.env.VITE_SUPABASE_URL?.trim() || '';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '';
const PAGE_SIZE = 24;
const productCols =
  'id,sku,slug,title,department,category_paths,description,fabric,sizes,image_urls,video_url,price,offer_price,customizable,status,sort_rank,created_at,updated_at';

function safeSearch(value: string): string {
  return value.normalize('NFKC').replace(/[^a-zA-Z0-9 -]/g, ' ').trim().replace(/\s+/g, ' ').slice(0, 72);
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

    const sp = new URL(request.url).searchParams;
    const route = sp.get('route')?.trim() || '';
    const rawQuery = sp.get('q') || '';
    const q = safeSearch(rawQuery);
    const pageRaw = Number(sp.get('page') || '0');
    const page = Number.isFinite(pageRaw) ? Math.max(0, Math.min(100000, Math.floor(pageRaw))) : 0;
    const customizable = sp.get('customizable') === '1';
    const fabric = safeSearch(sp.get('fabric') || '');
    const sort = sp.get('sort') || 'featured';

    if (rawQuery.trim() && !q) {
      return new Response(JSON.stringify({ products: [], count: 0, page, pageSize: PAGE_SIZE }), {
        status: 200,
        headers: { ...headers, 'Cache-Control': 'public, s-maxage=30' },
      });
    }

    const params = new URLSearchParams();
    params.set('select', productCols);
    params.set('status', 'eq.published');

    if (route === '/men' || route === '/kids') {
      params.set('department', 'eq.' + route.slice(1));
    } else if (route) {
      if (!/^\/[a-z0-9/-]{1,80}$/.test(route)) {
        return new Response(JSON.stringify({ products: [], count: 0, page, pageSize: PAGE_SIZE }), {
          status: 200,
          headers: { ...headers, 'Cache-Control': 'public, s-maxage=60' },
        });
      }
      // Match exact path or any child category path via PostgREST array overlap
      const pathsParam = sp.get('paths') || route;
      const validPaths = pathsParam
        .split(',')
        .map((p) => p.trim())
        .filter((p) => /^\/[a-z0-9/-]{1,80}$/.test(p))
        .slice(0, 20);
      if (validPaths.length === 0) {
        return new Response(JSON.stringify({ products: [], count: 0, page, pageSize: PAGE_SIZE }), {
          status: 200,
          headers: { ...headers, 'Cache-Control': 'public, s-maxage=60' },
        });
      }
      params.set('category_paths', 'ov.{' + validPaths.join(',') + '}');
    }

    if (q) {
      params.set('or', `(title.ilike.*${q}*,sku.ilike.*${q}*)`);
    }
    if (customizable) {
      params.set('customizable', 'eq.true');
    }
    if (fabric) {
      params.set('fabric', `ilike.*${fabric}*`);
    }

    const orderMap: Record<string, string> = {
      featured: 'sort_rank.asc,updated_at.desc,id.asc',
      price_asc: 'price.asc.nullslast,sort_rank.asc,id.asc',
      price_desc: 'price.desc.nullslast,sort_rank.asc,id.asc',
      newest: 'updated_at.desc,id.asc',
    };
    params.set('order', orderMap[sort] || orderMap.featured);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(page * PAGE_SIZE));

    try {
      const res = await fetch(`${url}/rest/v1/nb_products?${params.toString()}`, {
        headers: {
          apikey: key,
          Accept: 'application/json',
          Prefer: 'count=planned',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error('Catalogue query failed');
      const products = (await res.json()) as unknown[];
      const range = res.headers.get('content-range') || '';
      const totalRaw = Number(range.split('/').at(-1));
      const count = Number.isFinite(totalRaw) && totalRaw >= 0 ? totalRaw : products.length;

      return new Response(
        JSON.stringify({ products: products || [], count, page, pageSize: PAGE_SIZE }),
        {
          status: 200,
          headers: {
            ...headers,
            'Cache-Control': q ? 'public, s-maxage=30, stale-while-revalidate=300' : 'public, s-maxage=60, stale-while-revalidate=600',
          },
        },
      );
    } catch {
      return new Response(JSON.stringify({ error: 'Catalogue temporarily unavailable' }), {
        status: 503,
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });
    }
  },
};
