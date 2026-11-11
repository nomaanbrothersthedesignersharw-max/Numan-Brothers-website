#!/usr/bin/env node
/**
 * HTTP smoke test for the deployed Nomaan Brothers storefront.
 * Usage: node scripts/smoke-deployment.mjs https://your-domain.example
 * This does not replace real Supabase RLS, Auth, Storage or content checks.
 */
const raw = process.argv[2] || process.env.BASE_URL;
if (!raw) {
  console.error('Usage: node scripts/smoke-deployment.mjs https://your-domain.example');
  process.exit(2);
}
let origin;
try {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Expected an HTTPS site origin');
  }
  origin = url.origin;
} catch {
  console.error('Provide a valid HTTPS site origin without path, credentials, query or fragment.');
  process.exit(2);
}

const checks = [];
const check = (ok, message) => checks.push({ ok, message });
async function fetchPath(path) {
  const response = await fetch(new URL(path, origin), {
    redirect: 'follow',
    headers: { accept: '*/*', 'user-agent': 'NomaanReleaseSmoke/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  check(new URL(response.url).origin === origin, `${path}: stays on expected origin`);
  check(response.ok, `${path}: HTTP ${response.status} (expected 2xx; check SSO if 401/403)`);
  return { response, body: await response.text() };
}
try {
  const home = await fetchPath('/');
  check(/<html\b/i.test(home.body) && /id=["']root["']/i.test(home.body), '/: React shell loads');
  check(home.response.headers.get('x-content-type-options')?.toLowerCase() === 'nosniff', '/: nosniff');
  check(home.response.headers.get('x-frame-options')?.toUpperCase() === 'DENY', '/: deny framing');
  check(home.response.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"), '/: restrictive CSP');
  check(home.response.headers.get('strict-transport-security')?.includes('max-age='), '/: HSTS');
  const studio = await fetchPath('/studio');
  check(studio.response.headers.get('x-robots-tag')?.toLowerCase().includes('noindex'), '/studio: noindex');
  check(studio.response.headers.get('cache-control')?.toLowerCase().includes('no-store'), '/studio: no-store');
  check(/<html\b/i.test(studio.body), '/studio: SPA deep-link works');
  const robots = await fetchPath('/robots.txt');
  check(/disallow:\s*\/studio\b/i.test(robots.body), '/robots.txt: disallows studio');

  // The health endpoint uses only the public publishable key and returns
  // booleans, never credentials or user records. Treat any failed sub-check
  // as a failed deployment smoke test, even when the endpoint itself is 200.
  const cms = await fetchPath('/api/cms-status');
  check(cms.response.headers.get('cache-control')?.toLowerCase().includes('no-store'),
    '/api/cms-status: no-store');
  check(cms.response.headers.get('x-robots-tag')?.toLowerCase().includes('noindex'),
    '/api/cms-status: noindex');
  let health;
  try { health = JSON.parse(cms.body); }
  catch { health = null; }
  check(!!health && health.configured === true, '/api/cms-status: backend configured');
  check(health?.auth?.ok === true, '/api/cms-status: Supabase Auth health');
  check(health?.catalogue?.ok === true, '/api/cms-status: public catalogue access');
  check(health?.privateAccess?.ok === true, '/api/cms-status: anonymous private-data denial');
  for (const key of ['categories','products','homepage','draftsPrivate','mediaPrivate','revisionsPrivate']) {
    check(health?.checks?.[key] === true, `/api/cms-status: ${key}`);
  }
  const secretLikeKey = value => {
    if (!value || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, item]) =>
      /secret|password|token|api.?key|email|user.?id/i.test(key) ||
      secretLikeKey(item));
  };
  check(!secretLikeKey(health), '/api/cms-status: no secret or identity fields');
} catch (error) {
  check(false, `Network/response failure: ${error instanceof Error ? error.message : String(error)}`);
}
for (const { ok, message } of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`);
const failures = checks.filter(x => !x.ok);
console.log(`\n${checks.length - failures.length}/${checks.length} HTTP checks passed`);
if (failures.length) {
  console.error('Do not promote this deployment.');
  process.exitCode = 1;
} else {
  console.log('HTTP checks passed; complete live Auth/RLS/Storage and owner signoff before launch.');
}
