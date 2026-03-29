import { describe, expect, it, vi } from 'vitest';
import { ValidationService } from '../src/services/ValidationService.js';

describe('ValidationService', () => {
  it('rejects parsed token accounts that are not mint accounts', async () => {
    const service = new ValidationService({
      getParsedAccountInfo: vi.fn(async () => ({
        value: {
          owner: { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
          data: {
            program: 'spl-token',
            parsed: {
              type: 'account',
              info: {
                decimals: 9,
                supply: '0',
                isInitialized: true,
              },
            },
          },
        },
      })),
    } as any);

    const result = await service.validateTokenMint('So11111111111111111111111111111111111111112');

    expect(result.valid).toBe(false);
    expect(result.rule).toBe('NOT_TOKEN_MINT');
  });

  it('accepts parsed mint accounts', async () => {
    const service = new ValidationService({
      getParsedAccountInfo: vi.fn(async () => ({
        value: {
          owner: { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
          data: {
            program: 'spl-token',
            parsed: {
              type: 'mint',
              info: {
                decimals: 9,
                supply: '1000000',
                isInitialized: true,
              },
            },
          },
        },
      })),
    } as any);

    const result = await service.validateTokenMint('So11111111111111111111111111111111111111112');

    expect(result.valid).toBe(true);
    expect(result.decimals).toBe(9);
    expect(result.supply).toBe('1000000');
  });
});
