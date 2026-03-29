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
        performance: {
          averageDurationMs: 0,
          averageDurationSeconds: 0,
          lastSuccessfulRunAt: null,
          lastFailedRunAt: null,
          recentFailures24h: 0,
        },
        valueFlow: {
          totalClaimedLamports: '0',
          totalDistributedAmount: '0',
          totalLockedLiquidity: '0',
          totalRecipients: 0,
        },
        transactions: {
          recordedSignatures: 0,
          confirmedClaims: 0,
          runsWithOnchainActivity: 0,
        },
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

    if (url.endsWith('/api/strategies/insights') && method === 'GET') {
      return createJsonResponse([]);
    }

    throw new Error(`Unhandled fetch: ${method} ${url}`);
  });
}

function createApiFetchWithStrategyInsights(session: SessionState) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (url.endsWith('/api/auth/session') && method === 'GET') {
      return createJsonResponse({ authenticated: true, csrfToken: 'csrf-token' });
    }

    if (url.endsWith('/api/stats') && method === 'GET') {
      return createJsonResponse({
        strategies: { total: 1, active: 1 },
        runs: { total: 2, completed: 1, failed: 1, successRate: 50 },
        performance: {
          averageDurationMs: 210000,
          averageDurationSeconds: 210,
          lastSuccessfulRunAt: '2026-03-28T00:05:00.000Z',
          lastFailedRunAt: '2026-03-29T00:05:00.000Z',
          recentFailures24h: 1,
        },
        valueFlow: {
          totalClaimedLamports: '1500000000',
          totalDistributedAmount: '300',
          totalLockedLiquidity: '200',
          totalRecipients: 1,
        },
        transactions: {
          recordedSignatures: 4,
          confirmedClaims: 1,
          runsWithOnchainActivity: 1,
        },
        scheduledJobs: 1,
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
        scheduler: { scheduledStrategies: 1 },
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
          signer: { status: 'configured', source: 'remote-signer' },
        },
      });
    }

    if (url.endsWith('/api/strategies') && method === 'GET') {
      return createJsonResponse([
        {
          strategyId: 'strategy-1',
          ownerWallet: '7xKpXq3QSCdKKZ8GbLzoGKN1GL1VTqG7qR7KtB7jL1bN',
          source: 'CLAIMABLE_POSITIONS',
          targetTokenA: 'So11111111111111111111111111111111111111112',
          targetTokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          distributionToken: 'So11111111111111111111111111111111111111112',
          swapConfig: { slippageBps: 50, maxPriceImpactBps: 100 },
          meteoraConfig: { poolAddress: null, baseFee: 25, priceRange: null, lockMode: 'PERMANENT' },
          distribution: 'OWNER_ONLY',
          exclusionList: [],
          schedule: '0 */6 * * *',
          minCompoundThreshold: 7,
          status: 'ACTIVE',
          lastRunId: null,
          createdAt: '2026-03-28T00:00:00.000Z',
          updatedAt: '2026-03-28T00:00:00.000Z',
        },
      ]);
    }

    if (url.endsWith('/api/strategies/insights') && method === 'GET') {
      return createJsonResponse([
        {
          strategyId: 'strategy-1',
          schedule: {
            expression: '0 */6 * * *',
            nextRunAt: '2026-03-29T06:00:00.000Z',
          },
          lastRun: {
            runId: 'run-2',
            state: 'FAILED',
            startedAt: '2026-03-29T00:00:00.000Z',
            finishedAt: '2026-03-29T00:05:00.000Z',
            errorCode: 'RPC_TIMEOUT',
          },
          metrics: {
            totalRuns: 2,
            completedRuns: 1,
            failedRuns: 1,
            totalClaimedLamports: '1500000000',
            totalDistributedAmount: '300',
            totalLockedLiquidity: '200',
            totalRecipients: 1,
            lastSuccessfulRunAt: '2026-03-28T00:05:00.000Z',
          },
        },
      ]);
    }

    if (url.endsWith('/api/liveness') && method === 'GET') {
      return createJsonResponse({
        status: 'ok',
        version: 'test',
        timestamp: '2026-03-28T00:00:00.000Z',
      });
    }

    if (url.endsWith('/api/auth/logout') && method === 'POST') {
      session.authenticated = false;
      return createJsonResponse({ authenticated: false });
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

  test('renders strategy insights on the dashboard for authenticated operators', async () => {
    const session = { authenticated: true };
    vi.stubGlobal('fetch', createApiFetchWithStrategyInsights(session));

    await renderApp();

    expect(await screen.findByText(/lifetime claimed/i)).toBeTruthy();
    expect((await screen.findAllByText(/1\.5000 sol/i)).length).toBe(2);
    expect(await screen.findByText(/^3m 30s$/i)).toBeTruthy();
    expect(await screen.findByText(/rpc_timeout/i)).toBeTruthy();
    expect(await screen.findByText(/next run/i)).toBeTruthy();
  });
});
