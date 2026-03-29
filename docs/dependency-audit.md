# Dependency Audit Status

Last verified: March 28, 2026

`npm audit --json` currently reports 14 advisories after the hardening pass.

## What We Already Reduced

- Upgraded the frontend toolchain to `vite@8` and `vitest@4`.
- Added root-level `overrides` for newer `axios`, Meteora SDKs, and other safe transitive packages.
- Added frontend tests so the upgraded toolchain is exercised in CI, not just built.

## What Still Remains

Most of the remaining high-severity findings are upstream in the Bags and Meteora SDK chain rather than in application code:

- `@bagsfm/bags-sdk`
- `@meteora-ag/cp-amm-sdk`
- `@meteora-ag/dynamic-bonding-curve-sdk`
- `@solana/spl-token`
- `bigint-buffer`

There are also a few residual transitive advisories tied to packages that ship inside upstream SDK trees:

- `axios`
- `mocha`
- `diff`
- `js-yaml`
- `minimatch`
- `nanoid`
- `serialize-javascript`
- `esbuild`

## Why We Are Not Forcing More Changes Locally

At this point the remaining advisories are constrained by upstream packages we do not control:

- `@bagsfm/bags-sdk` brings in its own Solana and Meteora dependency chain.
- `npm explain` shows `@bagsfm/bags-sdk@1.3.4` still pulling `@meteora-ag/cp-amm-sdk@1.1.0` internally, which in turn drags in `mocha`, `tsup`, and an older `esbuild` path.
- `@solana/spl-token` still depends on vulnerable `bigint-buffer` paths that do not have a clean local patch.
- Some SDK packages incorrectly ship test and build tooling like `mocha` in production dependency trees, which creates audit noise and a real but indirect supply-chain concern.

We can keep layering `overrides`, but beyond the current set that becomes progressively riskier because it may force versions the upstream SDK authors did not validate together.

## Recommended Next Step

The real fix is an upstream validation and upgrade campaign:

1. Track newer releases of `@bagsfm/bags-sdk`, Meteora SDKs, and Solana libraries.
2. Re-run `npm audit --json` after every SDK upgrade.
3. Prefer removing redundant direct dependencies if Bags exposes the needed functionality internally.
4. If the upstream graph stays blocked, consider vendoring or replacing the narrow SDK surface PinkBrain actually uses.

## Operator Guidance

For development and controlled operator use, the repo is materially safer than it started.

For production use, treat the remaining advisories as a known risk register item and re-validate before launch.
