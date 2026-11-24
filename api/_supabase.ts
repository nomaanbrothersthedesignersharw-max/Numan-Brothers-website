/**
 * Shared Supabase configuration and structured telemetry helpers for Vercel API routes.
 * Enforces explicit environment variables with zero hardcoded project fallbacks so
 * misconfigured preview/staging/production environments fail loudly with 503.
 */

export interface SupabaseApiConfig {
  url: string;
  key: string;
}

const SUPABASE_URL_RE = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i;
const SUPABASE_KEY_RE = /^sb_publishable_[A-Za-z0-9_-]{12,}$/;

export function getSupabaseConfig(
  env: Record<string, string | undefined> = process.env,
): SupabaseApiConfig | null {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!SUPABASE_URL_RE.test(url) || !SUPABASE_KEY_RE.test(key)) {
    return null;
  }
  return { url, key };
}

export type ApiLogLevel = 'info' | 'warn' | 'error';

/**
 * Emits single-line JSON structured logs compatible with Vercel Log Drains,
 * Axiom, Better Stack, and Datadog without leaking credentials.
 */
export function logApiEvent(
  level: ApiLogLevel,
  event: string,
  meta: Record<string, unknown> = {},
): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    service: 'nomaan-brothers-api',
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local',
    event,
    ...meta,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.info(line);
  }
}
