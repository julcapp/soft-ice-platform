# Digital Twin Foundation v1

Status: Approved  
Version: 1.0  
Date: 2026-07-23  
Classification: FOUNDATION_ONLY

## Definition

A machine Digital Twin is a read-oriented, time-aware projection that assembles trusted domain facts into one operational machine view. The foundation is documented; no dedicated twin runtime or persistence is introduced by this decision.

The twin is not the source of truth for machine identity, payments, inventory, customers or authorization. Commands always pass through authenticated owning-domain services and vendor-neutral machine contracts.

## Required projection

| Group | Fields | Authority |
|---|---|---|
| Identity/location | machine ID, display name, vendor-neutral model, organization, location, coordinates | Machine / Location |
| Connectivity | online state, last heartbeat, freshness, gateway health | Machine Gateway / Telemetry |
| Operation | current operational state, active faults, temperature, normalized telemetry | Machine |
| Inventory | cups, mix, toppings, observed/expected time and confidence | Inventory plus telemetry evidence |
| Commercial | current menu, active price, active advertising placement | Catalog/Pricing/Advertising |
| People/work | assigned operator, open service tasks, last maintenance | Machine Operations |
| Verification | recent test runs and outcomes | Machine Operations |
| Performance | recent sales summary | Orders/Payments reporting |
| Prediction | predicted refill need, horizon, confidence, evidence | governed forecasting projection |

Every field carries `sourceDomain`, `sourceRecordId` where permitted, `observedAt` or `effectiveAt`, `recordedAt`, freshness classification and projection version. Sensitive or permission-restricted values are redacted before composition.

## State and consistency

The twin may be current, stale, partial, unavailable or rebuilding. It must never present stale data as live. Contradictions are surfaced with source references; the twin does not silently select a new authoritative fact. Eventual consistency is expected and visible.

Vendor-specific telemetry and fault codes are authenticated, deduplicated and normalized before entering platform domains. Raw vendor payloads do not become the public twin contract.

## Commands

The Digital Twin UI may offer a permission-aware handoff such as `Open service task` or `View machine command eligibility`. It cannot write source projections or bypass Machine, Inventory, Pricing, Advertising, Payment or Machine Operations services.

## Governance

Projection ownership belongs to Reporting/Machine Read Models. Source ownership remains in each domain. Retention, replay, rebuild, schema version, lag objective and reconciliation rules are required before implementation. Forecasts and inferred values are labelled and never overwrite observed facts.

