# FINANCE-007 - Payment Engine

Document: Payment Engine Task
Code: TASK-FINANCE-007
Version: 0.1
Status: Draft
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-02
Last updated: 2026-07-02

Related documents:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `docs/architecture/ARCHITECTURE_BASELINE_1_0.md`
- `docs/architecture/FINANCE_PLATFORM.md`
- `docs/architecture/LEDGER.md`
- `docs/architecture/WALLET.md`
- `docs/architecture/BONUS_ENGINE.md`
- `docs/architecture/DISCOUNT_ENGINE.md`
- `docs/architecture/EVENT_PLATFORM.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/governance/ENGINEERING_PROCESS.md`
- `docs/governance/QUALITY_GATES.md`

---

# 1. Epic Goal

Define Payment Engine as the financial settlement execution domain of the Soft ICE Finance Platform.

FINANCE-007 prepares future Payment Engine implementation by documenting:

- Payment purpose and architecture role;
- payment lifecycle;
- payment states;
- supported payment methods;
- card payments;
- SBP payments;
- Wallet payments;
- mixed payments;
- idempotency;
- authorization;
- capture;
- refund;
- cancellation;
- retry policy;
- provider abstraction;
- YooKassa integration;
- future provider support;
- Event, Ledger, Wallet, Discount and Bonus interactions;
- fraud protection;
- architecture principles.

This task is documentation-only.

Strategic rules:

```text
Payment never changes business logic.
Payment only executes financial settlement.
Ledger remains the source of truth.
Payment publishes events.
```

---

# 2. Business Value

Payment Engine enables the MVP purchase flow to collect money safely after the product, price, discount and loyalty decisions are already made.

Business value:

- customer can pay for a configured dessert;
- platform can support card, SBP, Wallet and mixed payment scenarios;
- checkout can separate gross amount, discounts, bonuses, wallet balance and external payment amount;
- provider integration is isolated behind adapters;
- YooKassa can be introduced without leaking provider details into UI or other domains;
- refunds and cancellations become auditable workflows;
- Ledger remains clean as the source of financial truth;
- Wallet, Bonus and Discount remain separate domains;
- CRM, Notification, Machine and Reporting can consume payment events;
- future providers can be added without rewriting checkout business rules.

Payment Engine supports the MVP goal:

```text
A customer can select a dessert, pay for it and receive it from a vending machine.
```

Payment is responsible only for the "pay for it" financial settlement part.

---

# 3. Architecture Scope

Included:

- Payment Engine purpose;
- Payment Engine architecture role;
- payment lifecycle;
- payment states;
- payment methods;
- card payment rules;
- SBP payment rules;
- Wallet payment rules;
- mixed payment rules;
- idempotency;
- access authorization and payment authorization;
- capture;
- refund;
- cancellation;
- retry policy;
- provider abstraction;
- YooKassa integration;
- future provider support;
- Event interaction;
- Ledger interaction;
- Wallet interaction;
- Discount interaction;
- Bonus interaction;
- fraud protection;
- architecture principles;
- future implementation roadmap.

Explicit architecture boundaries:

- Payment never changes business logic.
- Payment only executes financial settlement.
- Ledger remains the source of truth for financial history.
- Payment publishes events.
- Payment does not calculate product price.
- Payment does not calculate discounts.
- Payment does not accrue, reserve or redeem bonuses.
- Payment does not mutate Wallet directly.
- Payment provider details stay behind provider adapters.
- Provider callbacks are translated into platform payment facts.

---

# 4. Acceptance Criteria

FINANCE-007 documentation is accepted when:

- `docs/architecture/PAYMENT_ENGINE.md` defines Payment purpose;
- architecture role is documented;
- payment lifecycle is documented;
- payment states are documented;
- payment methods are documented;
- card payments are documented;
- SBP payments are documented;
- Wallet payments are documented;
- mixed payments are documented;
- idempotency is documented;
- authorization is documented;
- capture is documented;
- refund is documented;
- cancellation is documented;
- retry policy is documented;
- provider abstraction is documented;
- YooKassa integration is documented;
- future provider support is documented;
- Event interaction states that Payment publishes events;
- Ledger interaction states that Ledger remains source of truth;
- Wallet interaction states that Payment never mutates Wallet directly;
- Discount interaction states that Payment consumes payable amount and does not recalculate discounts;
- Bonus interaction states that bonuses are discount rights, not payment money;
- fraud protection is documented;
- architecture principles include Payment never changes business logic;
- architecture principles include Payment only executes financial settlement;
- no application source code is changed.

Future implementation acceptance criteria:

