# FINANCE-005 - Bonus Engine

Document: Bonus Engine Task
Code: TASK-FINANCE-005
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
- `docs/architecture/EVENT_PLATFORM.md`
- `docs/architecture/BONUS_ENGINE.md`
- `docs/governance/ENGINEERING_PROCESS.md`
- `docs/governance/QUALITY_GATES.md`

---

# 1. Epic Goal

Define Bonus Engine as the non-monetary discount-rights domain of the Soft ICE Finance Platform.

FINANCE-005 prepares future Bonus Engine implementation by documenting:

- Bonus purpose and architecture role;
- bonus lifecycle and states;
- expiration policy;
- accrual rules;
- redemption rules;
- cancellation rules;
- reservation rules;
- bonus events;
- Wallet, Ledger, Pricing, Discount, Notification, CRM and Reporting interactions;
- fraud protection;
- future Promotion Engine integration;
- architecture principles and implementation readiness.

This task is documentation-only.

---

# 2. Business Value

Bonus Engine enables Club Timofey and future loyalty mechanics without mixing bonuses with money.

Business value:

- customers can receive bonus rights after purchases and campaigns;
- customers can use bonuses for discounts during checkout;
- platform can reserve bonuses while checkout, payment and vending flows are unfinished;
- platform can release bonuses if checkout fails;
- platform can expire unused bonuses by policy;
- CRM can see customer loyalty history and support cases;
- Notification Engine can send bonus accrual, redemption and expiration messages;
- Reporting can measure loyalty activity and campaign performance;
- referrals, birthday bonuses and future partner programs can be introduced through stable rules;
- Wallet, Ledger and Accounting remain clean because bonuses are not cash balances.

Strategic rule:

```text
1 bonus = the right to receive a discount with a nominal value of 1 RUB according to platform rules.
```

---

# 3. Architecture Scope

Included:

- Bonus Engine purpose;
- Bonus Engine architecture role;
- bonus lifecycle;
- bonus states;
- bonus expiration policy;
- bonus accrual rules;
- bonus redemption rules;
- bonus cancellation;
- bonus reservation;
- bonus events;
- Wallet interaction;
- Ledger interaction;
- Pricing interaction;
- Discount interaction;
- Notification interaction;
- CRM interaction;
- Reporting;
- fraud protection;
- future Promotion Engine integration;
- architecture principles;
- future implementation roadmap.

Explicit architecture boundaries:

- Bonus is not money.
- Bonus is not part of Wallet balance.
- Bonus is not accounting.
- Ledger never stores bonus balance as money.
- Bonus publishes events.
- Bonus supports expiration.
- Bonus supports promotional campaigns.
- Bonus supports referrals.
- Bonus supports birthday bonuses.
- Bonus supports future partner programs.

Not included:

- JavaScript implementation;
- frontend changes;
- `App.jsx` changes;
- route changes;
- style changes;
- package changes;
- build execution;
- database migrations;
- payment provider integration;
- Wallet implementation;
- Ledger implementation;
- Promotion Engine implementation;
- CRM screens;
- notification templates.

---

# 4. Acceptance Criteria

FINANCE-005 documentation is accepted when:

- `docs/architecture/BONUS_ENGINE.md` defines Bonus purpose;
- architecture role is documented;
- bonus lifecycle is documented;
- bonus states are documented;
- bonus expiration policy is documented;
- accrual rules are documented;
- redemption rules are documented;
- cancellation rules are documented;
- reservation rules are documented;
- bonus events are documented;
- Wallet interaction states that bonuses are not Wallet balance;
- Ledger interaction states that Ledger never stores bonus balance as money;
- Pricing interaction states that Pricing calculates price and bonus limits;
- Discount interaction states that bonus redemption is a discount input;
- Notification interaction is documented;
- CRM interaction is documented;
- Reporting is documented;
- fraud protection is documented;
- future Promotion Engine integration is documented;
- architecture principles are documented;
- promotional campaigns are supported;
- referrals are supported;
- birthday bonuses are supported;
- future partner programs are supported;
- no application source code is changed.

