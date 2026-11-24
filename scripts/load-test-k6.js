/**
 * Realistic k6 concurrency load test for Nomaan Brothers storefront & edge APIs.
 * Usage (against staging or production):
 *   k6 run -e BASE_URL=https://your-staging-url.vercel.app scripts/load-test-k6.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = (__ENV.BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 500 },
    { duration: '1m', target: 1000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<250', 'p(99)<600'],
    http_req_failed: ['rate<0.005'],
  },
};

export default function () {
  const homeRes = http.get(`${BASE}/api/home-data`, { headers: { Accept: 'application/json' } });
  check(homeRes, {
    'home-data 200': (r) => r.status === 200,
    'home-data cached': (r) => Boolean(r.headers['Cache-Control']),
  });

  const catRes = http.get(`${BASE}/api/catalogue?route=/men/suits/plain`, {
    headers: { Accept: 'application/json' },
  });
  check(catRes, { 'catalogue 200': (r) => r.status === 200 });

  const searchRes = http.get(`${BASE}/api/catalogue?q=sherwani`, {
    headers: { Accept: 'application/json' },
  });
  check(searchRes, { 'search 200': (r) => r.status === 200 });

  const revRes = http.get(`${BASE}/api/reviews`, { headers: { Accept: 'application/json' } });
  check(revRes, { 'reviews 200': (r) => r.status === 200 });

  sleep(1);
}
