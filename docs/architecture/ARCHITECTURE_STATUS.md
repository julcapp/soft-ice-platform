# Architecture Status

Status: Active
Document code: ARCH-002
Version: 3.0
Snapshot date: 2026-07-23
Project: Soft ICE Platform / «У Тимоши»

## Purpose

This document is the project baseline checkpoint for the current MVP platform. It records what is executable, what exists only as a foundation or contract, and which modules remain future work. Detailed domain documents and architecture decisions remain authoritative for behavior and boundaries.

## Baseline Summary

The repository contains an executable modular-monolith backend foundation, a React/Vite Mini App, authenticated customer-facing API slices, order-to-machine dispatch, a vendor-neutral machine gateway, a Huaxin-isolated gateway implementation, and a deterministic machine simulator.

The MVP is not production-launch-ready. Real payment execution is the principal missing link: the Payment module is still a foundation, while Sber and YooKassa adapters and payment webhooks are contract/configuration work rather than executable integrations.

The 2026-07-23 Master Architecture Map v1 establishes the authoritative eight-area platform structure, mandatory access boundaries, high-level cross-platform data flows and architecture governance rules. It incorporates the Machine Operations checkpoint, central CRM/Admin Console role, future consent-controlled Advertising Platform, vendor-neutral Machine Gateway boundary and shared infrastructure responsibilities. These map additions are documentation decisions and do not claim new runtime implementation.

Status terms used below:

- **Implemented** — executable code exists and is covered by repository validation.
- **Foundation** — schema, module boundary, or partial runtime exists, but the production capability is incomplete.
- **Documented** — architecture or integration contracts exist without executable runtime code.
- **Future** — intentionally recorded for a later increment.

## Master Architecture Baseline v1

| Platform area | Baseline status | Current architecture position |
|---|---|---|
| Customer Platform | Implemented foundation / Future extensions | Telegram Mini App and authenticated customer/Club Account surfaces exist. Complete checkout, loyalty/referral engines, production customer payments and the advertising carousel remain incomplete or future. |
| CRM and Admin Console | Documented / Future | Defined as the central permission-scoped management surface for customers, loyalty, commercial settings, products/menu, payments/reconciliation, reports, advertising, operator oversight, system configuration and audit. It does not absorb owning domains. |
| Machine Platform | Implemented foundation | Machine Domain, vendor-neutral `MachineGateway`, Huaxin-isolated adapter boundary and deterministic simulator exist. Production physical transport, hardware validation and full inventory/fulfillment hardening remain incomplete. |
| Machine Operations Platform | Implemented foundation / Future extensions | Backend domain foundation exists for assignments, tasks, checklists, service reports, tests, inventory movements and evidence metadata. Scheduling, routes, GPS, offline mode and batch tracking are future. |
| Payment Platform | Foundation / Documented adapters | Payment models and provider-independent contracts exist. YooKassa, Sber, SBP QR, authenticated provider webhooks and production reconciliation are not executable end to end. |
| Advertising Platform | Documented / Future | Entities, access gates and boundaries are documented. No delivery, click collector, conversion runtime, reporting runtime or advertising management UI is implemented. |
| Identity and Security Platform | Implemented foundation / Future providers | Telegram customer authentication, canonical customer identity, verified-phone boundary, sessions, audit/idempotency foundations and consent records exist. Production SberID/MAX and complete operator/administrator authorization surfaces remain future or incomplete. |
| Infrastructure Platform | Implemented foundation | Configuration, structured logging, metrics primitives, health checks, domain-event foundations, idempotency, errors, PostgreSQL/Prisma and deployment foundations exist. Production monitoring and operational hardening remain incomplete. |

Authoritative high-level documents:

- `docs/architecture/SOFT_ICE_PLATFORM_MAP.md`;
- `docs/architecture/PLATFORM_BOUNDARIES.md`;
- `docs/architecture/PLATFORM_ROLES_AND_ACCESS.md`;
- `docs/architecture/PLATFORM_DATA_FLOWS.md`;
- `docs/architecture/ARCHITECTURE_GOVERNANCE.md`.

## Mandatory Platform Boundaries

