# Remote Signer Deployment

PinkBrain's preferred production posture is an isolated remote signer.

## Purpose

- Keep long-lived signing keys off the main backend host.
- Narrow the signing surface to a single `/sign-and-send` endpoint.
- Make future KMS or HSM adapters possible behind the same contract.

## Start the Signer

```powershell
$env:REMOTE_SIGNER_AUTH_TOKEN="change_me"
$env:REMOTE_SIGNER_PRIVATE_KEY="..."
$env:REMOTE_SIGNER_RPC_URL="https://mainnet.helius-rpc.com/?api-key=..."
npm run remote-signer -w backend
```

## Point the Backend at It

```env
REMOTE_SIGNER_URL=https://remote-signer.internal
REMOTE_SIGNER_AUTH_TOKEN=change_me
REMOTE_SIGNER_TIMEOUT_MS=10000
SIGNER_PRIVATE_KEY=
ALLOW_AGENT_WALLET_EXPORT=false
```

## Contract

`POST /sign-and-send`

Request:

```json
{
  "serializedTx": "<base64>",
  "skipPreflight": false,
  "confirmationContext": {
    "blockhash": "...",
    "lastValidBlockHeight": 123
  },
  "extraSignerPrivateKeys": ["[1,2,3]"]
}
```

Response:

```json
{
  "signature": "<tx-signature>"
}
```

## Future KMS/HSM Path

If you replace the keypair-backed signer, keep the same HTTP contract and swap the signer implementation behind the remote process. That preserves the main backend integration while allowing AWS KMS, HashiCorp Vault, or HSM-backed signing later.
