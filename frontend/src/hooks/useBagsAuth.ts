/**
 * Bags Agent auth bridge.
 *
 * Detects whether the app is running inside the Bags App Store iframe.
 * If so, communicates with the parent frame for wallet access and tx signing.
 * Falls back to manual wallet input when running standalone.
 */

import { useState, useEffect } from 'react';

interface BagsAgent {
  getWalletAddress(): Promise<string>;
  signAndSendTransaction(tx: string): Promise<{ signature: string }>;
}

interface BagsAuthState {
  isInBags: boolean;
  walletAddress: string | null;
  agent: BagsAgent | null;
  loading: boolean;
  error: string | null;
}

/** Check if we're inside an iframe (likely Bags App Store) */
function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin iframe blocks access
  }
}

function getParentOrigin(): string | null {
  const configured = import.meta.env.VITE_BAGS_PARENT_ORIGIN;
  if (configured) {
    return configured;
  }

  if (document.referrer) {
    try {
      return new URL(document.referrer).origin;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Create a Bags Agent proxy that communicates via postMessage.
 * When the Bags platform injects `window.bagsAgent`, use that directly.
 */
function createBagsProxy(): BagsAgent | null {
  // Check for injected global (trusted — Bags platform injects this)
  const injected = (window as any).bagsAgent;
  if (injected && typeof injected.getWalletAddress === 'function') {
    console.warn('[useBagsAuth] Using injected window.bagsAgent — trust assumption: Bags platform context');
    return injected as BagsAgent;
  }

  // postMessage-based fallback
  if (!isInIframe()) return null;

  const targetOrigin = getParentOrigin();

  // Require explicit origin — never send postMessage to '*' in iframe mode
  if (!targetOrigin) {
    console.warn('[useBagsAuth] No parent origin configured (set VITE_BAGS_PARENT_ORIGIN). Refusing postMessage to *.');
    return null;
  }

  let messageId = 0;
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== targetOrigin) {
      return;
    }
    if (event.data?.type === 'bags:response' && typeof event.data.id === 'number') {
      const p = pending.get(event.data.id);
      if (p) {
        pending.delete(event.data.id);
        if (event.data.error) {
          p.reject(new Error(event.data.error));
        } else {
          p.resolve(event.data.result);
        }
      }
    }
  };

  window.addEventListener('message', onMessage);

  function rpc(method: string, params?: unknown): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++messageId;
      pending.set(id, { resolve, reject });
      window.parent.postMessage(
        { type: 'bags:request', id, method, params },
        targetOrigin!,
      );
      // Timeout after 30 seconds
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`Bags RPC timeout: ${method}`));
        }
      }, 30_000);
    });
  }

  return {
    getWalletAddress: () => rpc('getWalletAddress'),
    signAndSendTransaction: (tx: string) => rpc('signAndSendTransaction', { tx }),
  };
}

export function useBagsAuth(): BagsAuthState {
  const [state, setState] = useState<BagsAuthState>({
    isInBags: false,
    walletAddress: null,
    agent: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const agent = createBagsProxy();
    if (!agent) {
      setState({
        isInBags: false,
        walletAddress: null,
        agent: null,
        loading: false,
        error: null,
      });
      return;
    }

    setState((s) => ({ ...s, isInBags: true, agent, loading: true, error: null }));

    agent.getWalletAddress()
      .then((addr) => setState((s) => ({ ...s, walletAddress: addr, loading: false })))
      .catch((error) => setState((s) => ({
        ...s,
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to connect to Bags wallet',
      })));
  }, []);

  return state;
}
