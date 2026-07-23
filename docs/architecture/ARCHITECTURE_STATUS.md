# Architecture Status

Status: Active
Document code: ARCH-002
Version: 2.0
Snapshot date: 2026-07-21
Project: Soft ICE Platform / «У Тимоши»

## Purpose

This document is the project baseline checkpoint for the current MVP platform. It records what is executable, what exists only as a foundation or contract, and which modules remain future work. Detailed domain documents and architecture decisions remain authoritative for behavior and boundaries.

## Baseline Summary

The repository contains an executable modular-monolith backend foundation, a React/Vite Mini App, authenticated customer-facing API slices, order-to-machine dispatch, a vendor-neutral machine gateway, a Huaxin-isolated gateway implementation, and a deterministic machine simulator.

The MVP is not production-launch-ready. Real payment execution is the principal missing link: the Payment module is still a foundation, while Sber and YooKassa adapters and payment webhooks are contract/configuration work rather than executable integrations.

Status terms used below:

- **Implemented** — executable code exists and is covered by repository validation.
- **Foundation** — schema, module boundary, or partial runtime exists, but the production capability is incomplete.
- **Documented** — architecture or integration contracts exist without executable runtime code.
- **Future** — intentionally recorded for a later increment.

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
