# Soft ICE Platform Master Architecture Map

Status: Approved
Document code: ARCH-MAP-001
Version: 1.0
Effective date: 2026-07-23
Project: Soft ICE Platform / «У Тимоши»

## Purpose

This document is the authoritative high-level map of the Soft ICE Platform. It defines the platform areas, their primary responsibilities, the relationships between them and the status language used to describe delivery.

Detailed domain documents, API contracts and accepted architecture decision records (ADRs) remain authoritative within their scope. If a detailed document conflicts with a boundary in this map, the conflict must be resolved through the architecture governance process before implementation continues.

## MVP Mission

```text
A customer can select a dessert, pay for it and receive it from a vending machine.
```

The platform supports that mission through separate customer, administration, machine, operations, payment, advertising, identity/security and infrastructure areas. A shared interface does not transfer ownership between domains.

## Status Language

Every architecture and delivery document must use these terms consistently:

| Status | Meaning |
|---|---|
| **Implemented** | Executable code exists and has repository validation appropriate to the slice. |
| **Foundation** | A schema, module boundary, adapter port or partial runtime exists, but the production capability is incomplete. |
| **Documented** | Architecture, domain or integration contracts exist without an executable production capability. |
| **Future** | The capability is intentionally deferred and requires a separately approved increment. |

No document may describe a documented contract or foundation as production-ready implementation.

## Platform Context

```text
Customer interfaces
  -> Identity and Security
  -> Customer / Catalog / Loyalty / Advertising capabilities
  -> Checkout and Payment
  -> Order and fulfillment decision
  -> Machine Platform
  -> Physical dispense

Operator App
  -> Identity and Security
  -> Machine Operations Platform
  -> Inventory and Machine Platform

CRM and Admin Console
  -> Identity and Security
  -> owning domain services
  -> reporting and audit projections

All platform areas
  -> Infrastructure Platform
```

## Platform Areas

### 1. Customer Platform

Customer Platform owns customer-facing journeys and projections. It does not own payment settlement, machine control, authorization policy, pricing rules or advertising consent decisions.

Capabilities:

- Telegram Mini App;
- landing;
- Customer Identity integration;
- authentication and session entry;
- consent capture and management;
- segmentation-driven customer experiences;
- Club Account;
- loyalty;
- referrals;
- customer-facing checkout and payment journeys;
- future advertising carousel.

The landing and Mini App are channel interfaces. They consume backend services and must not become sources of truth for identity, consent, prices, loyalty, payment or fulfillment.

### 2. CRM and Admin Console

CRM and Admin Console is the central management surface for authorized administrators. It may orchestrate workflows and present cross-domain views, but each owning domain retains its business rules and records.

Capabilities:

- customer management;
- loyalty configuration;
- commercial settings;
- prices;
- products and menu;
- payments and reconciliation;
- reports and analytics;
- advertising management;
- operator monitoring;
- Machine Operations oversight;
- system configuration;
- audit logs.

Only an authorized administrator may change prices, product commercial settings, loyalty rules or advertising configuration. Administrative access remains permission-controlled, backend-enforced and audited.

### 3. Machine Platform

Machine Platform owns the platform representation of vending machines, vendor-neutral machine commands and physical execution facts.

Capabilities:

- Machine Domain;
- Machine Gateway;
- Huaxin adapter boundary;
- Machine Simulator;
- telemetry;
- inventory integration;
- dispense fulfillment.

Application and domain code depend on the vendor-neutral `MachineGateway` port. Huaxin protocol details and any future vendor-specific behavior remain behind gateway adapters.

### 4. Machine Operations Platform

Machine Operations Platform owns authenticated, assigned and auditable human service work around machines. It is separate from CRM, even when administrators monitor it through CRM/Admin Console.

Capabilities:

- Operator App;
- maintenance tasks;
- versioned checklists;
- service logs;
- test runs;
- inventory movements;
- photo evidence;
- approval workflow;
- future scheduling, routes, GPS, offline mode and batch tracking.

