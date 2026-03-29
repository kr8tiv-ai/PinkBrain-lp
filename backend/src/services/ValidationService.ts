import { PublicKey, type Connection } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { StrategyValidationError } from './errors.js';
import { assertValidStrategySchedule, getNextScheduledRun } from '../utils/cron.js';

export interface PublicKeyValidationResult {
  value: string;
  valid: boolean;
  normalized: string | null;
  rule: string | null;
  message: string;
}

export interface TokenMintValidationResult {
  value: string;
  valid: boolean;
  normalized: string | null;
  rule: string | null;
  message: string;
  ownerProgram: string | null;
  decimals: number | null;
  supply: string | null;
  isInitialized: boolean | null;
}

export interface ScheduleValidationResult {
  value: string;
  valid: boolean;
  rule: string | null;
  message: string;
  nextRunAt: string | null;
}

export class ValidationService {
  constructor(private readonly connection: Pick<Connection, 'getParsedAccountInfo'>) {}

  validatePublicKey(value: string): PublicKeyValidationResult {
    try {
      const normalized = new PublicKey(value).toBase58();
      return {
        value,
        valid: true,
        normalized,
        rule: null,
        message: 'Valid Solana public key',
      };
    } catch {
      return {
        value,
        valid: false,
        normalized: null,
        rule: 'INVALID_PUBLIC_KEY',
        message: 'Invalid Solana public key',
      };
    }
  }

  async validateTokenMint(value: string): Promise<TokenMintValidationResult> {
    const keyValidation = this.validatePublicKey(value);
    if (!keyValidation.valid || !keyValidation.normalized) {
      return {
        value,
        valid: false,
        normalized: null,
        rule: keyValidation.rule,
        message: keyValidation.message,
        ownerProgram: null,
        decimals: null,
        supply: null,
        isInitialized: null,
      };
    }

    try {
      const account = await this.connection.getParsedAccountInfo(new PublicKey(keyValidation.normalized));
      if (!account?.value) {
        return {
          value,
          valid: false,
          normalized: keyValidation.normalized,
          rule: 'TOKEN_MINT_NOT_FOUND',
          message: 'Token mint account was not found on-chain',
          ownerProgram: null,
          decimals: null,
          supply: null,
          isInitialized: null,
        };
      }

      const ownerProgram = account.value.owner.toBase58();
      const validProgram = ownerProgram === TOKEN_PROGRAM_ID.toBase58()
        || ownerProgram === TOKEN_2022_PROGRAM_ID.toBase58();

      if (!validProgram) {
        return {
          value,
          valid: false,
          normalized: keyValidation.normalized,
          rule: 'NOT_TOKEN_MINT',
          message: 'Account exists but is not owned by a token mint program',
          ownerProgram,
          decimals: null,
          supply: null,
          isInitialized: null,
        };
      }

      const parsed = typeof account.value.data === 'object' && account.value.data && 'parsed' in account.value.data
        ? (account.value.data as { parsed?: { type?: string; info?: Record<string, unknown> } }).parsed
        : undefined;

      const decimals = typeof parsed?.info?.decimals === 'number' ? parsed.info.decimals : null;
      const supply = parsed?.info?.supply ? String(parsed.info.supply) : null;
      const isInitialized = typeof parsed?.info?.isInitialized === 'boolean'
        ? parsed.info.isInitialized
        : null;
      const parsedType = typeof parsed?.type === 'string' ? parsed.type : null;

      if (parsedType !== 'mint') {
        return {
          value,
          valid: false,
          normalized: keyValidation.normalized,
          rule: 'NOT_TOKEN_MINT',
          message: 'Account exists but is not a token mint',
          ownerProgram,
          decimals,
          supply,
          isInitialized,
        };
      }

      return {
        value,
        valid: true,
        normalized: keyValidation.normalized,
        rule: null,
        message: 'Valid token mint',
        ownerProgram,
        decimals,
        supply,
        isInitialized,
      };
    } catch {
      return {
        value,
        valid: false,
        normalized: keyValidation.normalized,
        rule: 'RPC_ERROR',
        message: 'RPC error while validating token mint',
        ownerProgram: null,
        decimals: null,
        supply: null,
        isInitialized: null,
      };
    }
  }

  validateSchedule(value: string, from = new Date()): ScheduleValidationResult {
    try {
      assertValidStrategySchedule(value);
      return {
        value,
        valid: true,
        rule: null,
        message: 'Valid schedule',
        nextRunAt: getNextScheduledRun(value, from)?.toISOString() ?? null,
      };
    } catch (error) {
      if (error instanceof StrategyValidationError) {
        return {
          value,
          valid: false,
          rule: error.rule,
          message: error.message,
          nextRunAt: null,
        };
      }

      return {
        value,
        valid: false,
        rule: 'INVALID_CRON_FORMAT',
        message: 'Invalid schedule',
        nextRunAt: null,
      };
    }
  }

  assertPublicKey(value: string, field: string): void {
    const result = this.validatePublicKey(value);
    if (!result.valid) {
      throw new StrategyValidationError(field, result.rule ?? 'INVALID_PUBLIC_KEY', value);
    }
  }

  async assertTokenMint(value: string, field: string): Promise<void> {
    const result = await this.validateTokenMint(value);
    if (!result.valid) {
      throw new StrategyValidationError(field, result.rule ?? 'TOKEN_MINT_NOT_FOUND', value);
    }
  }

  assertSchedule(value: string): void {
    const result = this.validateSchedule(value);
    if (!result.valid) {
      throw new StrategyValidationError('schedule', result.rule ?? 'INVALID_CRON_FORMAT', value);
    }
  }
}

export function createValidationService(
  connection: Pick<Connection, 'getParsedAccountInfo'>,
): ValidationService {
  return new ValidationService(connection);
}