- Payment domain follows DDD Lite structure;
- Payment Entity exists;
- Payment Method Line or Payment Attempt model exists;
- Provider Adapter contract exists;
- YooKassa Provider Adapter exists behind the provider abstraction;
- Payment Service validates settlement plans and coordinates operations;
- Payment Engine is the public facade;
- payment commands are idempotent;
- provider webhooks are verified and deduplicated;
- Payment publishes Event Platform-compatible events;
- captured funds are represented in Ledger;
- Wallet payments go through Wallet and Ledger contracts;
- Discount Result payable amount is the only payment amount source;
- Bonus Engine remains the owner of bonus lifecycle;
- UI contains no provider-specific payment business logic;
- build is required only when source implementation is introduced.

---

# 5. Future Roadmap

## Phase 0 - Documentation

Deliverables:

- update `docs/architecture/PAYMENT_ENGINE.md`;
- update `docs/tasks/FINANCE-007_PAYMENT_ENGINE.md`;
- optionally update documentation trackers;
- do not change application source code.

## Phase 1 - Contract Alignment

Deliverables:

- Payment command contracts;
- Payment query contracts;
- Payment event contracts;
- settlement plan contract;
- payment method line contract;
- provider adapter contract;
- idempotency key policy;
- webhook verification contract.

## Phase 2 - Provider Model

Deliverables:

- provider capability model;
- provider status mapping model;
- provider error normalization;
- provider operation correlation;
- provider reference storage policy;
- provider secret handling policy.

## Phase 3 - YooKassa Adapter Design

Deliverables:

- YooKassa payment creation mapping;
- YooKassa confirmation mapping;
- YooKassa capture mapping;
- YooKassa cancellation mapping;
- YooKassa refund mapping;
- YooKassa webhook parser and verifier;
- YooKassa status mapping to platform states.

## Phase 4 - Payment Domain Foundation

Deliverables:

- Payment Entity;
- Payment Method Line or Payment Attempt Entity;
- Payment Repository;
- Payment Service;
- Payment Engine facade;
- Provider Adapter interface;
- module exports;
- unit test fixtures for lifecycle transitions and idempotency.

## Phase 5 - Card and SBP Checkout Integration

Deliverables:

- consume accepted Discount Result;
- create card payment attempt;
- create SBP payment attempt;
- handle confirmation handoff;
- process provider webhook;
- reconcile provider status by polling when needed;
- publish payment events;
- record Ledger-backed financial facts.

## Phase 6 - Wallet and Mixed Payment Integration

Deliverables:

- consume Wallet reservation references;
- support wallet-only payment;
- support wallet + card payment;
- support wallet + SBP payment;
- release Wallet reservation on external failure;
- capture Wallet reservation after external success;
- handle partial success through manual review and compensation.

## Phase 7 - Refund and Cancellation

Deliverables:

- cancel pending provider payment;
- cancel authorization before capture;
- release Wallet reservation on cancellation;
- refund full external payment;
- refund partial external payment if approved;
- refund wallet line through Wallet/Ledger contracts;
- publish refund and cancellation events.

## Phase 8 - Fraud, Reconciliation and Operations

Deliverables:

- provider webhook verification;
- duplicate payment detection;
- amount mismatch detection;
- payment velocity controls;
- refund velocity controls;
- manual review queue;
- provider report reconciliation;
- Ledger reconciliation report;
- CRM support workflow hooks.

## Phase 9 - Future Provider Expansion

Deliverables:

- additional acquiring provider adapter;
- direct SBP adapter assessment;
- provider failover policy;
- saved payment method policy;
- regional provider policy;
- provider migration and historical refund support.

## Phase 10 - Production Hardening

Deliverables:

- retry and dead-letter strategy;
- status reconciliation job;
- observability for provider errors and webhook lag;
- secret rotation process;
- security review;
- audit retention policy;
- incident runbook for duplicate charge, provider outage and ambiguous settlement.

---

# 6. Out of Scope

Out of scope for this documentation task:

- writing JavaScript;
- modifying `frontend/`;
- modifying `App.jsx`;
- modifying routes;
- modifying styles;
- adding dependencies;
- running build;
- creating backend APIs;
- adding database migrations;
- adding YooKassa credentials;
- implementing YooKassa API calls;
- implementing card payment UI;
- implementing SBP QR or deep link UI;
- implementing Wallet domain code;
- implementing Ledger domain code;
- implementing Bonus domain code;
- implementing Discount domain code;
- implementing Order domain code;
- implementing Machine Platform behavior;
- implementing fiscalization;
- implementing accounting integration;
- implementing CRM screens;
- implementing notification templates;
- changing product, price, discount, bonus or wallet business decisions.

This pass is complete when the documentation is updated and final report confirms:

- changed files;
- architecture summary;
- payment lifecycle;
- payment methods;
- finance boundaries;
- event and Ledger interaction;
- future roadmap;
- no application code was modified.
