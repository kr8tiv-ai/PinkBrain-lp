import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

interface SessionState {
  authenticated: boolean;
}

function createJsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function createApiFetch(session: SessionState) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (url.endsWith('/api/auth/session') && method === 'GET') {
      return createJsonResponse(
        session.authenticated
          ? { authenticated: true, csrfToken: 'csrf-token' }
          : { authenticated: false },
      );
    }

    if (url.endsWith('/api/liveness') && method === 'GET') {
      return createJsonResponse({
        status: 'ok',
        version: 'test',
        timestamp: '2026-03-28T00:00:00.000Z',
      });
    }

    if (url.endsWith('/api/auth/bootstrap/exchange') && method === 'POST') {
      session.authenticated = true;
      return createJsonResponse({ authenticated: true, csrfToken: 'csrf-token' });
    }

    if (url.endsWith('/api/auth/logout') && method === 'POST') {
      session.authenticated = false;
      return createJsonResponse({ authenticated: false });
    }

    if (url.endsWith('/api/stats') && method === 'GET') {
      return createJsonResponse({
        strategies: { total: 0, active: 0 },
        runs: { total: 0, completed: 0, failed: 0, successRate: 0 },
        scheduledJobs: 0,
        runtime: {
          dryRun: false,
          killSwitchEnabled: false,
          apiAuthProtected: true,
        },
      });
    }

    if (url.endsWith('/api/readiness') && method === 'GET') {
      return createJsonResponse({
        status: 'ok',
        version: 'test',
        timestamp: '2026-03-28T00:00:00.000Z',
        scheduler: { scheduledStrategies: 0 },
        runtime: {
          dryRun: false,
          killSwitchEnabled: false,
          apiAuthProtected: true,
          executionMode: 'live',
        },
        dependencies: {
          database: { status: 'ok' },
          bagsApi: { status: 'configured', baseUrl: 'https://api.test.local' },
          heliusRpc: { status: 'configured', endpoint: 'https://helius.test.local' },
          agentAuth: { status: 'missing', username: null, walletAddress: null },
          signer: { status: 'configured', source: 'bags-agent' },
        },
      });
    }

    if (url.endsWith('/api/strategies') && method === 'GET') {
      return createJsonResponse([]);
    }

    throw new Error(`Unhandled fetch: ${method} ${url}`);
  });
}

async function renderApp() {
  vi.resetModules();
  const { App } = await import('./App');
  return render(<App />);
}

describe('App auth flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('shows success feedback and opens the dashboard after bootstrap exchange', async () => {
    const user = userEvent.setup();
    const session = { authenticated: false };
    vi.stubGlobal('fetch', createApiFetch(session));

    await renderApp();

    await user.type(await screen.findByPlaceholderText(/paste bootstrap token/i), 'hackathon-token');
    await user.click(screen.getByRole('button', { name: /start secure session/i }));

    expect(await screen.findByText(/secure operator session started/i)).toBeTruthy();
    expect(await screen.findByText(/runtime readiness/i)).toBeTruthy();
    expect(await screen.findByText(/no strategies yet/i)).toBeTruthy();
  });

  test('shows sign-out feedback and returns to the login gate', async () => {
    const user = userEvent.setup();
    const session = { authenticated: true };
    vi.stubGlobal('fetch', createApiFetch(session));

    await renderApp();

    await user.click(await screen.findByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(session.authenticated).toBe(false));
    expect(await screen.findByText(/session closed\. sign in to continue\./i)).toBeTruthy();
    expect(await screen.findByRole('heading', { name: /unlock the dashboard/i })).toBeTruthy();
  });

  test('consumes a bootstrap token from the url and clears it after session exchange', async () => {
    const session = { authenticated: false };
    vi.stubGlobal('fetch', createApiFetch(session));
    window.history.pushState({}, '', '/?bootstrap=one-time-token');

    await renderApp();

    expect(await screen.findByText(/secure operator session started/i)).toBeTruthy();
    expect(await screen.findByText(/runtime readiness/i)).toBeTruthy();
    expect(window.location.search).toBe('');
  });
});
