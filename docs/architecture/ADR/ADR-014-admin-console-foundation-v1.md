# ADR-014: Admin Console Foundation v1

Status: Accepted
Date: 2026-07-23
Decision owners: Product Owner and Architecture
Scope: Architecture and contracts only

## Context

Soft ICE Platform needs one administrator workspace for commercial administration, operations oversight, reconciliation, reporting and audit. The workspace must not become a new owner of Customer, Catalog, Pricing, Payment, Order, Machine, Machine Operations, Inventory or Advertising data.

The platform already requires separate Customer, Operator and Administrator interfaces, backend-enforced authorization, append-only history for sensitive facts and explicit contracts between bounded contexts. Admin Console Foundation v1 turns those constraints into an implementable architecture without defining UI or changing runtime behavior.

## Decision

Admin Console is a separate interface and application boundary. It is a policy-enforced orchestration and projection consumer, not a business-data bounded context.

The foundation consists of:

1. an Admin Backend-for-Frontend (Admin BFF) that authenticates administrator sessions, evaluates route-level permissions, composes read models and delegates commands;
2. owning-domain administration APIs that validate permissions, invariants, idempotency and command intent;
3. reporting projections built from governed domain facts;
4. a common audit pipeline for privileged reads, commands, approvals, exports and permission changes.

The Admin BFF must not write another context's tables, reproduce domain rules, calculate authoritative totals or convert a report projection into a source of truth.

## Bounded contexts and ownership

| Context | Administrative capability | Source-of-truth ownership |
|---|---|---|
| Identity and Access | administrator identity, roles, permissions, scopes, sessions and access review | Identity and Security |
| Customer and Consent | permission-scoped customer lookup, support view and approved consent history | Customer Identity and Consent |
| Catalog and Commercial Configuration | products, availability and commercial configuration | Product/Catalog, Configuration and Pricing |
| Order and Payment | order support, payment state, refund request, settlement and reconciliation | Order, Payment and Finance |
| Machine | fleet state, telemetry summary and command eligibility | Machine |
| Machine Operations | assignments, tasks, checklist versions, service evidence and report approval | Machine Operations |
| Inventory | stock ledger, replenishment, test/service consumption, waste, corrections and reconciliation | Inventory |
| Advertising | advertiser, campaign, creative, placement and attribution administration | Advertising |
| Reporting | versioned cross-domain read models and exports | Reporting projections; never source facts |
| Audit | privileged activity evidence and access history | Audit/Security infrastructure |

Admin Console owns only navigation, presentation composition, saved administrator preferences and orchestration state that has no independent business meaning.

## API architecture

All endpoints are versioned under `/api/v1/admin`. Names below define resource and command boundaries, not executable routes.

### Query contracts

| Contract | Purpose |
|---|---|
| `GET /session` | Return administrator identity, effective permissions, scopes and session constraints. |
| `GET /dashboard/operations` | Return freshness-labelled fleet, task, incident and inventory projection. |
| `GET /dashboard/commercial` | Return freshness-labelled sales, payment, product and campaign projection. |
| `GET /customers`, `GET /customers/{id}` | Permission-scoped customer/support projection with field-level redaction. |
| `GET /orders/{id}`, `GET /payments/{id}` | Cross-linked support projection without exposing provider secrets. |
| `GET /machines`, `GET /machines/{id}` | Fleet state and permitted operational drill-down. |
| `GET /operations/tasks`, `GET /operations/reports/{id}` | Machine Operations work and review projection. |
| `GET /inventory/machines/{id}` | Stock position, movements, variance and provenance. |
| `GET /advertising/campaigns`, `GET /advertising/campaigns/{id}` | Advertising lifecycle and governed performance projection. |
| `GET /reports/{reportKey}` | Versioned report query with explicit dimensions, filters and freshness. |
| `GET /audit/events` | Permission-scoped immutable audit search. |

List contracts use opaque cursors, bounded page sizes, stable filters and deterministic ordering. Every response includes `generated_at`, `data_freshness`, `source_versions` and a `correlation_id` where composition spans contexts.

### Command contracts

Commands use explicit action resources rather than generic record updates:

- `POST /commercial/price-change-requests`;
- `POST /operations/tasks/{id}/assign`;
- `POST /operations/service-reports/{id}/approve`;
- `POST /operations/service-reports/{id}/reject`;
- `POST /inventory/corrections`;
- `POST /payments/{id}/refund-requests`;
- `POST /advertising/campaigns/{id}/submit`;
- `POST /advertising/campaigns/{id}/activate`;
- `POST /advertising/campaigns/{id}/pause`;
- `POST /access/role-assignments`;
- `POST /exports`.

Every command carries authenticated actor context, target scope, reason, idempotency key and correlation ID. High-risk commands also carry an expected version and, where policy requires it, an approval reference. The owning service returns accepted, rejected, pending approval or conflict; the Admin BFF cannot translate rejection into success.

Bulk mutation is not part of v1. Exports are asynchronous, time-limited, watermarked where appropriate and audited.

## Authorization model

Authorization combines role permissions with resource scope and contextual constraints:

```text
allow = authenticated administrator
  AND explicit permission
  AND resource within assigned scope
  AND command satisfies domain policy
  AND required approval or step-up authentication is present
```

Initial permission bundles are composable, not hard-coded superuser tiers:

