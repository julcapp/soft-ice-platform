# ADR — Equipment Integration Sandbox v1

Status: Accepted for implementation branch
Date: 2026-08-16

## Context

A vending-equipment supplier needs an integration surface for hardware testing. Giving the supplier access to the internal Soft_ICE API, repository, CRM, payment flows or business rules would couple vendor hardware to platform internals and unnecessarily expose intellectual property and customer/financial boundaries.

The platform already separates Machine Runtime state authority, Machine Gateway transport concerns, telemetry storage, Digital Twin projections, Inventory Runtime and Event Center.

## Decision

Introduce `Soft_ICE Equipment Integration API v1` as a vendor-neutral sandbox adapter.

The external supplier boundary:

- is mounted separately at `/equipment/v1`;
- is disabled by default;
- uses a dedicated sandbox API key;
- exposes only machine registration, heartbeat, status, telemetry, command polling/ACK, dispense results and equipment events;
- never exposes CRM, payments, customer identity, loyalty, database access or internal administrative APIs;
- uses stable `command_id` correlation and idempotent terminal results;
- keeps the first hardware-test state in memory and explicitly labels it `SANDBOX`.

Internal test control and dashboard projection are mounted under `/api/v1/admin/equipment` and require existing administrator authentication plus `ADMIN` or `PLATFORM_OWNER` role.

Admin Console gets a separate `Тестовый стенд оборудования` screen. Test data must never be visually represented as production data.

## Consequences

1. Supplier replacement does not require changing CRM/payment/loyalty contracts.
2. Hardware capability discovery can happen before a production vendor adapter is approved.
3. The first test can validate online state, sensor telemetry, command lifecycle, physical dispense success, failure codes and dashboard hypotheses.
4. In-memory state is acceptable only for the sandbox increment. Backend restart clears test state.
5. Production readiness still requires verified supplier protocol mapping, durable persistence, production machine credential provisioning, rate limiting and approved replay protection/mTLS/HMAC policy.
6. A supplier API key authenticates only an equipment actor and cannot create test commands or read internal admin projections.

## Related decisions

- DECISION-050 — Machine Simulator Implements the Vendor-Neutral Gateway Port
- DECISION-054 — Runtime State Authority and Event Transport Are Separate
- DECISION-055 — Inventory Runtime Owns Multi-Location Stock

## Related documentation

- `docs/api/EQUIPMENT_INTEGRATION_API_V1.md`
- `docs/api/openapi/equipment-integration-v1.yaml`
