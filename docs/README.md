# PinkBrain LP Docs Index

Public documentation in this repository is organized around operation, deployment, and known risk.

## Core Documents

- [../README.md](../README.md): repository overview and operator onboarding
- [../PRD.md](../PRD.md): product requirements and current implementation scope
- [runbook.md](./runbook.md): day-to-day operator workflow and incident response
- [deploy.md](./deploy.md): embedded deployment topologies and environment expectations
- [api-reference.md](./api-reference.md): operator-facing REST surface, auth model, and example payloads
- [known-risks.md](./known-risks.md): upstream dependency posture and external unknowns

## Operations

- [operations/remote-signer.md](./operations/remote-signer.md)
- [operations/secret-rotation.md](./operations/secret-rotation.md)

## Dependency Posture

- [dependency-audit.md](./dependency-audit.md)

## Internal Planning Notes

Tracked files under `docs/plans/` are working planning artifacts, not public product contracts. Keep the user-facing docs above in sync before relying on the planning notes as the source of truth.