| Bundle | Representative permissions |
|---|---|
| Support | customer/order lookup, safe payment status, support notes through owning contract |
| Operations Dispatcher | fleet view, task assignment and escalation |
| Operations Reviewer | evidence review and service-report approval/rejection |
| Inventory Controller | stock ledger, reconciliation and correction request |
| Commercial Manager | catalog/commercial configuration and price-change request |
| Finance/Reconciliation | payment, settlement, refund and reconciliation views/actions |
| Advertising Manager | advertiser/campaign/creative/placement lifecycle |
| Auditor | read-only audit, reconciliation and export access |
| Access Administrator | role assignment and access review; no implicit business permissions |

Scopes may restrict organization, region, location, machine group or specific machine. Field-level policies redact personal, financial and security-sensitive data. Break-glass access is time-bound, reasoned, strongly authenticated and separately alerted. Deny is the default; role or permission changes never apply retroactively to an existing audit fact.

## Admin dashboards

Dashboards are read-only projections with drill-down links into owning workflows:

- Operations Control: online/offline machines, degraded health, active incidents, overdue tasks, pending service reviews and inventory risk.
- Commercial Pulse: paid orders, gross sales, refunds, average order value, product mix and machine/location comparison.
- Finance and Reconciliation: provider/ledger/order mismatches, unsettled payments, refund status and reconciliation aging.
- Inventory Control: expected stock, telemetry or count variance, refill/test/waste movements, stockout risk and unresolved corrections.
- Advertising Operations: campaign lifecycle, creative review, placement availability, attributed clicks/conversions and consent-gated eligibility failures.
- Audit and Access: privileged activity, denied actions, break-glass use, exports and access changes.

Each metric declares owner, definition version, time zone, currency/unit, inclusion rules, freshness target and drill-down contract. A dashboard must show stale/partial/unavailable state instead of silently displaying a last-known value as current.

## Reporting architecture

Reporting is a separate read-model capability fed by accepted domain events, governed snapshots and reconciliation outputs. Reports never invoke domain commands.

Required v1 report families are sales and product mix, machine performance, payment/reconciliation, inventory movement and variance, operator work/SLA, advertising performance and audit/access review.

Reports support scoped filters, explicit period and time zone, metric-definition version, reproducible parameters and CSV export. Personally identifiable fields are excluded by default and require a separate permission and stated purpose. Corrections are made in the owning context and appear in the next projection; administrators never edit report totals.

## Operator workflows

Admin Console coordinates these v1 workflows through Machine Operations and related contracts:

1. Triage an alert or overdue task and inspect machine, assignment, stock and recent service context.
2. Create or assign a maintenance task with priority, due time and immutable checklist version.
3. Monitor execution without impersonating the operator.
4. Review submitted evidence, checklist results, tests, faults and linked inventory movements.
5. Approve or reject the service report with a required reason.
6. Escalate unresolved machine, stock or safety conditions through an explicit task/incident reference.

An administrator may perform a maintenance/test operation only through the same Machine Operations validation used for operators plus the required administrator permission. Admin Console cannot fabricate completion, rewrite evidence or directly command a vendor adapter.

## Inventory integration

Inventory remains an independent source-of-truth ledger. Admin Console reads stock position and movements and submits correction/reconciliation commands.

The integration must preserve:

- machine, material, quantity, unit, movement type, source reference, actor and timestamp;
- separation of sales, refill, test/service, waste and corrective movements;
- batch/expiry fields when those capabilities are introduced;
- expected-versus-observed count and variance;
- immutable original movements and explicit corrective movements;
- correlation from a service task or test operation to every resulting movement.

Low-stock and variance signals may create dashboard alerts or proposed tasks, but they do not autonomously alter stock or task state in v1.

## Advertising integration

Admin Console uses Advertising contracts to manage advertisers, campaigns, creative versions, placements and referral/attribution references. Media assets remain owned by Media Library.

Campaign activation requires Advertising-owned lifecycle validation, creative approval, permitted placement, operating window and all applicable privacy/consent rules. Admin Console may display eligibility and consent-gate aggregates but must not expose customer-level targeting data without an independently approved purpose and permission.

Targeting, ranking, bidding, pacing, frequency capping and automatic optimization remain deferred. Admin Console does not infer or implement them.

## Audit model

Every privileged mutation, approval, denial, export, permission change, break-glass action and sensitive read produces an append-only audit event.

Minimum envelope:

```text
audit_event_id
occurred_at
actor_id, actor_type, session_id
effective_roles, effective_permissions, resource_scope
action, target_type, target_id
request_id, correlation_id, idempotency_key
reason, approval_reference
outcome, policy_decision, error_code
before_reference, after_reference
source_ip/device metadata (security-controlled)
data_classification
retention_class
integrity_reference
```

Audit stores references or safe diffs, not credentials, tokens, raw payment payloads or unnecessary personal data. Audit records are immutable and tamper-evident; access to them is itself audited. Domain records remain authoritative for business state.

## Consequences

- Admin implementation can proceed incrementally without centralizing domain ownership.
- Each owning context must expose stable query/command contracts before its administrator workflow is enabled.
- Projection lag and partial failure become explicit product states.
- Authorization and audit are backend requirements, not UI acceptance criteria.
- Cross-domain convenience requires contract composition and cannot justify direct database joins for writes.

## Out of scope

This decision implements no UI, API route, schema, permission middleware, projection, integration or business logic. Executive Console and AI-assisted supervision are governed by ADR-015.

## Related documentation

- `docs/architecture/PLATFORM_BOUNDARIES.md`
- `docs/architecture/PLATFORM_ROLES_AND_ACCESS.md`
- `docs/architecture/PLATFORM_DATA_FLOWS.md`
- `docs/domain/MACHINE_OPERATIONS_PLATFORM.md`
- `docs/domain/ADVERTISING_PLATFORM.md`
- `docs/architecture/ADR/ADR-015-executive-console-and-ai-supervisor.md`
