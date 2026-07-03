# FINANCE-006 - Discount Engine

Document: Discount Engine Task
Code: TASK-FINANCE-006
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
- `docs/architecture/EVENT_PLATFORM.md`
- `docs/architecture/DISCOUNT_ENGINE.md`
- `docs/governance/ENGINEERING_PROCESS.md`
- `docs/governance/QUALITY_GATES.md`

---

# 1. Epic Goal

Define Discount Engine as the non-monetary price-reduction domain of the Soft ICE Finance and Pricing flow.

FINANCE-006 prepares future Discount Engine implementation by documenting:

- Discount purpose and architecture role;
- discount lifecycle;
- discount types;
- percentage discounts;
- fixed discounts;
- coupon discounts;
- campaign discounts;
- membership discounts;
- trusted customer discounts;
- stacking policy;
- priority rules;
- Pricing, Wallet, Bonus, Payment and CRM interactions;
- Discount events;
- fraud prevention;
- future Promotion Engine integration;
- architecture principles and readiness criteria.

This task is documentation-only.

---

# 2. Business Value

Discount Engine enables controlled commercial offers without mixing discounts with money.

Business value:

- customers can receive valid discounts before payment;
- checkout can show transparent gross amount, discount amount and payable amount;
- coupons can be validated and reserved safely;
- campaigns can be launched without hardcoding pricing behavior in UI;
- Club Timofey and future membership benefits can reduce payable price according to policy;
- trusted customer or support discounts can be audited;
- bonus redemption can be coordinated as a discount effect without treating bonuses as cash;
- Wallet and Ledger remain clean because discounts are not balances and not financial journal mutations;
- CRM, Reporting and future Promotion Engine can consume formal events.

Strategic rules:

```text
Discount is not money.
Discount does not modify Ledger.
Discount is calculated before payment.
Discount may be combined only according to stacking rules.
Discount publishes events.
```

---

# 3. Architecture Scope

Included:

- Discount Engine purpose;
- Discount Engine architecture role;
- discount lifecycle;
- discount types;
- percentage discount rules;
- fixed discount rules;
- coupon discount rules;
- campaign discount rules;
- membership discount rules;
- trusted customer discount rules;
- stacking policy;
- priority rules;
- Pricing interaction;
- Wallet interaction;
- Bonus interaction;
- Payment interaction;
- CRM interaction;
- Discount events;
- fraud prevention;
- future Promotion Engine integration;
- architecture principles;
- future implementation roadmap.

Explicit architecture boundaries:

- Discount is not money.
- Discount is not Wallet balance.
- Discount is not Bonus balance.
- Discount does not modify Ledger.
- Discount is calculated before payment.
- Discount may be combined only according to stacking rules.
- Discount publishes events.
- Payment collects the payable amount after discounts.
- Wallet reserves only the payable amount after discounts.
- Bonus Engine owns bonus rights; Discount Engine owns bonus stacking and final discount effect.

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
- Bonus implementation;
- Promotion Engine implementation;
- CRM screens;
- notification templates.

---

# 4. Acceptance Criteria

FINANCE-006 documentation is accepted when:

- `docs/architecture/DISCOUNT_ENGINE.md` defines Discount purpose;
- architecture role is documented;
- discount lifecycle is documented;
- discount types are documented;
- percentage discounts are documented;
- fixed discounts are documented;
- coupon discounts are documented;
- campaign discounts are documented;
- membership discounts are documented;
- trusted customer discounts are documented;
- stacking policy is documented;
- priority rules are documented;
- Pricing interaction states that discounts consume Pricing Result and produce payable amount;
- Wallet interaction states that discounts are not Wallet balance and Wallet reserves only payable amount;
- Bonus interaction states that bonuses are discount rights and Bonus Engine owns reservation/redemption;
- Payment interaction states that discount is calculated before payment;
- CRM interaction is documented;
- Discount events are documented;
- fraud prevention is documented;
- future Promotion Engine integration is documented;
- architecture principles are documented;
- documentation states that Discount is not money;
- documentation states that Discount does not modify Ledger;
- documentation states that discounts may be combined only according to stacking rules;
- no application source code is changed.

