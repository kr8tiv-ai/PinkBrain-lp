import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { LoginGate } from './LoginGate';
import { ToastContainer } from '../common/ToastContainer';

function createJsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function renderLoginGate() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LoginGate />
      <ToastContainer />
    </QueryClientProvider>,
  );
}

describe('LoginGate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        createJsonResponse({
          status: 'ok',
          version: 'test',
          timestamp: '2026-03-28T00:00:00.000Z',
        })),
    );
  });

  test('pastes the operator token from the clipboard', async () => {
    const user = userEvent.setup();
    const readText = vi.fn().mockResolvedValue('  pasted-token  ');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText },
    });

    renderLoginGate();

    await user.click(await screen.findByRole('button', { name: /paste from clipboard/i }));

    await waitFor(() => expect(readText).toHaveBeenCalledTimes(1));
    expect(await screen.findByDisplayValue('pasted-token')).toBeTruthy();
    expect(screen.getByText(/token pasted from clipboard/i)).toBeTruthy();
  });
});
