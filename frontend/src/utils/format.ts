/** Truncate a Solana address: AbCd...xYzW */
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

function parseInteger(value: number | string | bigint): bigint {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return 0n;
    }

    return BigInt(Math.trunc(value));
  }

  if (value.trim().length === 0) {
    return 0n;
  }

  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

/** Format a SOL amount with 4 decimal places using integer lamports. */
export function formatSol(lamports: number | string | bigint, fractionDigits = 4): string {
  const absolute = parseInteger(lamports);
  const isNegative = absolute < 0n;
  const normalized = isNegative ? -absolute : absolute;
  const whole = normalized / 1_000_000_000n;
  const fractional = normalized % 1_000_000_000n;
  const paddedFraction = fractional.toString().padStart(9, '0').slice(0, fractionDigits);

  return `${isNegative ? '-' : ''}${whole.toString()}.${paddedFraction}`;
}

/** Format an integer amount with grouping separators. */
export function formatInteger(value: number | string | bigint): string {
  const normalized = parseInteger(value).toString();
  const isNegative = normalized.startsWith('-');
  const digits = isNegative ? normalized.slice(1) : normalized;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return isNegative ? `-${grouped}` : grouped;
}

/** Format a date string to local short format */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format a duration in milliseconds into a compact operator-friendly label. */
export function formatDurationMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return 'n/a';
  }

  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/** Build a Solscan transaction URL */
export function txUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

/** Build a Solscan account URL */
export function accountUrl(address: string): string {
  return `https://solscan.io/account/${address}`;
}
