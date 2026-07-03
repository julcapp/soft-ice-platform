# EPIC-230 Order Platform

Status: Draft
Version: 0.1
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-02
Last updated: 2026-07-02

Related documents:

- `docs/architecture/ORDER_PLATFORM.md`
- `docs/architecture/CHECKOUT.md`
- `docs/tasks/ORDER-001_ORDER_DOMAIN.md`

---

# Epic Goal

Define and later implement Order Platform as the business aggregate layer for the first purchase flow.

The epic establishes Order as the owner of historical purchase snapshots and the event-producing boundary between checkout, payment and fulfillment.

---

# Business Value

Order Platform enables the MVP goal:

```text
A customer can select a dessert, pay for it and receive it from a vending machine.
```

Business value:

- one stable business object for customer purchase history;
- reliable support and CRM investigation;
- immutable price and configuration history;
- safer payment and fulfillment coordination;
- auditability for refunds, cancellations and machine failures;
- future analytics over accepted business events.

---

# Architecture Scope

EPIC-230 covers architecture and future implementation planning for:

- Order aggregate;
- Order Item;
- configuration snapshot;
- pricing snapshot;
- discount snapshot;
- bonus reservation reference;
- payment binding;
- fulfillment status;
- machine interaction;
- event publication;
- audit, idempotency, retry and error policy.

This epic depends on Product, Configuration, Pricing, Discount, Bonus, Payment, Wallet, Ledger, Machine and Event Platform contracts.

---

# Planned Tasks

| Task | Title | Status | Notes |
|---|---|---|---|
| `ORDER-001` | Order Domain Architecture | Architecture documented | Documentation-only domain and checkout architecture. |
| `ORDER-002` | Order Contracts | Planned | Command, query and event contract definitions. |
| `ORDER-003` | Order Repository Model | Planned | Storage model after contracts are approved. |
| `ORDER-004` | Checkout Orchestration | Planned | Pipeline implementation after domain boundaries are stable. |
| `ORDER-005` | Payment and Fulfillment Integration | Planned | Event-driven integration with Payment and Machine domains. |

---

# Acceptance Criteria

The epic is architecture-ready when:

- `docs/architecture/ORDER_PLATFORM.md` defines Order as the business aggregate;
- `docs/architecture/CHECKOUT.md` defines checkout pipeline, validation, pricing, payment, failure and recovery behavior;
- `docs/tasks/ORDER-001_ORDER_DOMAIN.md` defines task scope and implementation boundaries;
- Order snapshot strategy is documented;
- Order lifecycle and states are documented;
- Order event interaction is documented;
- no application source code is modified by the documentation task.

The epic is implementation-ready only after:

- Order command, query and event contracts are approved;
- Checkout settlement plan contract is approved;
- Payment binding contract is approved;
- Machine fulfillment contract is approved;
- idempotency and retry policy are approved;
- test scenarios are prepared for order lifecycle and recovery flows.

---

# Out of Scope

EPIC-230 does not include:

- frontend implementation;
- Mini App screen changes;
- payment provider integration;
- machine hardware integration;
- database migration;
- CRM screen implementation;
- notification templates;
- fiscalization or accounting implementation;
- changing catalog, pricing, discount or bonus rules.

---

# Important Rules

- Order is the business aggregate.
- Order owns snapshots.
- Order never recalculates historical prices.
- Order never references mutable catalog data as historical truth.
- Order publishes business events.
- Payment and fulfillment are coordinated by events and contracts.
- Ledger remains the source of truth for financial history.
- Documentation evolves before implementation.
