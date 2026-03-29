import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CreateStrategyPage } from './CreateStrategyPage';

function createJsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CreateStrategyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CreateStrategyPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/api/validation/public-key')) {
        return createJsonResponse({
          valid: true,
          normalized: '7xKpXq3QSCdKKZ8GbLzoGKN1GL1VTqG7qR7KtB7jL1bN',
        });
      }

      if (url.includes('/api/validation/token-mint')) {
        return createJsonResponse({
          valid: true,
          normalized: 'So11111111111111111111111111111111111111112',
          decimals: 9,
          supply: '1000000',
        });
      }

      if (url.includes('/api/validation/schedule')) {
        return createJsonResponse({
          valid: true,
          nextRunAt: '2026-03-29T06:00:00.000Z',
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('enables moving past the token step after live validation succeeds', async () => {
    const user = userEvent.setup();

    renderPage();

    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();

    await user.type(screen.getByLabelText(/owner wallet/i), '7xKpXq3QSCdKKZ8GbLzoGKN1GL1VTqG7qR7KtB7jL1bN');
    await user.type(screen.getByLabelText(/token a mint/i), 'So11111111111111111111111111111111111111112');
    await user.type(screen.getByLabelText(/token b mint/i), 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

    await waitFor(() => expect(screen.getByText(/wallet verified/i)).toBeTruthy());
    await waitFor(() => expect(screen.getAllByText(/mint verified/i).length).toBeGreaterThan(0));
    await waitFor(() => expect(nextButton).toBeEnabled());
  });
});
