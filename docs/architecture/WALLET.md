# Документ: Wallet Architecture

Код: ARCH-FIN-WALLET-001
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
- `docs/tasks/FINANCE-004_WALLET_DOMAIN.md`
- `docs/governance/ENGINEERING_PROCESS.md`
- `docs/governance/QUALITY_GATES.md`

---

# 1. Purpose

Wallet is the Finance Platform domain that exposes current internal balance state for customers and future platform actors.

Wallet exists so Soft ICE Platform can:

- show the customer current internal balance;
- reserve internal funds during checkout;
- debit internal funds after confirmed financial flow;
- release reserved funds when an order, payment or machine flow fails;
- refund value back to an internal balance when the business process requires it;
- freeze or close a wallet without deleting financial history;
- provide one balance model for Telegram Mini App, MAX Mini App, CRM, Seller App, Machine Platform and future channels.

Wallet is not a payment provider, not accounting, not Bonus Engine, not Discount Engine and not the source of financial history.

---

# 2. Architectural Role

Wallet is a Finance Platform read model and operational projection.

Its architectural role:

```text
Transaction
↓
Ledger
↓
Wallet Projection
↓
Platform channels and finance workflows
```

Wallet provides fast current-state reads and validates wallet-specific commands, but the authoritative financial facts are stored in Ledger.

Wallet must remain independent from UI, channel, payment provider, accounting system and vending hardware.

---

# 3. Wallet Lifecycle

Wallet lifecycle:

```text
not_created
↓
created
↓
active
├─ frozen
│  └─ active
├─ closed
└─ archived
```

Lifecycle rules:

- `not_created` means no wallet projection exists yet for the owner and currency.
- `created` means the wallet projection exists, but it may not have financial activity yet.
- `active` means normal deposit, debit, reserve, release and refund operations are allowed.
- `frozen` means risky outgoing operations are blocked, while refunds, releases and audits remain possible.
- `closed` means the wallet is no longer usable for new business operations.
- `archived` means the wallet is retained for history, audit and compliance.

Wallet lifecycle transitions are commands. Successful lifecycle changes must be represented by Transaction, Ledger Entry when financially relevant, Wallet projection update and Wallet event.

---

# 4. Wallet States

Wallet states are separate from reservation states and payment states.

| State | Meaning | Allowed operations |
|---|---|---|
| `not_created` | Wallet projection does not exist. | `CreateWallet` |
| `created` | Wallet exists and waits for first use. | `Deposit`, `Freeze`, `Close` if balances are zero |
| `active` | Normal business state. | `Deposit`, `Debit`, `Reserve`, `Release`, `Refund`, `Freeze`, `Close` if eligible |
| `frozen` | Wallet is blocked for outgoing customer spending. | `Refund`, `Release`, `Unfreeze`, audit reads |
| `closed` | Wallet is closed and read-only. | Read, archive, audit |
| `archived` | Wallet is retained for history. | Audit reads only |

Reservation states:

| State | Meaning |
|---|---|
| `active` | Funds are reserved for an unfinished operation. |
| `released` | Reserved funds returned to available balance. |
| `captured` | Reserved funds became actual spending. |
| `expired` | Reservation passed expiry and must be released. |
| `cancelled` | Reservation cancelled through a compensating operation. |

Payment state must not be treated as Wallet state. Payment belongs to Payment Engine.

---

# 5. Wallet Projection Over Ledger

Important architecture rule:

```text
Wallet is NOT the source of truth.
Ledger is the source of truth.
Wallet is a projection.
```

Ledger stores immutable financial entries. Wallet stores current derived state.

Projection requirements:

- Wallet subscribes to Ledger events, especially `LedgerEntryRecorded`;
- Wallet can rebuild its state by replaying Ledger entries for `walletId`;
- Wallet stores the last processed Ledger position;
- if Wallet and Ledger conflict, Ledger wins;
- replay must not create new financial facts;
- projection lag must be detectable;
- duplicate Ledger events must be idempotent.

Projection flow:

```text
LedgerEntryRecorded
↓
WalletProjectionService validates event version and idempotency
↓
WalletProjectionService applies entry to wallet snapshot
↓
Wallet stores projectionVersion and sourceLedgerPosition
↓
Wallet publishes Wallet event
```

