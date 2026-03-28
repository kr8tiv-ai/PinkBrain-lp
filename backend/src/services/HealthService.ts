import type { Config } from '../config/index.js';
import type { Database } from './Database.js';

export interface HealthSnapshot {
  status: 'ok' | 'degraded';
  version: string;
  timestamp: string;
  scheduler: {
    scheduledStrategies: number;
  };
  runtime: {
    dryRun: boolean;
    killSwitchEnabled: boolean;
    apiAuthProtected: boolean;
    executionMode: 'live' | 'dry-run' | 'blocked';
  };
  dependencies: {
    database: { status: 'ok' | 'error' };
    bagsApi: { status: 'configured' | 'missing'; baseUrl: string };
    heliusRpc: { status: 'configured' | 'missing'; endpoint: string };
    agentAuth: {
      status: 'configured' | 'partial' | 'missing';
      username: string | null;
      walletAddress: string | null;
    };
    signer: {
      status: 'configured' | 'not-required' | 'missing';
      source: 'private-key' | 'bags-agent' | 'none';
    };
  };
}

export class HealthService {
  constructor(
    private readonly db: Database,
    private readonly config: Config,
    private readonly runtime: {
      signerSource: 'private-key' | 'bags-agent' | 'none';
      resolvedAgentWalletAddress?: string | null;
    } = { signerSource: 'none', resolvedAgentWalletAddress: null },
  ) {}

  getSnapshot(params: {
    scheduledStrategies: number;
    version: string;
  }): HealthSnapshot {
    const databaseStatus = this.getDatabaseStatus();
    const bagsApiStatus = this.config.bagsApiKey ? 'configured' : 'missing';
    const heliusStatus = this.config.heliusRpcUrl ? 'configured' : 'missing';
    const agentStatus = this.getAgentStatus();
    const signerSource =
      this.runtime.signerSource !== 'none'
        ? this.runtime.signerSource
        : this.config.signerPrivateKey
          ? 'private-key'
          : 'none';
    const signerStatus = this.config.dryRun
      ? 'not-required'
      : signerSource !== 'none'
        ? 'configured'
        : 'missing';

    const degraded = (
      databaseStatus === 'error' ||
      bagsApiStatus === 'missing' ||
      heliusStatus === 'missing' ||
      signerStatus === 'missing'
    );

    return {
      status: degraded ? 'degraded' : 'ok',
      version: params.version,
      timestamp: new Date().toISOString(),
      scheduler: {
        scheduledStrategies: params.scheduledStrategies,
      },
      runtime: {
        dryRun: this.config.dryRun,
        killSwitchEnabled: this.config.executionKillSwitch,
        apiAuthProtected: Boolean(this.config.apiAuthToken),
        executionMode: this.config.executionKillSwitch
          ? 'blocked'
          : this.config.dryRun
            ? 'dry-run'
            : 'live',
      },
      dependencies: {
        database: { status: databaseStatus },
        bagsApi: {
          status: bagsApiStatus,
          baseUrl: this.config.bagsApiBaseUrl,
        },
        heliusRpc: {
          status: heliusStatus,
          endpoint: this.config.heliusRpcUrl,
        },
        agentAuth: {
          status: agentStatus,
          username: this.config.bagsAgentUsername || null,
          walletAddress: (
            this.runtime.resolvedAgentWalletAddress
            ?? this.config.bagsAgentWalletAddress
          ) || null,
        },
        signer: {
          status: signerStatus,
          source: signerSource,
        },
      },
    };
  }

  private getAgentStatus(): 'configured' | 'partial' | 'missing' {
    const hasToken = Boolean(this.config.bagsAgentJwt);
    const hasWallet = Boolean(this.config.bagsAgentWalletAddress || this.runtime.resolvedAgentWalletAddress);
    const hasUsername = Boolean(this.config.bagsAgentUsername);

    if (hasToken && hasWallet) {
      return 'configured';
    }

    if (hasToken || hasUsername) {
      return 'partial';
    }

    return 'missing';
  }

  private getDatabaseStatus(): 'ok' | 'error' {
    try {
      this.db.getDb().prepare('SELECT 1 as ok').get();
      return 'ok';
    } catch {
      return 'error';
    }
  }
}
