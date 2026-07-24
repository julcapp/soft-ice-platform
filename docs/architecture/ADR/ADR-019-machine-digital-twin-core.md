# ADR-019: Machine Digital Twin Core

Date: 2026-07-23  
Status: Accepted

## Decision

Introduce `machine_digital_twin` as a separate modular-monolith bounded context.
It composes source adapters into immutable, read-oriented `MachineTwin`
projections, snapshots, normalized versioned events, and explainable health
scores. Admin API v1 is GET-only.

Snapshots use an in-memory repository in this increment; production durable
persistence remains an adapter decision and requires a migration before use.

## Consequences

Unavailable integrations remain visible as `FOUNDATION_ONLY` or
`BLOCKED_EXTERNAL`. The twin can evolve independently without moving business
authority out of the existing domains. Autonomous control and admin machine
commands are outside v1.