---

# 6. Wallet Balance Model

Wallet balance is a projection snapshot.

Minimal model:

```json
{
  "wallet_id": "wallet_01JZ0000000000000000000000",
  "owner_type": "customer",
  "owner_id": "customer_01JZ0000000000000000000000",
  "wallet_type": "customer_cash",
  "currency": "RUB",
  "status": "active",
  "available_balance": 130,
  "reserved_balance": 0,
  "total_balance": 130,
  "projection_version": 1,
  "source_ledger_position": "ledger_pos_000001",
  "created_at": "2026-07-02T00:00:00Z",
  "updated_at": "2026-07-02T00:00:00Z"
}
```

Balance fields:

| Field | Meaning |
|---|---|
| `available_balance` | Funds available for debit or reservation. |
| `reserved_balance` | Funds held for pending operations. |
| `total_balance` | `available_balance + reserved_balance`. |
| `currency` | Currency of this wallet projection. |
| `wallet_type` | Business type of wallet balance. |
| `projection_version` | Optimistic version of the projection. |
| `source_ledger_position` | Last Ledger position applied to this snapshot. |

Balance invariants:

- `available_balance >= 0`;
- `reserved_balance >= 0`;
- `total_balance >= 0` unless a future credit product is explicitly approved;
- `total_balance = available_balance + reserved_balance`;
- balances from different currencies are never mixed;
- bonus points are not stored as cash balance.

---

# 7. Supported Operations

Every supported operation must go through Transaction and Ledger before Wallet projection changes.

```text
Wallet command
↓
Transaction
↓
Ledger Entry
↓
Wallet projection update
↓
Wallet event
```

## 7.1 Deposit

Deposit increases `available_balance`.

Allowed sources:

- successful external payment when funds are stored as internal balance;
- refund to internal balance;
- gift balance if approved by product rules;
- cashback if approved as internal monetary balance;
- operator adjustment with audit reason.

Rules:

- Deposit must include `transaction_id`, `ledger_entry_id`, `amount`, `currency`, `reference_id` and idempotency key.
- Deposit must not be created directly from UI state.
- Payment Engine can trigger the flow, but it must not mutate Wallet directly.

Events:

- `WalletDeposited`;
- `WalletBalanceChanged`.

## 7.2 Debit

Debit decreases `available_balance`.

Rules:

- Debit cannot make `available_balance` negative.
- Checkout should prefer Reserve -> Capture when external payment or machine preparation can still fail.
- Debit cancellation is represented by a new compensating Ledger Entry.

Events:

- `WalletDebited`;
- `WalletBalanceChanged`.

## 7.3 Reserve

Reserve moves funds from available to reserved.

Projection effect:

```text
available_balance -= amount
reserved_balance += amount
total_balance unchanged
```

Rules:

- Reserve requires `reservation_id`.
- Reserve requires `expires_at`.
- Reserve is not revenue.
- Reserve must be linked to order, payment or another business reference.
- Reserve must be idempotent.

Events:

- `WalletReserved`;
- `WalletBalanceChanged`.

## 7.4 Release

Release returns reserved funds to available balance.

Projection effect:

```text
reserved_balance -= amount
available_balance += amount
total_balance unchanged
```

Release reasons:

- payment failed;
- order cancelled;
- order expired;
- machine cannot prepare product;
- operator cancellation;
- reservation expired.

Events:

- `WalletReservationReleased`;
- `WalletBalanceChanged`.

## 7.5 Capture

Capture is the internal operation that converts an active reservation into actual spending.

Projection effect:

```text
reserved_balance -= amount
total_balance -= amount
```

Capture remains documented because Reserve and Release are not enough for a complete checkout flow.

Events:

- `WalletReservationCaptured`;
- `WalletBalanceChanged`.

## 7.6 Refund

Refund increases available balance or reverses a previous wallet spending flow.

Rules:

- Refund must reference the original order, payment or transaction.
- Refund does not edit the original Ledger Entry.
- Refund is a new Transaction and Ledger Entry.
- Refund can be allowed while wallet is `frozen`.
- Refund to closed wallet requires either reopening by approved command or creating a new wallet according to future policy.

Events:

- `WalletRefunded`;
- `RefundCompleted` when the refund is exposed as an integration event;
- `WalletBalanceChanged`.

