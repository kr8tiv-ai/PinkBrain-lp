import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api, setCsrfToken } from './client';

describe('api client csrf support', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    setCsrfToken(null);
    vi.unstubAllGlobals();
  });

  test('adds the csrf header to mutating requests when a session token is set', async () => {
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('X-CSRF-Token')).toBe('csrf-token');
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchSpy);
    setCsrfToken('csrf-token');

    const response = await api.post<{ ok: boolean }>('/api/test', { hello: 'world' });

    expect(response).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test('does not add the csrf header to read-only requests', async () => {
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.has('X-CSRF-Token')).toBe(false);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchSpy);
    setCsrfToken('csrf-token');

    const response = await api.get<{ ok: boolean }>('/api/test');

    expect(response).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
