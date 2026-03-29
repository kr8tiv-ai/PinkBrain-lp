# PinkBrain LP Known Risks and External Unknowns

This file collects the risks that still depend on upstream projects or real deployment conditions rather than repository-local fixes.

## 1. Upstream Dependency Advisories

The repository has already removed or reduced several local issues, but some advisories still sit inside third-party dependency chains tied to Bags, Meteora, Solana, and test tooling.

Canonical detail lives in [dependency-audit.md](./dependency-audit.md).

Treat these as:

- real items to monitor
- not evidence that the current repo is mishandling secrets or browser auth
- potentially blocked on upstream package releases rather than local code changes

## 2. Bags Embed Contract Unknowns

The codebase supports:

- iframe detection
- optional `window.bagsAgent`
- optional origin-scoped `postMessage` bridge

What is not publicly confirmed in official Bags docs today:

- a stable App Store iframe contract
- a guaranteed `window.bagsAgent` API surface
- an official `postMessage` schema for embedded apps

Because of that, PinkBrain LP treats Bags embed support as capability-detected context support, not a hard dependency for operator authentication or transaction signing.

## 3. External Signer Infrastructure

The repository supports a safer remote-signer boundary, but true production custody still depends on infrastructure outside this repo:

- network isolation for the signer
- secret storage and rotation
- host hardening
- real operational monitoring

The code can define the contract; it cannot harden the host for you.

## 4. Environment-Specific Browser Behavior

Embedded cookie behavior depends on:

- the actual deployment origins
- HTTPS correctness
- browser support for the chosen cookie attributes
- the real Bags-hosted iframe environment

That means embedded auth must be validated in the real target environment, not inferred only from local standalone development.

## 5. Live On-Chain Validation

The repo implements the control plane and execution logic, but any claim about:

- live strategy profitability
- current locked-liquidity totals
- real explorer links
- current production success rates

must be validated against the deployment you are operating, not assumed from the source tree alone.
