# FINANCE-004 — Wallet Domain

Документ: Wallet Domain Task
Код: TASK-FINANCE-004
Версия: 0.2
Статус: Draft
Проект: Soft ICE Platform / «У Тимоши»
Ответственный: Product Owner Alexander Ilyin
Дата создания: 2026-07-02
Последнее изменение: 2026-07-02
Связанные документы:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `docs/architecture/ARCHITECTURE_BASELINE_1_0.md`
- `docs/architecture/FINANCE_PLATFORM.md`
- `docs/architecture/LEDGER.md`
- `docs/architecture/EVENT_PLATFORM.md`
- `docs/architecture/WALLET.md`
- `docs/governance/ENGINEERING_PROCESS.md`
- `docs/governance/QUALITY_GATES.md`

---

# 1. Epic Goal

Define Wallet Domain as the current-balance projection layer of the Soft ICE Finance Platform.

FINANCE-004 prepares the future Wallet implementation by documenting:

- Wallet purpose and architecture;
- Wallet lifecycle and states;
- Wallet projection over Ledger;
- balance and currency model;
- supported operations;
- integration with Transaction, Ledger, Bonus, Discount, Payment, Accounting, Notification, CRM and Event Platform;
- API contract expectations;
- future multi-wallet and multi-currency roadmap.

This task is documentation-only.

---

# 2. Business Value

Wallet enables safe internal balance handling for the purchase flow and future loyalty operations.

Business value:

- customer can use internal balance during checkout;
- platform can reserve funds before payment and machine preparation complete;
- platform can release funds when payment, order or machine flow fails;
- support and CRM can inspect customer balance without editing it directly;
- refunds and adjustments remain auditable;
- Telegram Mini App, MAX Mini App, CRM, Seller App and Machine Platform can use one channel-neutral Wallet contract;
- future cashback, gift balance, franchise balance and settlement flows can be added without moving financial history out of Ledger.

---

# 3. Architecture Scope

Included:

- Wallet as projection over Ledger;
- Wallet lifecycle;
- Wallet states;
- Wallet balance model;
- currency model;
- supported operations: Deposit, Debit, Reserve, Release, Refund, Close, Freeze, Unfreeze;
- event interaction;
- transaction interaction;
- bonus interaction;
- discount interaction;
- payment interaction;
- accounting interaction;
- notification interaction;
- CRM interaction;
- API contracts;
- future multi-wallet support;
- future multi-currency support;
- architecture principles and implementation readiness rules.

Not included:

- JavaScript implementation;
- frontend changes;
- `App.jsx` changes;
- route changes;
- style changes;
- package changes;
- build execution;
- payment provider implementation;
- database migrations;
- accounting integration implementation;
- notification template implementation;
- CRM UI implementation.

---

# 4. Important Architecture Rules

Wallet rules:

1. Wallet is NOT the source of truth.
2. Ledger is the source of truth.
3. Wallet is a projection.
4. Wallet subscribes to Ledger events.
5. Wallet publishes events.
6. Wallet never calculates bonuses.
7. Wallet never calculates discounts.
8. Wallet never performs accounting.
9. Wallet never performs external payment.
10. Wallet must be independent from UI.
11. Wallet must support Telegram Mini App, MAX Mini App, CRM, Seller App and Machine Platform.
12. Wallet supports future multiple currencies.
13. Wallet supports future multiple wallets per customer.
14. Wallet operations must be idempotent.
15. Wallet projection must be rebuildable from Ledger.

---

# 5. Architecture Model

Target financial flow:

```text
Pricing Result
↓
Transaction
↓
Ledger
↓
Wallet Projection
↓
Events and channel-neutral APIs
```

Wallet command flow:

```text
Wallet command
↓
Transaction created or referenced
↓
Ledger Entry recorded
↓
LedgerEntryRecorded event
↓
Wallet projection applies entry
↓
Wallet event published
```

Wallet read flow:

```text
Telegram Mini App / MAX Mini App / CRM / Seller App / Machine Platform
↓
Wallet API query
↓
Wallet projection snapshot
```

Statement/history flow:

```text
Channel
↓
Statement API
↓
Ledger entries
```

Wallet projection is used for current state. Ledger is used for financial history.

---

# 6. Supported Operations

Future Wallet implementation must support these operations.

| Operation | Purpose | Projection effect |
|---|---|---|
| Deposit | Add internal funds. | `available_balance` increases. |
| Debit | Spend available funds directly. | `available_balance` decreases. |
| Reserve | Hold funds for pending operation. | `available_balance` decreases, `reserved_balance` increases. |
| Release | Return reserved funds. | `reserved_balance` decreases, `available_balance` increases. |
| Refund | Return value after previous payment or spend. | `available_balance` increases or compensates previous debit. |
| Close | Make wallet read-only. | State changes if balances and reservations are zero. |
| Freeze | Block new outgoing operations. | State changes without balance amount change. |
| Unfreeze | Restore normal wallet use. | State changes without balance amount change. |

Capture is also required for checkout implementation, even though it is not a user-facing operation:

