# ORDER-001 Order Domain

Status: Architecture documented
Version: 0.1
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-02
Last updated: 2026-07-02

Related documents:

- `docs/architecture/ORDER_PLATFORM.md`
- `docs/architecture/CHECKOUT.md`
- `docs/tasks/EPIC-230_ORDER_PLATFORM.md`

---

# Epic Goal

Create the Order Domain architecture for EPIC-230 so the platform has a stable business aggregate for purchase, payment and fulfillment coordination.

The goal of ORDER-001 is documentation only:

- define Order as the business aggregate;
- define the order lifecycle and states;
- define Order Item;
- define snapshot ownership;
- define payment and fulfillment boundaries;
- define event, audit, idempotency, retry, error and security rules.

---

# Business Value

ORDER-001 protects the first purchase flow from becoming screen-driven or payment-provider-driven.

Business value:

- every customer purchase has one historical record;
- support can inspect what the customer actually bought;
- price disputes can be resolved from snapshots;
- machine failures can be correlated to a paid order;
- CRM, Notification, Analytics and Finance can consume business events;
- future channels can reuse the same Order domain.

---

# Architecture Scope

ORDER-001 covers documentation for:

- Order aggregate;
- Order Item;
- immutable configuration snapshot;
- immutable pricing snapshot;
- immutable discount snapshot;
- bonus reservation reference;
- payment binding;
- fulfillment and machine interaction;
- Order events;
- audit model;
- idempotency;
- retry strategy;
- error handling;
- security;
- checkout pipeline and recovery behavior.

ORDER-001 confirms that Order consumes accepted results from Product, Configuration, Pricing, Discount, Bonus and Payment engines, but does not own their internal rules.

---

# Acceptance Criteria

ORDER-001 is complete when:

- `docs/architecture/ORDER_PLATFORM.md` contains the required sections 1 through 20;
- `docs/architecture/CHECKOUT.md` describes customer journey, checkout pipeline, validation order, pricing order, payment order, failure scenarios and recovery scenarios;
- Order is documented as the business aggregate;
- Order snapshot ownership is documented;
- historical price recalculation is explicitly forbidden;
- mutable catalog references are explicitly excluded from historical order truth;
- Order event publication is documented;
- no application source code is modified;
- no frontend files are modified.

---

# Future Roadmap

Future ORDER tasks:

1. Define Order command contracts.
2. Define Order query contracts.
3. Define Order event schemas.
4. Define Order repository and storage model.
5. Implement Order aggregate in the domain layer.
6. Implement checkout orchestration behind a stable service boundary.
7. Integrate Payment Engine events.
8. Integrate Machine Platform events.
9. Add Order read models for CRM, support and customer history.
10. Add test scenarios for full order lifecycle, retries and recovery.

---

# Out of Scope

ORDER-001 does not include:

- JavaScript implementation;
- frontend changes;
- Mini App UI changes;
- React component changes;
- data migrations;
- payment provider setup;
- YooKassa credentials;
- machine hardware commands;
- CRM screens;
- notification templates;
- accounting integration;
- cloud event bus implementation.

---

# Important Rules

- Order is the business aggregate.
- Order owns snapshots.
- Order never recalculates historical prices.
- Order never references mutable catalog data as historical truth.
- Order publishes business events.
- Configuration Engine validates configuration.
- Pricing Engine calculates gross price.
- Discount Engine calculates discounts and payable amount.
- Bonus Engine owns bonus reservation and redemption.
- Payment Engine owns payment settlement.
- Ledger remains the source of truth for financial history.
- Machine Platform owns hardware execution.
- UI must not calculate order totals or infer fulfillment state.