Future implementation acceptance criteria:

- Bonus domain follows DDD Lite structure;
- Bonus Entity or Bonus Batch model exists;
- Bonus Reservation model exists;
- Bonus Repository stores bonus history and projection data, not Wallet cash;
- Bonus Service validates accrual, reservation, redemption, release, expiration and cancellation;
- Bonus Engine is the public facade;
- bonus operations are idempotent;
- bonus projection is rebuildable from bonus history and events;
- expiration can process batches safely;
- redemption consumes nearest-expiring eligible bonuses first unless rule version overrides it;
- Wallet balance never includes bonus amount;
- Ledger entries never represent bonus balance as money;
- Bonus events follow Event Platform envelope and naming rules;
- UI contains no Bonus business logic;
- build is required only when source implementation is introduced.

---

# 5. Future Roadmap

## Phase 0 - Documentation

Deliverables:

- update `docs/architecture/BONUS_ENGINE.md`;
- update `docs/tasks/FINANCE-005_BONUS_ENGINE.md`;
- optionally update documentation trackers;
- do not change application source code.

## Phase 1 - Contract Alignment

Deliverables:

- Bonus command contracts;
- Bonus query contracts;
- Bonus event contracts;
- Bonus batch model;
- Bonus reservation model;
- idempotency key policy;
- source and rule version model.

## Phase 2 - Pricing and Discount Boundary

Deliverables:

- Pricing result includes bonus eligibility and redemption limit;
- Discount/Pricing stacking rules are documented;
- final payable amount contract distinguishes gross amount, bonus discount and payable amount;
- checkout flow coordinates Bonus reservation before payment completion.

## Phase 3 - Bonus Domain Foundation

Deliverables:

- Bonus Entity or Bonus Batch;
- Bonus Reservation Entity;
- Bonus Repository;
- Bonus Service;
- Bonus Engine facade;
- module exports;
- unit test fixtures for accrual, reservation, redemption and expiration.

## Phase 4 - Core Operations

Deliverables:

- accrue bonus;
- activate pending bonus;
- reserve bonus;
- release reservation;
- redeem reserved bonus;
- expire bonus batch;
- cancel bonus;
- reverse bonus operation;
- rebuild bonus projection.

## Phase 5 - Checkout Integration

Deliverables:

- consume Pricing Result;
- reserve selected bonus amount;
- apply bonus discount to final payable amount;
- redeem reserved bonuses after successful order/payment flow;
- release bonuses after checkout, payment or machine failure;
- preserve separate Wallet reservation and Bonus reservation.

## Phase 6 - CRM and Notification Readiness

Deliverables:

- customer bonus read model;
- bonus history query;
- CRM operator adjustment command with audit metadata;
- Notification triggers for accrual, redemption, expiration and upcoming expiration;
- support workflows for cancellation, freeze and reversal.

## Phase 7 - Campaigns, Referrals and Birthday Bonuses

Deliverables:

- campaign source model;
- referral eligibility and anti-abuse rules;
- birthday bonus eligibility and frequency limits;
- campaign budget/cap integration with future Promotion Engine;
- campaign and referral reporting.

## Phase 8 - Partner Programs

Deliverables:

- partner source adapter contract;
- partner identity mapping;
- partner accrual idempotency;
- partner redemption reporting;
- partner fraud and reconciliation controls.

## Phase 9 - Production Hardening

Deliverables:

- concurrency controls;
- event retry and dead-letter strategy;
- projection replay;
- fraud review queue;
- monitoring for reservation expiry and projection lag;
- retention and audit policy;
- security review for bonus events and CRM access.

---

# 6. Documentation-Only Completion Rule

This pass is complete when the documentation is updated and final report confirms:

- changed files;
- architecture summary;
- bonus lifecycle;
- bonus states;
- accrual, redemption, reservation, expiration and cancellation rules;
- future roadmap;
- no application code was modified.
