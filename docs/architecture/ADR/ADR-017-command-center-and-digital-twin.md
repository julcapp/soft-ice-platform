# ADR-017: Command Center and Digital Twin Foundation

Status: Accepted  
Date: 2026-07-23  
Scope: Documentation and architecture only

## Context

The owner needs one decision surface, while operators and domains need a coherent machine view. A central screen or twin could otherwise become an unsafe source of truth or bypass bounded contexts.

## Decision

Command Center is a read-oriented Executive surface over versioned, permission-scoped projections. Every KPI documents sources, formula owner, refresh/freshness, permission scope and drill-down.

Each machine Digital Twin is a read model assembled from Machine, Telemetry, Inventory, Catalog/Pricing, Advertising, Machine Operations, Orders and governed forecast facts. It is never authoritative for payment, inventory, identity or commands. Mutations hand off to owning-domain services and require separate authorization.

AI observations, forecasts and recommendations are separated from confirmed facts and remain advisory. AI cannot autonomously change prices, loyalty rules, payments, machine settings or operator assignments without a separately approved explicit policy.

## Consequences

Projection lag, partial state, provenance and reconciliation become visible interface concepts. Read-model implementation, storage, APIs and UI remain future increments.

## Status classification

Command Center is `DOCUMENTED_ONLY`. Digital Twin is `FOUNDATION_ONLY`. Runtime projections, UI and forecasting are `FUTURE`.