- Only an authorized administrator may change prices, product commercial settings, loyalty rules or advertising configuration.
- Operators are limited to assigned-machine service, approved tests, inventory movements, evidence and service-report submission.
- Every test dispense creates non-sale inventory consumption records that participate in reconciliation.
- Administrators can view and audit every operator action.
- Advertising requires an authenticated customer, at least a verified phone and all required active consents.
- Customer, Operator and Administrator interfaces remain separate.
- Vendor-specific machine behavior remains behind `MachineGateway` adapters.
- Permissions are enforced by backend policy and owning services, not only by interface controls.

## Current MVP Modules

| Module | Status | Current implementation |
|---|---|---|
| Auth Core | Implemented | Telegram Mini App init-data verification, opaque hashed bearer sessions, customer authentication middleware, audit/idempotency integration, and session creation through `POST /api/v1/auth/telegram-mini-app/sessions`. SberID is not included. |
| Customer Portal | Implemented foundation | Authenticated own-profile, Club Account, account history, customer-order and Mini App bootstrap API surfaces exist. The portal is an MVP customer API surface, not a complete profile-management product. |
| Payment Core | Foundation | Prisma payment models, the Payment module boundary, provider-independent architecture, ledger/settlement contracts, and frontend payment repository/service abstractions exist. Production payment intent/session execution, reconciliation, refunds, and provider-backed settlement are not implemented. |
| Sber adapter | Documented / not executable | Sber/SBP is retained as an approved provider direction in payment architecture. No backend Sber provider adapter, credentials flow, or production API integration is present in this snapshot. |
| YooKassa adapter | Documented / configured / not executable | YooKassa architecture, settlement mapping, integration documentation, and environment configuration are present. No backend provider client or production adapter executes YooKassa operations in this snapshot. |
| Webhooks | Documented / not executable | Webhook authentication, normalization, idempotency, replay protection, and routing rules are documented. No production payment-provider webhook handler is mounted in the backend. |
| Machine Gateway | Implemented | `MachineGateway` defines the vendor-neutral port. The gateway runtime owns session lifecycle, heartbeat freshness, reconnect policy, serialized command execution, telemetry retention, error normalization, metrics, and authenticated machine gateway API routes. |
| Huaxin Gateway | Implemented adapter boundary | Huaxin-specific XML construction/parsing, command mapping, session behavior, error translation, and telemetry normalization are isolated in `backend/src/modules/machine_gateway`. The physical network/serial transport and production credentials remain deployment-specific and are not stored in the repository. |
| Machine Simulator | Implemented | A deterministic `MachineGateway` implementation models lifecycle, heartbeat, telemetry, inventory consumption, scripted/seeded dispense outcomes, and machine faults for development and automated end-to-end flow testing. |
| Mini App backend | Implemented foundation | Express API v1 exposes Telegram session creation, customer profile/bootstrap, Club Account, order, dispense, Telegram, machine, and machine-gateway routes over Prisma-backed runtimes. Production payment routes are not mounted. |
| Mini App frontend | Implemented prototype | React/Vite provides the home and product-selection flow, consent handling, analytics hooks, shared design primitives, and domain repositories/services. It is not yet wired to a complete production checkout, provider payment, or live fulfillment journey. |

## Machine Operations Architecture Checkpoint

| Area | Accepted status |
|---|---|
| Bounded context | Machine Operations is separate from CRM; CRM/Admin Console provides central oversight through explicit contracts. |
| Operator App | Assigned machines, maintenance tasks, versioned checklists, refills, test runs, photo evidence, fault reports and service-report submission. |
| Operator restrictions | No prices, commercial machine settings, loyalty rules, advertising or customer management. |
| Administrator | Commercial administration through owning domains, checklist configuration, task assignment/review, complete operator audit, service-report approval/rejection and emergency maintenance/test execution. |
| Test inventory | `TEST_CUP`, `TEST_ICECREAM`, `TEST_TOPPING`, `TEST_FULL_CYCLE`, `CALIBRATION`, `CLEANING` and `WASTE` movements are distinct from sales and included in total reconciliation. |
| Future Operator App | Before/after evidence, batches/expiry, GPS, scheduling, routes, offline mode, digital acceptance and senior operator role. |
| Advertising | Authenticated customer plus verified phone minimum, mandatory consent, separate core entities; delivery algorithms deferred. |

