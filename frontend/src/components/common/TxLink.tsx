import { ExternalLink } from 'lucide-react';
import { txUrl, truncateAddress } from '../../utils/format';

export function TxLink({ signature }: { signature: string }) {
  return (
    <a
      href={txUrl(signature)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-pink-400 hover:text-pink-300 text-xs font-mono"
    >
      {truncateAddress(signature, 6)}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}
