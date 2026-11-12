type CacheEntry = { expiresAt: number; value: unknown };

/**
 * Small per-tab cache for public API reads. It collapses identical in-flight
 * requests and keeps a bounded number of short-lived results in memory.
 * Shared traffic is handled by the Vercel CDN response cache, not this map.
 */
export function createPublicJsonReader(fetcher: typeof fetch = fetch) {
  const cache = new Map<string, CacheEntry>();
  const pending = new Map<string, Promise<unknown>>();
  const maxEntries = 64;

  return async function readPublicJson<T>(path: string, ttlMs = 15_000): Promise<T> {
    if (!path.startsWith('/api/') || path.includes('..')) {
      throw new Error('Public data requests must use a same-origin API route');
    }

    const now = Date.now();
    const cached = cache.get(path);
    if (cached && cached.expiresAt > now) {
      // Refresh insertion order so hot routes remain in the small LRU cache.
      cache.delete(path);
      cache.set(path, cached);
      return cached.value as T;
    }

    const inFlight = pending.get(path);
    if (inFlight) return inFlight as Promise<T>;

    const request = (async () => {
      const response = await fetcher(path, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        redirect: 'error',
        cache: 'default',
      });
      if (!response.ok) throw new Error('Public catalogue request failed (' + response.status + ')');
      const value: unknown = await response.json();
      cache.set(path, { value, expiresAt: Date.now() + Math.max(1_000, Math.min(ttlMs, 120_000)) });
      while (cache.size > maxEntries) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
      }
      return value;
    })();

    pending.set(path, request);
    try {
      return await request as T;
    } finally {
      pending.delete(path);
    }
  };
}

export const readPublicJson = createPublicJsonReader();