| Operation | Purpose | Projection effect |
|---|---|---|
| Capture | Convert reserved funds into spending. | `reserved_balance` decreases, `total_balance` decreases. |

---

# 7. Acceptance Criteria

FINANCE-004 documentation is accepted when:

- `docs/architecture/WALLET.md` defines Wallet purpose;
- Wallet architectural role is documented;
- Wallet lifecycle is documented;
- Wallet states are documented;
- Wallet projection over Ledger is documented;
- Wallet balance model is documented;
- supported operations include Deposit, Debit, Reserve, Release, Refund, Close, Freeze and Unfreeze;
- currency model is documented;
- Wallet security rules are documented;
- Event interaction is documented;
- Transaction interaction is documented;
- Bonus interaction is documented;
- Discount interaction is documented;
- Payment interaction is documented;
- Accounting interaction is documented;
- Notification interaction is documented;
- CRM interaction is documented;
- API contracts are documented;
- future multi-wallet support is documented;
- future multi-currency support is documented;
- architecture principles are documented;
- out-of-scope implementation boundaries are explicit;
- no application source code is changed.

Future implementation acceptance criteria:

- Wallet domain follows DDD Lite structure;
- Wallet Entity exists;
- Wallet Reservation Entity exists;
- Wallet Repository stores projection snapshots only;
- Wallet Projection Service rebuilds state from Ledger Entries;
- Wallet Service validates commands and coordinates with Transaction/Ledger contracts;
- Wallet Engine is the public facade;
- operations are idempotent;
- negative balances are impossible;
- Wallet subscribes to Ledger events;
- Wallet publishes Wallet events;
- UI contains no Wallet business logic;
- build passes only when source implementation is introduced.

---

# 8. Out of Scope

Out of scope for this task:

- writing JavaScript;
- modifying `frontend/`;
- modifying `App.jsx`;
- modifying routes;
- modifying styles;
- running build;
- adding dependencies;
- adding backend APIs;
- adding database migrations;
- integrating YooKassa, SBP or bank cards;
- implementing accounting;
- implementing notifications;
- implementing CRM screens;
- changing Machine Platform behavior.

---

# 9. Future Roadmap

## Phase 0 — Documentation

Deliverables:

- update `docs/architecture/WALLET.md`;
- update `docs/tasks/FINANCE-004_WALLET_DOMAIN.md`;
- optionally update documentation trackers;
- do not change application source code.

## Phase 1 — Contract Alignment

Deliverables:

- Wallet command contracts;
- Wallet query contracts;
- Wallet event contracts;
- Ledger operation mapping for Deposit, Debit, Reserve, Release, Capture, Refund, Close, Freeze and Unfreeze;
- idempotency key policy.

## Phase 2 — Transaction and Ledger Foundation

Deliverables:

- stable Transaction Domain interface;
- stable Ledger append-only interface;
- `LedgerEntryRecorded` event;
- Ledger replay support for wallet projections;
- test fixtures for projection rebuild.

## Phase 3 — Wallet Domain Foundation

Deliverables:

- Wallet Entity;
- Wallet Reservation Entity;
- Wallet Repository;
- Wallet Projection Service;
- Wallet Service;
- Wallet Engine facade;
- public exports.

## Phase 4 — Core Wallet Operations

Deliverables:

- Deposit;
- Debit;
- Reserve;
- Release;
- Capture;
- Refund;
- Close;
- Freeze;
- Unfreeze;
- projection replay.

## Phase 5 — Checkout and Payment Integration

Deliverables:

- consume Pricing Result;
- reserve internal funds before external payment;
- capture wallet funds after confirmed payment/order state;
- release wallet funds after payment/order/machine failure;
- keep Machine Platform blocked until finance state is confirmed.

## Phase 6 — Bonus, Discount and Loyalty Integration

Deliverables:

- coordinate with Bonus Engine without storing bonuses as money;
- consume discount result from Pricing/Discount domain;
- support gift balance and cashback only through approved wallet types and Ledger entries;
- preserve separation between money, bonus rights and discounts.

## Phase 7 — CRM, Notification and Accounting Readiness

Deliverables:

- CRM read model and operator command audit;
- Notification event triggers;
- Accounting Adapter read-only reconciliation;
- wallet audit trail;
- support workflows for freeze, unfreeze, refund and close.

## Phase 8 — Multi-Wallet and Multi-Currency

Deliverables:

- multiple wallets per customer by `wallet_type`;
- multiple currencies by separate wallet projection or balance bucket;
- explicit conversion flows through Transaction and Ledger;
- aggregation contract for channel display;
- settlement and reconciliation rules.

## Phase 9 — Production Hardening

Deliverables:

- concurrency controls;
- retry and dead-letter handling for projection/event failures;
- monitoring of projection lag;
- recovery and replay runbook;
- security review;
- retention and audit policy.

---

# 10. Documentation-Only Completion Rule

This pass is complete when the documentation is updated and final report confirms:

- changed files;
- architecture summary;
- wallet lifecycle;
- wallet states;
- wallet operations;
- future recommendations;
- no application code was modified.