Future implementation acceptance criteria:

- Discount domain follows DDD Lite structure;
- Discount Rule entity exists;
- Discount Result entity exists;
- Coupon Usage or Reservation model exists;
- Discount Repository stores rule definitions and usage state, not Wallet cash;
- Discount Service validates eligibility, stacking and priority;
- Discount Engine is the public facade;
- discount operations are idempotent;
- discount results are reproducible from Pricing Result, rule version and checkout context;
- coupon reservation can expire or release safely;
- Payment uses accepted Discount Result payable amount;
- Wallet never stores discounts as balance;
- Ledger is not modified by discount calculation;
- Bonus reservation and redemption remain in Bonus Engine;
- Discount events follow Event Platform envelope and naming rules;
- UI contains no Discount business logic;
- build is required only when source implementation is introduced.

---

# 5. Future Roadmap

## Phase 0 - Documentation

Deliverables:

- update `docs/architecture/DISCOUNT_ENGINE.md`;
- update `docs/tasks/FINANCE-006_DISCOUNT_ENGINE.md`;
- optionally update documentation trackers;
- do not change application source code.

## Phase 1 - Contract Alignment

Deliverables:

- Discount command contracts;
- Discount query contracts;
- Discount event contracts;
- Pricing Result input contract;
- Discount Result output contract;
- coupon validation contract;
- coupon reservation contract;
- idempotency key policy.

## Phase 2 - Rule Model

Deliverables:

- Discount Rule model;
- rule versioning model;
- rule status lifecycle;
- percentage discount model;
- fixed discount model;
- coupon discount model;
- campaign discount model;
- membership discount model;
- trusted customer discount model.

## Phase 3 - Stacking and Priority

Deliverables:

- stack groups;
- exclusive groups;
- rule priority;
- deterministic conflict resolution;
- maximum total discount policy;
- zero-payable order policy decision;
- bonus redemption stacking policy.

## Phase 4 - Discount Domain Foundation

Deliverables:

- Discount Rule Entity;
- Discount Result Entity;
- Coupon Usage or Reservation Entity;
- Discount Repository;
- Discount Service;
- Discount Engine facade;
- module exports;
- unit test fixtures for rule eligibility, stacking and calculation.

## Phase 5 - Checkout Integration

Deliverables:

- consume Pricing Result;
- calculate Discount Result before payment;
- pass payable amount to Wallet and Payment;
- reserve coupon usage where needed;
- coordinate Bonus reservation where selected;
- release coupon and bonus reservations when checkout, payment or machine flow fails.

## Phase 6 - CRM and Reporting Readiness

Deliverables:

- discount read model;
- coupon usage history;
- customer discount history;
- campaign participation projection;
- trusted customer approval audit;
- reporting fields for gross amount, discount amount and payable amount.

## Phase 7 - Fraud Controls

Deliverables:

- coupon brute-force protection;
- duplicate usage checks;
- campaign cap checks;
- operator approval audit;
- suspicious stacking detection;
- discount velocity limits;
- fraud review events;
- secure coupon code storage policy.

## Phase 8 - Promotion Engine Integration

Deliverables:

- Promotion Engine campaign authoring contract;
- campaign rule import or command contract;
- campaign budget and eligibility sync;
- campaign versioning;
- A/B or targeted promotion support;
- reporting integration through events.

## Phase 9 - Production Hardening

Deliverables:

- concurrency controls;
- reservation expiry job;
- event retry and dead-letter strategy;
- rule cache invalidation;
- replay-safe projections;
- monitoring for abnormal discount rates;
- retention and audit policy;
- security review for coupon and operator workflows.

---

# 6. Documentation-Only Completion Rule

This pass is complete when the documentation is updated and final report confirms:

- changed files;
- architecture summary;
- discount lifecycle;
- discount types;
- stacking and priority rules;
- finance boundaries;
- event model;
- future roadmap;
- no application code was modified.