## 7.7 Close

Close makes a wallet read-only for new business operations.

Rules:

- Wallet can be closed only when `available_balance = 0`.
- Wallet can be closed only when `reserved_balance = 0`.
- Active reservations must be captured, released or expired before close.
- Closing a wallet never deletes Ledger history.

Events:

- `WalletClosed`.

## 7.8 Freeze

Freeze blocks outgoing customer spending and new reservations.

Allowed reasons:

- fraud review;
- support case;
- compliance review;
- operational incident;
- customer account protection.

Rules:

- Freeze must include actor and reason.
- Freeze must not block refunds or releases.
- Freeze does not change balance amount.

Events:

- `WalletFrozen`.

## 7.9 Unfreeze

Unfreeze returns wallet from `frozen` to `active`.

Rules:

- Unfreeze must include actor and reason.
- Unfreeze must not create balance changes.
- Unfreeze is allowed only from `frozen`.

Events:

- `WalletUnfrozen`.

---

# 8. Currency Model

MVP currency:

```text
RUB
```

Currency rules:

- one Wallet projection has one currency;
- every Transaction and Ledger Entry must include currency;
- Wallet refuses to apply Ledger Entry with mismatched currency;
- currency conversion is out of scope for MVP;
- formatting is UI responsibility, not Wallet responsibility;
- future multi-currency support must not change the core projection principle.

Recommended model:

```text
owner_id + wallet_type + currency = unique active wallet projection
```

---

# 9. Wallet Security Rules

Wallet contains financial data and must be protected.

Rules:

- every command requires authenticated actor context;
- operator commands require operator ID and reason;
- customer APIs may return only the current customer's wallet data;
- CRM and support reads require role-based access;
- events must not contain payment credentials, tokens or provider secrets;
- wallet events should minimize personal data;
- manual correction requires audit metadata;
- freeze, unfreeze and close are security-sensitive commands;
- financial logs must be protected from tampering;
- idempotency keys must be enforced for external triggers.

Actor types:

- `customer`;
- `operator`;
- `system`;
- `payment_provider`;
- `machine`;
- `migration`;
- `support`.

---

# 10. Event Interaction

Wallet publishes events after accepted projection changes.

Wallet subscribes to Ledger events.

Subscribed events:

| Event | Producer | Wallet action |
|---|---|---|
| `LedgerEntryRecorded` | Ledger Engine | Apply Ledger Entry to projection. |
| `LedgerReplayRequested` | Ledger / Operations | Rebuild projection from Ledger entries. |
| `TransactionCancelled` | Transaction Engine | Apply compensating Ledger entry only if recorded. |

Published events:

| Event | Type | Meaning |
|---|---|---|
| `WalletCreated` | domain | Wallet projection was created. |
| `WalletDeposited` | domain/integration | Deposit applied to projection. |
| `WalletDebited` | domain/integration | Debit applied to projection. |
| `WalletReserved` | domain/integration | Funds reserved. |
| `WalletReservationReleased` | domain/integration | Reservation released. |
| `WalletReservationCaptured` | domain/integration | Reservation captured. |
| `WalletRefunded` | domain/integration | Refund applied to wallet. |
| `WalletFrozen` | domain/integration | Wallet frozen. |
| `WalletUnfrozen` | domain/integration | Wallet unfrozen. |
| `WalletClosed` | domain/integration | Wallet closed. |
| `WalletBalanceChanged` | domain/integration | Balance snapshot changed. |
| `WalletProjectionRebuilt` | domain | Projection rebuilt from Ledger. |

Event rules:

- event names use English PascalCase;
- payload fields use snake_case;
- payloads include stable IDs;
- payloads include `transaction_id` and `ledger_entry_id` when available;
- event consumers must be idempotent;
- Event Storage does not replace Ledger.

---

# 11. Transaction Interaction

Wallet commands create or reference Transactions.

Transaction responsibilities:

- define financial intent;
- hold operation type and status;
- connect Wallet operation to order, payment, refund or operator action;
- provide immutable financial operation identity.

Wallet responsibilities:

- validate wallet-specific state and balances;
- reject impossible operations;
- apply Ledger entries to projection;
- publish Wallet events after projection update.

Rules:

