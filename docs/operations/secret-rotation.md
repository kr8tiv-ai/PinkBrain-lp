# Secret Rotation Checklist

Rotate these independently:

- `API_AUTH_TOKEN`
- `SESSION_SECRET`
- `BOOTSTRAP_TOKEN_SECRET`
- `REMOTE_SIGNER_AUTH_TOKEN`
- `REMOTE_SIGNER_PRIVATE_KEY`

## Routine Drill

1. Set `DRY_RUN=true`.
2. Set `EXECUTION_KILL_SWITCH=true`.
3. Rotate backend auth and session secrets.
4. Rotate the remote signer auth token.
5. Restart backend and remote signer.
6. Mint a fresh bootstrap token.
7. Sign into the dashboard with the new bootstrap token.
8. Run one dry-run cycle.
9. Clear the kill switch after verification.

## Emergency Rotation

1. Stop the remote signer.
2. Rotate every secret above.
3. Invalidate outstanding bootstrap tokens by rotating `BOOTSTRAP_TOKEN_SECRET`.
4. Restart services with the new values.
5. Verify `GET /api/readiness` and one dry-run manual execution before resuming live traffic.
