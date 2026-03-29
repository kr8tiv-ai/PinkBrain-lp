import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import type {
  PublicKeyValidationResult,
  ScheduleValidationResult,
  TokenMintValidationResult,
} from '../types/strategy';

const MIN_SOLANA_ADDRESS_LENGTH = 32;

function hasMinimumAddressLength(value: string): boolean {
  return value.trim().length >= MIN_SOLANA_ADDRESS_LENGTH;
}

function buildPath(path: string, value: string): string {
  return `${path}?value=${encodeURIComponent(value)}`;
}

export function usePublicKeyValidation(value: string, enabled = true) {
  const trimmed = value.trim();
  return useQuery({
    queryKey: ['validation', 'public-key', trimmed],
    queryFn: () =>
      api.get<PublicKeyValidationResult>(
        buildPath('/api/validation/public-key', trimmed),
      ),
    enabled: enabled && hasMinimumAddressLength(trimmed),
    retry: false,
    staleTime: 60_000,
  });
}

export function useTokenMintValidation(value: string, enabled = true) {
  const trimmed = value.trim();
  return useQuery({
    queryKey: ['validation', 'token-mint', trimmed],
    queryFn: () =>
      api.get<TokenMintValidationResult>(
        buildPath('/api/validation/token-mint', trimmed),
      ),
    enabled: enabled && hasMinimumAddressLength(trimmed),
    retry: false,
    staleTime: 60_000,
  });
}

export function useScheduleValidation(value: string, enabled = true) {
  const trimmed = value.trim();
  return useQuery({
    queryKey: ['validation', 'schedule', trimmed],
    queryFn: () =>
      api.get<ScheduleValidationResult>(
        buildPath('/api/validation/schedule', trimmed),
      ),
    enabled: enabled && trimmed.length > 0,
    retry: false,
    staleTime: 60_000,
  });
}
