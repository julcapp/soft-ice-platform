# Architecture Status

Status: Active
Document code: ARCH-002
Epic: EPIC-355
Version: 1.0
Snapshot date: 2026-07-07
Project: Soft ICE Platform / Utimoshi

## Purpose

This document is an executive dashboard of the current Soft ICE Platform architecture state. It summarizes readiness, risks and next priorities without replacing the detailed architecture audits, runtime audits, task records or decision log.

## Executive Snapshot

| Area | Current state |
|---|---|
| Current architecture version | Architecture Release 1.0, approved baseline |
| Runtime line | `v0.3.0-alpha.1`, in progress |
| Overall architecture completion | 76% architecture readiness |
| Runtime readiness | 34% runtime readiness |
| Documentation quality score | 68 / 100 |
| MVP status | Architecture-guided, not MVP-runtime-ready |
| Primary implementation focus | Product Engine Core and runtime alignment |

The architecture direction is clear and mature enough to guide implementation increments. The main gap is not conceptual architecture; it is runtime completion, documentation governance cleanup and end-to-end MVP integration across payment, order, machine and notification flows.

## Completed EPICs

| EPIC | Status | Notes |
|---|---|---|
| EPIC-050 Platform Kernel | Architecture documented | Kernel, registry, bootstrap, configuration and lifecycle contracts are documented. |
| EPIC-210 Event Platform | Architecture documented | Event bus, event contracts, naming, versioning, delivery, storage and security are documented. |
| EPIC-230 Order Platform | Architecture documented | Order aggregate, checkout, state machine, fulfillment, cancellation, refund and dispatch are documented. |
| EPIC-300 Customer Platform | Architecture documented | Customer, Club Account, Bonus and Payment domain boundaries are documented. |
| EPIC-350 Platform Data Model | Architecture documented | Logical data model, entities, ownership, aggregates, immutability and retention direction are documented. |

## In-Progress EPICs

| EPIC / area | Status | Main gap |
|---|---|---|
| EPIC-355 Architecture Governance | In progress | ARCH-001 consistency audit and ARCH-002 status dashboard are complete; governance cleanup remains open. |
| Product Engine Core | Runtime in progress | Catalog, Configuration, Recipe and Pricing exist partially; Media Engine and UI wiring remain incomplete. |
| Finance Platform | Architecture-first | Ledger, Wallet, Bonus, Discount, Payment and Accounting Adapter are documented but runtime modules are not production-ready. |
| Platform Contracts / EPIC-220 | Not complete | Task file exists, but canonical contract implementation and task-index completion are not yet established. |
| Machine Platform | Planned / architecture boundary only | Dispatch is documented through Order Platform, but Machine Runtime and adapter contracts need implementation. |
| Notification Platform | Planned / sparse | Required for customer communication, but dedicated runtime architecture and delivery implementation are not complete. |

## Core Architecture Layers

| Layer | Status | Assessment |
|---|---|---|
| Product / Domain model | Strong direction | Product configuration is the central model; DDD Lite and semantic IDs are established. |
| Platform Kernel | Architecture documented | Coordination, registration, lifecycle and configuration contracts exist; runtime kernel implementation is still future work. |
| API layer | Architecture documented | API overview, auth, authorization, REST and Event API docs exist; versioning, idempotency, errors and webhooks need completion before public API work. |
| Data layer | Architecture documented | Logical model is strong; physical database schemas and migrations must be reconciled with it before production. |
| Frontend Mini App | Present foundation | React/Vite app exists; Product Engine runtime modules exist partially; legacy catalog wiring remains a risk. |
| Backend | Present foundation | Express/Prisma foundation and migrations exist; platform APIs and runtime contracts are incomplete. |
| Finance / payment | Strong docs, weak runtime | Payment and finance boundaries are detailed; production payment runtime, ledger and reconciliation are not complete. |
| Order / fulfillment | Strong docs, weak runtime | Order Platform is deeply documented; executable Order Runtime and event publication are not complete. |
| Machine integration | Early | Dispatch boundary is documented; hardware adapter/runtime readiness is not complete. |
| Governance / release | Medium | Release policy exists; empty authoritative docs, stale duplicates and decision-log normalization remain open. |

## Documentation Statistics

| Metric | Current value |
|---|---:|
| Markdown files under `docs/` before this document | 162 |
| Markdown files under `docs/` after this document | 163 |
| Empty Markdown files under `docs/` | 68 |
| Top-level Markdown files directly under `docs/` | 20 |
| Task documents under `docs/tasks/` | 26 |
| Architecture documents under `docs/architecture/` including ADR | 35 before this document, 36 after this document |
| Total documented bytes under `docs/` before this document | 1,379,399 |

Documentation coverage is broad, but the repository still contains too many empty placeholder documents with authoritative names. Governance cleanup is now a higher-value architecture activity than adding more broad concept documents.

## Top 5 Architecture Risks

1. Payment, Order, Machine and Notification runtimes are not complete enough for the commercial MVP.
2. Empty authoritative documentation files can create false confidence and wrong implementation assumptions.
3. Legacy Mini App catalog paths and older product IDs may conflict with the semantic ID standard.
4. Finance, payment registry, ledger and reconciliation ownership must be made executable before real settlement.
5. Platform contracts and event publication are documented but not yet enforced as runtime integration boundaries.

## Top 5 Next Priorities

1. Finish Product Engine runtime alignment: Catalog, Configuration, Recipe, Pricing, Media and UI wiring.
2. Complete Platform Contracts so runtimes communicate through approved commands, queries, events and DTOs.
3. Implement MVP Order Runtime with immutable snapshots, state transitions and event publication.
4. Implement backend-side Payment Runtime with YooKassa adapter, webhook verification, idempotency and ledger-backed completion.
5. Define and implement the minimal Machine Runtime / adapter boundary required for paid-order dispatch.

## Readiness Assessment

| Area | Readiness | Assessment |
|---|---|---|
| Database | Partial | Prisma foundation and migrations exist, and the logical data model is documented. Production schema ownership, migrations, retention and audit storage are not complete. |
| Backend | Partial | Express/Prisma foundation exists. Platform APIs, runtime contracts, payment backend, order runtime and event handling are not MVP-ready. |
| Frontend | Medium | Mini App exists and Product Engine modules are partially implemented. Remaining risk is legacy business data paths and incomplete service wiring. |
| Deployment | Early | Nginx configuration exists and prior infrastructure baseline is documented. Release, runtime health, secret handling and production deployment gates remain incomplete. |

## Short Roadmap

| Order | Next EPIC | Target outcome |
|---:|---|---|
| 1 | EPIC-220 Platform Contracts | Canonical runtime contracts for commands, queries, events, DTOs, idempotency and cross-runtime boundaries. |
| 2 | Product Engine Core completion | Mini App purchase flow reads business data, price and media through approved Product Engine services. |
| 3 | MVP Runtime Flow | Minimal Order, Payment, Event and Machine path for paid order creation, confirmed payment and dispatch readiness. |

## Dashboard Verdict

Soft ICE Platform is architecture-ready for controlled implementation increments, but not runtime-release-ready for the commercial MVP. The next work should convert the approved architecture into executable contracts and MVP runtime flows, while reducing documentation governance debt that could mislead implementation.