- Wallet never bypasses Transaction.
- Wallet never creates hidden financial history.
- Transaction status does not equal Wallet state.
- Transaction failure must not mutate Wallet unless a compensating Ledger Entry is recorded.

---

# 12. Bonus Interaction

Bonus points are not money.

Business rule:

```text
1 bonus = right to receive a discount with nominal value of 1 RUB.
```

Rules:

- Wallet never calculates bonuses.
- Wallet never stores bonus points as cash.
- Bonus Engine owns accrual, redemption, expiration and bonus reservation.
- Pricing Engine may calculate the allowed bonus redemption limit.
- Ledger may record bonus operations for audit, but Bonus projection belongs to Bonus Engine.
- Checkout may coordinate Bonus reservation and Wallet reservation, but the domains remain separate.

---

# 13. Discount Interaction

Discounts are price modifiers, not wallet balances.

Rules:

- Wallet never calculates discounts.
- Discount rules belong to Pricing / Discount / Promotion domain.
- Wallet receives already calculated financial intent after Pricing.
- Discount amount must be visible through Transaction and Ledger references, not invented inside Wallet.
- Applying a discount must not create wallet cash unless an approved promotion explicitly creates a monetary deposit.

---

# 14. Payment Interaction

Payment Engine owns external payment attempts.

Wallet owns internal balance projection and reservations.

Rules:

- Payment Engine never mutates Wallet directly.
- Wallet never calls YooKassa, SBP, bank card APIs or other payment providers.
- `PaymentCompleted` can cause Ledger entries that lead to Wallet deposit or capture.
- `PaymentFailed` can cause Ledger entries that lead to Wallet release.
- external payment amount and internal wallet amount must be explicit and separate.

Typical checkout:

```text
Pricing Result
↓
Wallet reserve, if internal balance is used
↓
Payment Engine collects remaining external amount
↓
PaymentCompleted
↓
Ledger records payment and wallet capture
↓
Wallet projection updates
↓
Machine Platform may start preparation
```

---

# 15. Accounting Interaction

Wallet never performs accounting.

Accounting Adapter reads Ledger first and may read Wallet projection for reconciliation.

Rules:

- active reserve is not revenue;
- release is not revenue and not refund;
- capture or sale is a financial fact for accounting processing;
- refund is a separate financial fact;
- Accounting Adapter must not mutate Wallet;
- Wallet snapshot is useful for current obligations, not historical accounting truth.

---

# 16. Notification Interaction

Notification Engine reacts to Wallet and related finance events.

Wallet does not send messages directly.

Possible notification triggers:

- `WalletDeposited`;
- `WalletRefunded`;
- `WalletReservationReleased`;
- `WalletFrozen`;
- `WalletUnfrozen`;
- `WalletClosed`;
- `WalletBalanceChanged` when a user-visible balance update is needed.

Rules:

- message templates are not Wallet contracts;
- notification delivery status does not change Wallet balance;
- failed notification must not rollback Wallet operation;
- Notification Engine must correlate messages with Wallet event IDs.

---

# 17. CRM Interaction

CRM consumes Wallet events and queries Wallet read models for support and operations.

CRM may use Wallet data for:

- customer balance view;
- support case investigation;
- refund support workflow;
- fraud or compliance review;
- customer history projection;
- operator audit trail.

Rules:

- CRM does not become source of truth for Wallet;
- CRM must not edit wallet balances directly;
- CRM operator actions must call approved Wallet commands;
- every operator action requires actor ID, reason and audit metadata;
- CRM projections are derived from events and read models.

---

# 18. API Contracts

Future Platform Contracts should define Wallet commands, queries and event schemas.

## 18.1 Commands

Planned commands:

- `CreateWallet`;
- `DepositWallet`;
- `DebitWallet`;
- `ReserveWalletFunds`;
- `ReleaseWalletReservation`;
- `CaptureWalletReservation`;
- `RefundWallet`;
- `FreezeWallet`;
- `UnfreezeWallet`;
- `CloseWallet`;
- `RebuildWalletProjection`.

Command contract fields:

| Field | Purpose |
|---|---|
| `command_id` | Idempotent command identity. |
| `wallet_id` | Target wallet. |
| `owner_id` | Wallet owner. |
| `amount` | Operation amount when applicable. |
| `currency` | Operation currency. |
| `reference_id` | Order, payment, refund or support reference. |
| `actor` | Customer, operator, system or provider actor. |
| `metadata` | Non-secret operational metadata. |