Operators act only on assigned machines and approved tasks. Every test dispense creates non-sale inventory consumption records and never creates customer revenue.

### 5. Payment Platform

Payment Platform owns payment intent/session lifecycle, provider normalization, financial facts and reconciliation boundaries. It does not own order fulfillment or machine dispatch.

Capabilities:

- Payment Core;
- checkout;
- payment sessions;
- YooKassa adapter;
- Sber adapter;
- SBP QR channel;
- authenticated webhooks;
- ledger;
- reconciliation boundary.

Payment providers are adapters. Provider callbacks must be authenticated, validated, deduplicated and normalized before Payment Core accepts a payment fact. Order and Machine domains react only to accepted platform payment state.

### 6. Advertising Platform

Advertising Platform owns advertising entities, lifecycle rules, interaction facts and reporting source data. CRM/Admin Console provides the management surface without absorbing Advertising ownership.

Capabilities:

- Advertiser;
- Campaign;
- Creative;
- Placement;
- Referral Link;
- Click Event;
- Conversion Event;
- reporting;
- authentication and consent gating.

Advertising access requires an authenticated customer with at least a verified phone number and all required active consents. Delivery, ranking, targeting and optimization remain future until separately approved.

### 7. Identity and Security Platform

Identity and Security Platform establishes trusted actor identity, sessions, roles, permissions, scope and security audit facts. It does not decide domain outcomes such as price, payment acceptance, loyalty eligibility or machine success.

Capabilities:

- canonical Customer Identity;
- Telegram identity;
- verified phone;
- future SberID;
- future MAX;
- roles and permissions;
- operator authorization;
- administrator authorization;
- security audit.

Customer, operator and administrator interfaces must remain separate. Shared backend infrastructure may be reused, but session policies, routes, permissions and data scopes must preserve actor separation.

### 8. Infrastructure Platform

Infrastructure Platform provides cross-cutting runtime capabilities without taking ownership of business decisions.

Capabilities:

- configuration;
- logging;
- metrics;
- health checks;
- domain events;
- idempotency;
- error handling;
- PostgreSQL and Prisma;
- deployment and monitoring.

Infrastructure contracts are shared; domain state remains owned by the relevant module. Domain events carry facts and must not become a bypass around owning services.

## Cross-Platform Ownership Rules

1. Interfaces call owning backend services; they do not reproduce business rules.
2. CRM/Admin Console is a management surface, not a universal business domain.
3. Payment Core establishes accepted payment state; Order owns order state; Machine owns dispense state.
4. Machine Operations owns human service records; Machine owns machine identity and machine-reported state; Inventory owns stock movements.
5. Identity and Security establishes who may act; owning domains decide whether the requested business action is valid.
6. Advertising consumes identity and consent facts but cannot create or infer them.
7. Vendor-specific machine and payment behavior remains behind adapters.
8. Infrastructure observes, transports and persists domain facts without redefining their meaning.

## Authoritative Companion Documents

- `docs/architecture/PLATFORM_BOUNDARIES.md`
- `docs/architecture/PLATFORM_ROLES_AND_ACCESS.md`
- `docs/architecture/PLATFORM_DATA_FLOWS.md`
- `docs/architecture/ARCHITECTURE_GOVERNANCE.md`
- `docs/architecture/ARCHITECTURE_STATUS.md`
- `docs/architecture/ARCHITECTURE_ROADMAP.md`
- `docs/architecture/PROJECT_DECISIONS.md`
- `docs/domain/MACHINE_OPERATIONS_PLATFORM.md`
- `docs/domain/ADVERTISING_PLATFORM.md`
- `docs/security/AUTH_CORE_CONTRACT.md`

## Non-Implementation Scope

This version is documentation-only. It creates no application code, Prisma schema, migration, test, API route, provider integration, machine command or business-logic change.