CRM/Admin Console remains the central management system for customers, loyalty, payments, reports, analytics, commercial settings, operator monitoring, Machine Operations oversight and future advertising management. Central management does not transfer bounded-context ownership.

## Governance Status

Architecture Governance v1 is approved. Every new module requires a domain document; every major architecture choice requires an ADR; application code must depend on ports instead of vendor-specific adapters; and each implementation slice must update applicable tests, API/event contracts, test scenarios, changelog and Architecture Status.

All future status updates must distinguish Implemented, Foundation, Documented and Future functionality. Roadmap placement is not evidence of implementation.

## Implemented MVP Flow

The executable baseline supports this controlled flow:

```text
Telegram Mini App authentication
  -> customer identity and session
  -> customer/Club Account access
  -> order creation
  -> accepted payment confirmation inside the current MVP runtime boundary
  -> paid-order dispense request
  -> MachineGateway command
  -> Huaxin-isolated gateway or deterministic simulator
  -> dispense result returned to Machine and Order runtimes
```

This flow does not mean that a real provider payment is production-ready. Payment confirmation currently lacks an executable Sber/YooKassa adapter and verified provider webhook path.

## Module Boundaries

- Auth Core establishes actor identity and access context; it does not decide payment, order, price, loyalty, promotion, or machine outcomes.
- Customer Runtime owns canonical customer records; Telegram and future SberID identities are external aliases.
- Payment Core must normalize provider facts and establish accepted payment state before Order or Club Account reacts.
- Webhooks must authenticate, validate, deduplicate, normalize, and route provider facts; they must not directly mark orders paid or dispatch machines.
- Order Runtime owns order state and accepts only approved payment facts.
- Machine Runtime owns platform machine and dispense-request transitions.
- Machine gateways translate between the vendor-neutral machine port and vendor/deployment protocols; they do not own business decisions.
- The simulator is interchangeable with production gateways and cannot import Huaxin protocol behavior.
- Mini App screens consume runtime/domain services and must not become owners of pricing, media, payment, or fulfillment rules.

## Known Future Modules

| Module | Status | Intended responsibility |
|---|---|---|
| Customer Profile Core | Future | Profile completion and editing, contact and identity-link management, consent/preferences, and customer-facing profile history behind canonical `customer_id`. |
| Loyalty Engine | Future | Loyalty eligibility, accrual, redemption, tier/status, and Club Timofey policy through explicit runtime contracts. Existing Club Account and frontend loyalty foundations are not the complete engine. |
| Promotion Engine | Future | Campaign eligibility, promotion lifecycle, stacking/priority policy, and promotion effects coordinated with pricing and discount boundaries. |
| Analytics Engine | Future | Governed event ingestion, metrics, funnels, operational/business reporting, and analytical projections. Existing frontend event hooks and backend operational metrics are inputs, not the complete engine. |
| SberID authentication | Future | SberID identity verification and linking as an external identity provider resolved to canonical `customer_id`; it must not replace Auth Core ownership. |

## Readiness and Gaps

| Area | Baseline readiness | Primary gap |
|---|---|---|
| Authentication and customer access | MVP foundation implemented | Token lifecycle hardening, broader authorization, profile completion, and SberID. |
| Order and machine dispatch | MVP foundation implemented | Production operational hardening and verified physical transport. |
| Machine integration | Gateway and simulator implemented | Confirmed production Huaxin transport, credentials, hardware validation, and safety certification. |
| Payments | Architecture/foundation only | Executable provider adapters, verified webhooks, settlement/reconciliation, refunds, and end-to-end tests. |
| Mini App | Prototype/foundation implemented | Backend API wiring for the complete checkout/payment/fulfillment journey and production UX hardening. |
| Loyalty, promotions, analytics | Future | Dedicated engines and approved runtime contracts. |

## Baseline Verdict

Soft ICE Platform has an executable customer, order, and machine integration foundation, including both Huaxin-isolated and simulated gateway paths. The commercial MVP remains incomplete until a real payment provider adapter, authenticated/idempotent webhooks, accepted settlement flow, and end-to-end Mini App checkout are implemented and validated against a physical machine.