## 18.2 Queries

Planned queries:

- `GetWalletByOwner`;
- `GetWalletBalance`;
- `GetWalletReservations`;
- `GetWalletProjectionStatus`;
- `GetWalletStatement`;
- `GetWalletAuditTrail`.

Query rules:

- balance queries may read Wallet projection;
- statement queries must be sourced from Ledger;
- UI must not reconstruct balance from local state;
- API responses must be channel-neutral for Telegram Mini App, MAX Mini App, CRM, Seller App and Machine Platform.

## 18.3 Events

Wallet event contracts must follow `docs/architecture/EVENT_PLATFORM.md`.

Minimal `WalletBalanceChanged` payload:

```json
{
  "wallet_id": "wallet_01JZ0000000000000000000000",
  "owner_id": "customer_01JZ0000000000000000000000",
  "transaction_id": "transaction_01JZ0000000000000000000000",
  "ledger_entry_id": "ledger_entry_01JZ0000000000000000000000",
  "operation_type": "WALLET_RESERVE",
  "currency": "RUB",
  "available_balance": 0,
  "reserved_balance": 130,
  "total_balance": 130,
  "source_ledger_position": "ledger_pos_000001"
}
```

---

# 19. Future Multi-Wallet Support

Wallet must support future multiple wallets per customer.

Possible future wallet types:

- `customer_cash`;
- `gift_balance`;
- `refund_balance`;
- `cashback_balance`;
- `franchise_credit`;
- `operator_adjustment`;
- `machine_settlement`.

Rules:

- wallet type must be explicit;
- each wallet has its own projection;
- transfer between wallet types is a financial operation through Transaction and Ledger;
- UI may show combined balance only through an approved aggregation contract;
- Ledger remains the source of truth for every wallet type.

Future examples:

```text
customer_123 + customer_cash + RUB
customer_123 + gift_balance + RUB
customer_123 + refund_balance + RUB
```

---

# 20. Future Multi-Currency Support

Wallet must support future multiple currencies without changing the source-of-truth model.

Rules:

- each currency has a separate wallet projection or balance bucket;
- currency conversion belongs to a future FX / Finance Rules domain, not Wallet core;
- every conversion must create explicit Transactions and Ledger Entries;
- display formatting remains channel/UI responsibility;
- settlement and accounting must preserve original currency and converted value where required.

Future examples:

```text
customer_123 + customer_cash + RUB
customer_123 + customer_cash + KZT
customer_123 + customer_cash + USD
```

---

# 21. Architecture Principles

Wallet architecture follows these principles:

1. Ledger is the source of truth.
2. Wallet is a projection over Ledger.
3. Wallet is independent from UI.
4. Wallet supports Telegram Mini App, MAX Mini App, CRM, Seller App and Machine Platform through contracts.
5. Wallet never calculates bonuses.
6. Wallet never calculates discounts.
7. Wallet never performs accounting.
8. Wallet never performs external payment.
9. Wallet publishes events after accepted projection changes.
10. Wallet subscribes to Ledger events.
11. Wallet supports future multiple currencies.
12. Wallet supports future multiple wallets per customer.
13. Wallet commands must be idempotent.
14. Wallet projection must be rebuildable from Ledger.
15. Wallet must not expose provider secrets or unnecessary personal data.
16. Wallet must preserve auditability for operator actions.

---

# 22. Readiness Criteria

Wallet architecture is ready for implementation when:

- Transaction Domain has stable contracts;
- Ledger Domain has append-only entries and `LedgerEntryRecorded` event;
- Ledger operation types for reservation, release, capture, refund, freeze and close are approved or mapped;
- Wallet command/query/event contracts are approved;
- Bonus and Discount boundaries are confirmed;
- Payment and Accounting boundaries are confirmed;
- Notification and CRM consumers are defined;
- idempotency policy is documented;
- projection rebuild procedure is documented;
- future tests cover all supported operations.

---

# 23. Documentation Scope

This document is architecture-only.

It does not introduce JavaScript implementation, frontend changes, routes, styles, package changes, database migrations, payment integration or cloud infrastructure.
