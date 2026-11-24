/**
 * Edge-cached paginated product videos endpoint supporting 100-200+ videos per product
 * via public.nb_product_videos without bloating core product payloads.
 */
import { getSupabaseConfig, logApiEvent } from './_supabase';

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 24;

export default {
  async fetch(request: Request): Promise<Response> {
    const startedAt = Date.now();
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    };
    const cfg = getSupabaseConfig();
    if (!cfg) {
      logApiEvent('error', 'product_videos_unconfigured');
      return new Response(JSON.stringify({ error: 'CMS not configured' }), {
        status: 503,
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });
    }
    const { url, key } = cfg;

    const sp = new URL(request.url).searchParams;
    const productId = sp.get('productId')?.trim() || '';
    if (!isUuid(productId)) {
      return new Response(JSON.stringify({ videos: [], count: 0, page: 0, pageSize: DEFAULT_PAGE_SIZE }), {
        status: 400,
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });
    }

    const pageRaw = Number(sp.get('page') || '0');
    const page = Number.isFinite(pageRaw) ? Math.max(0, Math.min(100, Math.floor(pageRaw))) : 0;
    const sizeRaw = Number(sp.get('pageSize') || String(DEFAULT_PAGE_SIZE));
    const pageSize = Number.isFinite(sizeRaw)
      ? Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(sizeRaw)))
      : DEFAULT_PAGE_SIZE;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    try {
      const res = await fetch(
        `${url}/rest/v1/nb_product_videos?select=id,playback_url,thumbnail_url,title,duration_sec,sort_order&product_id=eq.${encodeURIComponent(productId)}&status=eq.ready&order=sort_order.asc,created_at.desc`,
        {
          headers: {
            apikey: key,
            Accept: 'application/json',
            Range: `${from}-${to}`,
            'Range-Unit': 'items',
            Prefer: 'count=planned',
          },
          signal: AbortSignal.timeout(7000),
        },
      );
      if (res.status === 404 || res.status === 400) {
        // Table not migrated yet — return empty cleanly
        return new Response(JSON.stringify({ videos: [], count: 0, page, pageSize }), {
          status: 200,
          headers: {
            ...headers,
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
            'Server-Timing': `edge;dur=${Date.now() - startedAt}`,
          },
        });
      }
      if (!res.ok) throw new Error('Product videos query failed');
      const videos = (await res.json()) as unknown[];
      const range = res.headers.get('content-range') || '';
      const totalRaw = Number(range.split('/').at(-1));
      const count = Number.isFinite(totalRaw) && totalRaw >= 0 ? totalRaw : videos.length;

      return new Response(JSON.stringify({ videos: Array.isArray(videos) ? videos : [], count, page, pageSize }), {
        status: 200,
        headers: {
          ...headers,
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600',
          'Server-Timing': `edge;dur=${Date.now() - startedAt}`,
        },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Product videos temporarily unavailable' }), {
        status: 503,
        headers: { ...headers, 'Cache-Control': 'no-store' },
      });
    }
  },
};
