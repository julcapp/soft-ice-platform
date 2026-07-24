# Maintenance Runtime v1

Status: Implemented foundation  
Version: 1.0  
Date: 2026-07-24

## Boundary

Maintenance Runtime owns preventive/corrective plans, service-session lifecycle, checklist execution, evidence metadata, consumable-replacement references, test-dispense results, administrator decisions, immutable maintenance history, KPIs and the Admin Console projection.

It does not own machine state, stock balances, binary photo objects, operator identity, or Digital Twin source facts:

- Machine Runtime authorizes exclusive maintenance execution sessions.
- Inventory Runtime records maintenance consumption and remains stock authority.
- object storage owns photo bytes; Maintenance stores immutable key, media type, checksum and capture time.
- Machine Operations/Auth establish trusted actors and roles.
- Digital Twin consumes accepted maintenance facts as a read model.
- Platform Event Bus transports immutable facts and makes projection delivery idempotent.

## Workflows

Preventive work starts from a versioned plan assigned to one or more machines. Corrective work may start from an explicit issue and ad-hoc checklist. The operator identifies the machine by its registered QR value, opens one exclusive session, completes required checks, attaches evidence, records replacements and a test dispense, then submits. An ADMIN or PLATFORM_OWNER approves or rejects the submission.

Approved sessions are immutable. Rejected sessions retain their complete history. A new session is required for follow-up work.

## Authorization

| Role | Execute session | Manage plans | Approve | Read projection |
|---|---:|---:|---:|---:|
| OPERATOR | yes, own sessions | no | no | no |
| ADMIN | yes | yes | yes | yes |
| PLATFORM_OWNER | yes | yes | yes | yes |

Every command requires correlation and idempotency keys. Replaying identical input returns the original result; reusing the key for different input returns `MAINTENANCE_IDEMPOTENCY_CONFLICT`.

## Persistence and maturity

Prisma models and migration define the PostgreSQL target. The active v1 adapter is intentionally in-memory. Production requires a transactional repository/outbox, trusted QR provisioning, object-storage upload authorization, and verified physical test-dispense gateway orchestration.

## KPIs

The event-driven projection reports open sessions, pending approvals, approval rate, mean time to approval, and first-time test-pass rate across machines.
