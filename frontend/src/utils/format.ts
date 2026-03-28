/** Truncate a Solana address: AbCd...xYzW */
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/** Format a SOL amount with 4 decimal places */
export function formatSol(lamports: number): string {
  return (lamports / 1e9).toFixed(4);
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

/** Build a Solscan transaction URL */
export function txUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

/** Build a Solscan account URL */
export function accountUrl(address: string): string {
  return `https://solscan.io/account/${address}`;
}
