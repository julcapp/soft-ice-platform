# Platform Boundaries

Status: Approved
Document code: ARCH-BOUNDARY-001
Version: 1.0
Effective date: 2026-07-23

## Purpose

This document defines mandatory ownership and dependency boundaries for Soft ICE Platform. It is read together with `SOFT_ICE_PLATFORM_MAP.md`.

## Boundary Matrix

| Platform area | Owns | May consume | Must not own or bypass |
|---|---|---|---|
| Customer Platform | Customer-facing journeys, channel composition and own-resource projections | Identity, consent, catalog, pricing, loyalty, checkout, payment, order and advertising contracts | Provider settlement, machine protocols, authorization policy, admin functions or backend business rules |
| CRM and Admin Console | Administrative workflows, cross-domain management views and approved command entry | Customer, loyalty, pricing, catalog, payment, advertising, Machine Operations, reporting and audit contracts | Domain records owned elsewhere, direct database mutation or domain-rule bypass |
| Machine Platform | Machine identity/state, vendor-neutral commands, telemetry normalization and dispense execution facts | Paid fulfillment request, inventory availability, configuration and gateway adapters | Payment acceptance, order pricing, operator task approval or customer decisions |
| Machine Operations | Assigned human service work, checklist execution, service/test records, evidence and approval state | Operator identity, machine scope, inventory movement and media storage contracts | Commercial settings, pricing, loyalty, advertising, customers or vendor protocols |
| Payment Platform | Checkout payment context, payment intents/sessions, accepted provider facts, ledger and reconciliation boundary | Customer/order references, provider adapters, idempotency and audit | Order completion, machine dispatch, loyalty policy or direct provider-specific leakage into application code |
| Advertising Platform | Advertiser/campaign/creative/placement/referral lifecycle, click/conversion source facts and reporting inputs | Authenticated identity, verified phone, consent, media and approved segmentation projections | Consent creation, identity verification, customer profile ownership or unapproved targeting |
| Identity and Security | Authentication, sessions, actor identity, roles, permissions, scopes and security audit | Customer identity links, trusted provider verification and configuration | Price, payment, loyalty, order, machine or advertising business decisions |
| Infrastructure Platform | Configuration, persistence plumbing, logs, metrics, health, events, idempotency, errors, deployment and monitoring | Domain-defined facts and health signals | Domain ownership or business policy |

## Mandatory Access Boundaries

### Administrator-only changes

Only an authenticated and authorized administrator may change:

- prices;
- product commercial settings;
- loyalty rules;
- advertising configuration.

These permissions must be explicit, deny by default and enforced in backend services. Hiding a control in a user interface is not authorization. Every accepted or denied sensitive administrative mutation must be attributable and auditable.

### Operator scope

Operators may:

- view and service assigned machines;
- perform approved maintenance tasks and checklist steps;
- perform approved tests;
- record inventory refills, consumption, waste and approved corrections;
- attach required evidence;
- submit service reports.

Operators may not manage customers, prices, commercial settings, loyalty rules or advertising. Machine assignment and task authorization constrain both reads and writes.

### Test dispense accounting

Every test dispense must create non-sale inventory consumption records for all materials consumed. The records must:

- be linked to the test operation and machine;
- identify the operator or administrator actor;
- record quantity, unit, reason and timestamp;
- remain separate from sales consumption and revenue;
- participate in total inventory reconciliation.

A successful test and its required consumption movements must commit as one consistency boundary. A test record must never be represented as a customer sale.

### Administrator oversight

Authorized administrators can view and audit every operator action, including assignments, checklist execution, tests, inventory movements, evidence metadata, reports and approval decisions. Audit access does not authorize alteration or deletion of immutable operational facts.

### Advertising eligibility

Advertising access requires all of the following:

1. authenticated customer identity;
2. at least one verified phone number bound through a trusted verification boundary;
3. every consent required for the requested advertising operation is active and applicable.

Advertising must fail closed when authentication, verified-phone evidence or authoritative consent state is missing, withdrawn, expired, unsupported or unavailable.

### Interface separation

Customer, Operator and Administrator interfaces must remain separate:

| Interface | Actor scope | Primary data scope |
|---|---|---|
| Customer interfaces | Authenticated customer or explicit public visitor | Own customer resources and approved public/customer projections |
| Operator App | Authorized operator | Assigned machines, assigned work and related operational records |
| CRM/Admin Console | Authorized administrator | Permission-scoped management, oversight, reporting and audit |

Separate interfaces may reuse design primitives and backend infrastructure. They must not share unrestricted navigation, session assumptions, route policies or data access.

### Vendor isolation

Machine vendor-specific details must remain behind `MachineGateway` adapters.

- Application and domain services depend on a vendor-neutral gateway port.
- Huaxin XML, command codes, transport behavior, credentials and error mapping stay inside the Huaxin adapter boundary.
- The Machine Simulator implements the same port without importing Huaxin behavior.
- A new vendor requires a new or extended adapter, contract tests and an ADR when the choice is architecturally significant.

The same dependency direction applies to payment providers: provider details remain inside Payment adapters, while Payment Core consumes normalized provider facts.

## Cross-Domain Transaction Boundaries

- Payment confirmation and dispense are separate transitions. Payment Core accepts the provider fact before Order and Machine may progress.
- Webhooks authenticate and normalize provider input; they do not directly mark an order paid or command a machine.
- Order owns the purchase lifecycle. Machine owns physical fulfillment state.
- Machine Operations records human work. Inventory records material movements. One workflow may coordinate both without merging ownership.
- Advertising records clicks and conversions as advertising facts; Analytics consumes projections and does not replace those source facts.
- Audit records who did what; audit is not the source of operational or financial balance.

## Data and Persistence Boundaries

- PostgreSQL is the primary platform datastore and Prisma is the approved ORM/migration layer for current backend persistence.
- Domain modules own their tables and write paths even when deployed in one modular monolith.
- Cross-domain reads use explicit contracts, projections or governed events rather than direct ownership leakage.
- Financial, consent, inventory and audit history requiring immutability must be append-only or protected by explicit corrective records.
- Binary media and photo evidence remain outside relational records; the database stores metadata and governed object references.
- Secrets, provider credentials, raw tokens and signatures must never enter domain records, logs or committed documentation.

## Change Control

A proposed implementation that crosses or changes any boundary in this document requires:

- an updated domain document;
- an ADR for a major architectural choice;
- an explicit permission and audit review;
- updated API/event contracts where applicable;
- updated architecture status and changelog.

## Non-Implementation Scope

This document changes no application code, schema, tests or business behavior.
