/**
 * Rate-limited, bot-protected public review submission endpoint.
 * Prevents direct unthrottled spam against the Supabase REST API.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  return forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = buckets.get(ip);
  if (!entry || entry.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k);
      }
    }
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
    }

    const ip = clientIp(request);
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: 'Too many submissions. Please try again later.' }), { status: 429, headers });
    }

    const api = process.env.VITE_SUPABASE_URL?.trim() || '';
    const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '';
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(api) || !/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key)) {
      return new Response(JSON.stringify({ error: 'Review service unavailable.' }), { status: 503, headers });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), { status: 400, headers });
    }

    // Honeypot check
    if (typeof body.website === 'string' && body.website.trim().length > 0) {
      return new Response(JSON.stringify({ ok: true }), { status: 201, headers });
    }

    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY?.trim();
    if (turnstileSecret) {
      const token = typeof body.turnstileToken === 'string' ? body.turnstileToken.trim() : '';
      if (!token) {
        return new Response(JSON.stringify({ error: 'Verification challenge required.' }), { status: 400, headers });
      }
      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: turnstileSecret, response: token, remoteip: ip }),
        signal: AbortSignal.timeout(5000),
      });
      const verifyData = (await verifyRes.json()) as { success?: boolean };
      if (!verifyData.success) {
        return new Response(JSON.stringify({ error: 'Verification failed. Please retry.' }), { status: 403, headers });
      }
    }

    const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : '';
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
    const rating = Number(body.rating);
    if (
      displayName.length < 2 || displayName.length > 70 ||
      comment.length < 20 || comment.length > 1200 ||
      !Number.isInteger(rating) || rating < 1 || rating > 5
    ) {
      return new Response(JSON.stringify({ error: 'Enter a valid name, rating (1-5), and review (20-1200 characters).' }), { status: 400, headers });
    }

    try {
      const res = await fetch(api + '/rest/v1/nb_reviews', {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ display_name: displayName, rating, comment }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 409) {
        return new Response(JSON.stringify({ error: 'This review has already been submitted.', code: '23505' }), { status: 409, headers });
      }
      if (!res.ok) {
        return new Response(JSON.stringify({ error: 'Unable to submit review right now.' }), { status: 502, headers });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 201, headers });
    } catch {
      return new Response(JSON.stringify({ error: 'Review service temporarily unavailable.' }), { status: 503, headers });
    }
  },
};
