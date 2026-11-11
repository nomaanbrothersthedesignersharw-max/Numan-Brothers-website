import { describe, expect, test } from 'bun:test';
import { createPublicJsonReader } from '../src/lib/publicApi';

describe('Public storefront data cache', () => {
  test('deduplicates identical in-flight requests and reuses the result briefly', async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls += 1;
      await Promise.resolve();
      return new Response(JSON.stringify({ products: [1, 2, 3] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const read = createPublicJsonReader(fetcher);
    const [first, second] = await Promise.all([
      read<{ products: number[] }>('/api/catalogue?page=0', 15_000),
      read<{ products: number[] }>('/api/catalogue?page=0', 15_000),
    ]);
    expect(first).toEqual({ products: [1, 2, 3] });
    expect(second).toEqual(first);
    expect(calls).toBe(1);

    await read('/api/catalogue?page=0', 15_000);
    expect(calls).toBe(1);
  });

  test('does not cache failed responses', async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls += 1;
      return calls === 1
        ? new Response('unavailable', { status: 503 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const read = createPublicJsonReader(fetcher);
    await expect(read('/api/storefront')).rejects.toThrow('503');
    await expect(read('/api/storefront')).resolves.toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  test('rejects external and traversal URLs before making a network request', async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls += 1;
      return new Response('{}', { status: 200 });
    };
    const read = createPublicJsonReader(fetcher);
    await expect(read('https://example.com/api/catalogue')).rejects.toThrow('same-origin');
    await expect(read('/api/../private')).rejects.toThrow('same-origin');
    expect(calls).toBe(0);
  });
});
