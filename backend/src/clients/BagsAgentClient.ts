import {
  parseAgentAuthInit,
  parseAgentAuthLogin,
  parseAgentWalletExport,
  parseAgentWalletList,
} from './agent-schemas.js';

export interface BagsAgentClientConfig {
  baseUrl: string;
}

export interface BagsAgentAuthInitResult {
  publicIdentifier: string;
  secret: string;
  agentUsername: string;
  agentUserId: string;
  verificationPostContent: string;
}

export interface BagsAgentAuthLoginResult {
  token: string;
}

export interface BagsAgentClient {
  initializeAuth(agentUsername: string): Promise<BagsAgentAuthInitResult>;
  completeAuth(params: {
    publicIdentifier: string;
    secret: string;
    postId: string;
  }): Promise<BagsAgentAuthLoginResult>;
  listWallets(token: string): Promise<string[]>;
  exportWallet(token: string, walletAddress: string): Promise<{ privateKey: string }>;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === 'string' && record.error) {
      return record.error;
    }
    if (typeof record.message === 'string' && record.message) {
      return record.message;
    }
  }

  return fallback;
}

export class HttpBagsAgentClient implements BagsAgentClient {
  constructor(private readonly config: BagsAgentClientConfig) {}

  async initializeAuth(agentUsername: string): Promise<BagsAgentAuthInitResult> {
    const payload = await this.request('/agent/auth/init', {
      agentUsername,
    });

    return parseAgentAuthInit(payload);
  }

  async completeAuth(params: {
    publicIdentifier: string;
    secret: string;
    postId: string;
  }): Promise<BagsAgentAuthLoginResult> {
    const payload = await this.request('/agent/auth/login', params);
    return parseAgentAuthLogin(payload);
  }

  async listWallets(token: string): Promise<string[]> {
    const payload = await this.request('/agent/wallet/list', { token });
    return parseAgentWalletList(payload);
  }

  async exportWallet(token: string, walletAddress: string): Promise<{ privateKey: string }> {
    const payload = await this.request('/agent/wallet/export', {
      token,
      walletAddress,
    });

    return parseAgentWalletExport(payload);
  }

  private async request(endpoint: string, body: unknown): Promise<unknown> {
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, `HTTP ${response.status}`));
    }

    return payload;
  }
}

export function createBagsAgentClient(baseUrl: string): BagsAgentClient {
  return new HttpBagsAgentClient({ baseUrl });
}
