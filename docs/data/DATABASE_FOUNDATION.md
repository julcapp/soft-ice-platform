# Database Foundation v1

Document code: DATA-DATABASE-FOUNDATION-001
Task: EPIC-351 / DATA-002
Version: 0.1
Status: Draft
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-13
Last updated: 2026-07-13
Scope: Documentation only

Related documents:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `docs/architecture/ARCHITECTURE_PRINCIPLES.md`
- `docs/architecture/PROJECT_DECISIONS.md`
- `docs/architecture/MVP_BACKEND_ARCHITECTURE.md`
- `docs/architecture/BACKEND_FOUNDATION.md`
- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/domain/BONUS_DOMAIN.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/domain/ORDER_DOMAIN.md`
- `docs/domain/MACHINE_DOMAIN.md`
- `docs/tasks/TASK_INDEX.md`

---

# 1. Purpose

This document defines the database foundation v1 strategy for Soft ICE Platform.

It translates the logical data model direction into a future PostgreSQL and Prisma storage strategy for the first production backend, while staying documentation-only.

Core rule:

```text
PostgreSQL is the primary datasource.
Prisma is the ORM and migration layer.
Domain ownership is explicit.
Financial records are immutable.
Auditability is mandatory.
This document creates no runtime code, no migrations and no tables.
```

The database foundation must keep the platform ready for:

- multiple vending machines;
- multiple products;
- multiple payment providers;
- multiple sales channels.

---

# 2. Scope

Included:

- database principles for the future production PostgreSQL model;
- Prisma role as ORM and migration layer;
- domain separation strategy;
- core entity strategy for Customer, Club Account, Bonus Account, Payment Intent, Payment Operation, Order, Machine and Machine Event;
- entity relationships and cardinality;
- immutable financial and audit rules;
- future readiness requirements for machines, products, payment providers and sales channels.

Out of scope:

- runtime implementation;
- Prisma schema changes;
- Prisma migrations;
- database table creation;
- seed data;
- production database provisioning;
- real payment processing;
- payment webhooks;
- machine integration runtime;
- final legal retention policy;
- final provider-specific payload schemas.

---

# 3. Database Principles

## 3.1 PostgreSQL as Primary Datasource

PostgreSQL is the primary datasource for source-of-truth platform records.

Future PostgreSQL storage must hold accepted business and operational facts for:

- customers and identity links;
- contacts and consent references;
- Club Account transactions;
- Bonus Account transactions;
- payment intents, payment operations, refunds and reconciliation records;
- orders, product snapshots, pricing snapshots and fulfillment state;
- machine identity, configuration, status and events;
- audit, idempotency and internal event outbox records.

Temporary JSON and in-memory data may continue to exist during MVP development, but production source-of-truth records must move to PostgreSQL through explicit future tasks.

## 3.2 Prisma as ORM and Migration Layer

Prisma is the database access and migration layer for the backend.

Rules:

- Prisma models are implementation artifacts that must follow the documented domain model.
- Prisma migrations are created only in future implementation tasks.
- `schema.prisma` must not become the only architecture source of truth.
- Every future migration must be reviewed against `docs/data/PLATFORM_DATA_MODEL.md`, this document and the relevant domain documents.
- Migrations must preserve historical financial, payment, order, consent, machine and audit facts.

This documentation task does not create or modify Prisma migrations.

## 3.3 Immutable Financial Records

Financial and financial-adjacent records are append-only after acceptance.

Immutable records include:

- Club Account transactions;
- Bonus Account transactions;
- Payment operations;
- refund operations;
- payment provider webhook records after accepted processing;
- order payment snapshots;
- reconciliation results after closure;
- future Ledger-backed facts.

Corrections must be represented as new compensating records. Historical financial facts must not be edited in place to hide mistakes.

## 3.4 Auditability

Database design must allow support, finance, operations and security review to reconstruct what happened.

Auditable records must include, where applicable:

- stable platform ID;
- actor type and actor ID;
- source channel;
- action or operation type;
- target type and target ID;
- reason code;
- amount and currency for financial facts;
- provider and masked provider reference for external operations;
- correlation ID;
- causation ID;
- idempotency key reference;
- created or occurred timestamp in UTC.

Audit records must not store raw card data, provider secrets, Telegram init data, API keys, webhook signatures or unnecessary personal data.

## 3.5 Separation of Domains

The database must preserve module and domain ownership.

Recommended future PostgreSQL ownership groups:

| Logical group | Owner | Example records |
|---|---|---|
| `customer` | Customer Runtime | customers, identity links, contacts, consent references |
| `club_account` | Club Account Runtime | accounts, transactions, reservations, top-up references |
| `bonus` | Bonus Runtime | accounts, transactions, batches, expiration records |
| `payment` | Payment Runtime | intents, sessions, operations, refunds, provider references |
| `orders` | Order Runtime | orders, order items, snapshots, payment bindings, fulfillment records |
| `machine` | Machine Runtime | machines, locations, configuration, status, events, incidents |
| `event` | Event Layer | outbox records, event envelopes, consumer offsets |
| `audit` | Platform Services | audit events, manual review records |
| `integration` | Integration Layer | protected webhook records and adapter correlation records |

Physical implementation may use PostgreSQL schemas, table prefixes or another explicit ownership convention. The ownership boundary must remain visible in code review and database review.

Ownership rule:

```text
Only the owning Runtime writes source-of-truth records.
Other domains use commands, queries, references, snapshots, events or projections.
```

---

# 4. Core Entities

This section defines the database foundation v1 core entities. It is not a physical DDL specification.

## 4.1 Customer

Customer is the canonical platform identity for a person.

Owned by: Customer Runtime.

Primary identifier:

```text
customer_id
```

Responsibilities:

- stable platform identity;
- lifecycle status;
- profile summary;
- contact references;
- consent management references;
- external identity links;
- customer-safe relationship to Club Account, Bonus Account, Orders and Payments.

Required strategy:

- `customer_id` is the internal identity used by all domains;
- Telegram ID, MAX ID, phone, email and future OAuth identities are external aliases;
- external identities must resolve to `customer_id` before business logic uses them;
- contacts are separate records or protected references, not loose fields copied across domains;
- consent history is separate, auditable and versioned;
- customer closure must preserve legal, order, payment and audit references.

Supporting records:

| Supporting entity | Purpose |
|---|---|
| `CustomerIdentity` | Links `customer_id` to Telegram, MAX, phone, email or future external identity provider. |
| `ContactPoint` | Stores protected phone, email, Telegram chat or other contact route metadata. |
| `CustomerConsent` | Records consent status, document version, channel, source and evidence reference. |

External identities:

- `telegram`;
- `max`;
- `phone`;
- `email`;
- future OAuth or partner identities.

## 4.2 ClubAccount

ClubAccount is the customer-facing prepaid wallet for Soft ICE Platform purchases.

Owned by: Club Account Runtime.

Primary identifier:

```text
club_account_id
```

Responsibilities:

- prepaid customer wallet;
- balance state;
- top-up references;
- debit/spending authorization;
- refund application;
- immutable account transactions;
- customer-safe balance and history projection.

Balance rules:

- MVP currency is `RUB`;
- one customer has at most one active Club Account per currency unless a future policy approves otherwise;
- available balance and reserved balance are separate;
- balance changes happen only through immutable transactions;
- available balance must not become negative;
- reserved balance must not become negative;
- corrections use compensating transactions;
- UI must never calculate or mutate balance locally.

Required transaction types:

| Type | Meaning |
|---|---|
| `top_up_requested` | Customer requested a top-up; no balance change yet. |
| `top_up_credit` | Successful top-up credited after accepted payment fact. |
| `purchase_reserved` | Balance reserved for an accepted checkout. |
| `purchase_debit` | Reserved balance captured or debited for completed purchase settlement. |
| `reservation_released` | Reserved balance returned after failed, cancelled or expired flow. |
| `refund_credit` | Refund credited as a compensating transaction. |
| `manual_adjustment_credit` | Approved support or finance credit. |
| `manual_adjustment_debit` | Approved support or finance debit correction. |

Supporting record:

```text
ClubAccountTransaction
```

`ClubAccountTransaction` is append-only and must include amount, currency, balance delta, source, actor, reason and correlation metadata.

## 4.3 BonusAccount

BonusAccount is the customer-facing account for discount points.

Owned by: Bonus Runtime.

Primary identifier:

```text
bonus_account_id
```

Responsibilities:

- discount points;
- accrual;
- reservation for spending;
- spending/redemption;
- expiration rules;
- immutable bonus transaction history.

Rules:

- bonus points are not money;
- bonus points are not Club Account balance;
- bonus points are not a payment method;
- bonus redemption affects payable amount before payment;
- accrual and spending are represented by immutable transactions;
- expiration must be traceable to batch, rule or campaign source;
- corrections use reversal or compensating bonus transactions.

Required transaction categories:

| Category | Meaning |
|---|---|
| `accrual` | Bonus points granted from order, referral, campaign or manual rule. |
| `reservation` | Points reserved for a checkout before final redemption. |
| `spending` | Points redeemed as discount effect. |
| `release` | Reserved points returned after failed, cancelled or expired flow. |
| `expiration` | Points expired by policy. |
| `correction` | Reversal or manual correction with audit reason. |

Supporting records:

- `BonusTransaction`;
- `BonusBatch` or equivalent expiration source record.

## 4.4 PaymentIntent

PaymentIntent is the provider-independent request to collect money for an approved purpose.

Owned by: Payment Runtime.

Primary identifier:

```text
payment_intent_id
```

Responsibilities:

- payment request lifecycle;
- provider-independent amount, currency and purpose;
- relation to customer, order, Club Account top-up or support operation;
- sales channel reference;
- selected payment method policy;
- creation of future payment sessions and payment operations.

Required strategy:

- PaymentIntent stores platform amount and currency;
- provider payment IDs are references, not platform IDs;
- YooKassa, SBP, QR payments, payment links and future providers use the same intent model;
- payment session expiration must not erase the intent history;
- repeated payment attempts create new sessions or operations, not silent overwrites;
- Order may dispatch to Machine only after Payment Runtime accepts a completed payment fact.

Suggested lifecycle:

```text
created
->
awaiting_confirmation
->
processing
->
completed
```

Closure and review states:

```text
failed
expired
cancelled
manual_review
```

Supported purposes:

- `order_payment`;
- `club_account_top_up`;
- `refund_recovery`;
- `support_payment`;
- future provider-approved purposes.

## 4.5 PaymentOperation

PaymentOperation is the append-only record of an accepted payment-related action or fact.

Owned by: Payment Runtime.

Primary identifier:

```text
payment_operation_id
```

Responsibilities:

- successful payments;
- failed payments;
- refunds;
- provider callbacks;
- provider status polling;
- reconciliation;
- provider references;
- audit trail for payment lifecycle.

Required operation types:

| Type | Meaning |
|---|---|
| `intent_created` | Platform intent was created. |
| `session_created` | Payment link, QR or provider confirmation session was created. |
| `provider_request_sent` | Provider side effect was requested. |
| `webhook_received` | Provider webhook was verified and accepted into adapter boundary. |
| `status_polled` | Provider status was checked. |
| `payment_completed` | Platform accepted successful payment completion. |
| `payment_failed` | Payment failed or was declined. |
| `payment_expired` | Session or intent expired. |
| `refund_requested` | Refund workflow started. |
| `refund_completed` | Refund was completed as compensating operation. |
| `reconciliation_checked` | Provider, Payment and internal financial facts were compared. |
| `manual_review_requested` | Ambiguous or risky state requires review. |
| `manual_review_resolved` | Approved review outcome was recorded. |

Provider references:

- provider name, such as `yookassa`;
- masked provider payment reference;
- masked provider refund reference;
- provider report or reconciliation batch reference.

PaymentOperation must not contain provider secrets, raw card data, raw webhook signatures or unmasked authorization headers.

## 4.6 Order

Order is the customer purchase aggregate.

Owned by: Order Runtime.

Primary identifier:

```text
order_id
```

Responsibilities:

- customer purchase lifecycle;
- accepted product details;
- immutable product configuration snapshot;
- pricing and discount snapshot;
- payment relation;
- machine interaction relation;
- fulfillment and support state.

Required strategy:

- every order references `customer_id` when a customer exists;
- every order references `sales_channel_id`;
- every paid order references payment intent and accepted payment operation or payment binding;
- product details are stored as immutable snapshots, not live catalog reads;
- order item model must support one MVP item and future multi-item orders;
- order must not store provider-specific payment fields as business state;
- order dispatch to machine is allowed only after paid state is accepted;
- terminal order states are immutable.

Product details snapshot should include:

- `product_id`;
- product version or catalog version reference;
- selected flavor, syrup, topping and future add-ons;
- recipe reference;
- media reference where needed for history;
- quantity;
- price snapshot;
- discount snapshot;
- bonus effect snapshot when used.

Machine relation should include:

- selected or assigned `machine_id`;
- dispatch queue or operation reference;
- machine result status;
- failure or recovery reference where needed.

## 4.7 Machine

Machine is the platform identity for a vending machine.

Owned by: Machine Runtime.

Primary identifier:

```text
machine_id
```

Responsibilities:

- vending machine identity;
- location;
- configuration;
- capabilities;
- operational status;
- inventory and readiness projection;
- machine adapter or vendor aliases;
- relation to orders and machine events.

Required strategy:

- `machine_id` is the platform ID;
- vendor machine ID, controller ID or hardware serial number are aliases;
- location is separate from machine identity;
- configuration is versioned or auditable;
- status is derived from accepted machine facts and operator changes;
- future multiple machines must not require changes to Order, Payment or Customer identity models;
- machine records must support offline, maintenance, blocked, ready, busy and error states.

Machine should be ready for:

- multiple locations;
- multiple machines per location;
- multiple machine models;
- different capability profiles;
- different adapter providers;
- staged maintenance and status transitions.

## 4.8 MachineEvent

MachineEvent is an immutable fact reported by a machine, adapter or platform operator process.

Owned by: Machine Runtime.

Primary identifier:

```text
machine_event_id
```

Responsibilities:

- telemetry events;
- error events;
- sales events;
- command acknowledgements;
- operation outcome facts;
- incident investigation;
- support and analytics projections.

Required event categories:

| Category | Examples |
|---|---|
| `telemetry` | temperature, connectivity, component state, inventory level, heartbeat |
| `error` | component failure, preparation failure, blocked machine, stale telemetry |
| `sales` | paid order accepted, preparation started, product dispensed, operation completed |
| `command` | command accepted, command rejected, command timed out |
| `maintenance` | cleaning required, maintenance started, maintenance completed |

MachineEvent rules:

- events are append-only;
- raw vendor payloads stay inside protected adapter records unless approved and masked;
- every event references `machine_id`;
- sales and fulfillment events should reference `order_id` and operation reference when available;
- events must include source, event type, occurred timestamp and recorded timestamp;
- ambiguous physical outcomes must go to reconciliation or support review before retrying physical side effects.

---

# 5. Relationships

Core relationship rules:

| Relationship | Cardinality | Rule |
|---|---:|---|
| Customer -> CustomerIdentity | 1 -> N | Telegram, MAX, phone, email and future aliases link to one canonical customer unless conflict review exists. |
| Customer -> ContactPoint | 1 -> N | Contacts are protected records with verification and primary flags. |
| Customer -> CustomerConsent | 1 -> N | Consent records are versioned and auditable. |
| Customer -> ClubAccount | 1 -> 0..1 active per currency | Future multi-account support requires explicit policy. |
| ClubAccount -> ClubAccountTransaction | 1 -> N | Transactions are immutable and append-only. |
| Customer -> BonusAccount | 1 -> 0..1 active per program | Future multi-program support requires explicit policy. |
| BonusAccount -> BonusTransaction | 1 -> N | Accrual, spending, release, expiration and corrections are append-only. |
| Customer -> PaymentIntent | 1 -> N | Payment intent can be for order payment, Club Account top-up or support scenario. |
| PaymentIntent -> PaymentOperation | 1 -> N | Every provider action, callback, refund and reconciliation fact is append-only. |
| Customer -> Order | 1 -> N | Orders reference customer when known and retain historical customer relation. |
| Order -> PaymentIntent | 1 -> 0..N | Retry or replacement payment attempts create new references, not mutation of old facts. |
| Order -> PaymentOperation | 1 -> 0..N | Paid state relies on accepted payment completion operation. |
| Order -> Machine | N -> 0..1 selected for fulfillment | MVP may assign one machine; future routing supports many machines. |
| Machine -> MachineEvent | 1 -> N | Machine facts are append-only and can drive projections. |
| MachineEvent -> Order | N -> 0..1 | Sales and fulfillment events can reference the related order. |
| MachineEvent -> PaymentOperation | N -> 0..1 | Only when needed for paid-order correlation or reconciliation. |
| SalesChannel -> Order | 1 -> N | Every order must identify its sales channel. |
| SalesChannel -> PaymentIntent | 1 -> N | Every payment flow must identify its sales channel. |

Supporting relationship principles:

- Order stores product snapshots and references catalog IDs; Product remains a separate domain.
- PaymentOperation stores provider references; provider records are not platform IDs.
- ClubAccount and BonusAccount do not write Order state directly.
- Machine events report physical facts; Order decides lifecycle transitions through approved contracts.
- Audit and event outbox records reference source entity IDs without owning those entities.

---

# 6. Provider, Channel and Product Readiness

## 6.1 Multiple Vending Machines

The foundation must support multiple vending machines from the beginning.

Required design direction:

- every machine has `machine_id`;
- every machine can have vendor aliases;
- every machine has location and configuration references;
- order fulfillment references assigned machine and operation;
- machine telemetry is scoped by `machine_id`;
- machine readiness is derived from machine state, inventory, maintenance and telemetry freshness;
- paid dispatch is idempotent and auditable.

## 6.2 Multiple Products

The foundation must support more than the initial vanilla soft ice cream cup.

Required design direction:

- orders store product snapshots;
- order items reference stable `product_id`;
- configuration snapshots include selected options;
- pricing snapshots preserve historical amount and currency;
- recipe references support machine execution;
- media references support historical display and support views;
- catalog changes must not rewrite historical orders.

## 6.3 Multiple Payment Providers

The foundation must support YooKassa first and future providers later.

Required design direction:

- PaymentIntent is provider-independent;
- PaymentOperation records provider name and masked provider reference;
- provider payloads stay inside protected integration records;
- provider statuses are mapped to platform statuses;
- SBP, QR, payment links, cards, Club Account and future methods use the same payment model;
- reconciliation compares internal facts with provider reports instead of trusting provider cabinets as the only history.

## 6.4 Multiple Sales Channels

The foundation must support Telegram Mini App, Telegram Bot, Web App, terminal UI, CRM and future channels.

Required design direction:

- every order references `sales_channel_id`;
- every payment intent references `sales_channel_id`;
- consent and notification records preserve source channel;
- audit records preserve source channel;
- sales channel is not inferred from UI code;
- channel-specific behavior is handled through contracts and configuration.

---

# 7. What Is Not Implemented Yet

This document explicitly does not implement:

- real payment processing;
- YooKassa API calls;
- SBP payment processing;
- QR payment processing;
- payment links;
- payment webhooks;
- webhook verification;
- refund execution;
- reconciliation automation;
- Prisma migrations;
- database tables;
- production database provisioning;
- production database credentials;
- machine dispatch;
- machine telemetry ingestion;
- customer registration runtime;
- Club Account balance mutation runtime;
- Bonus accrual or spending runtime;
- Order checkout runtime.

The current platform may have backend foundation files and local configuration, but this document does not add database schema, tables, migrations or production storage.

---

# 8. Future Implementation Guardrails

Before any future database migration is created, the implementation task must confirm:

1. Which Runtime owns the table or model.
2. Which entity or projection is source of truth.
3. Whether the record is mutable, append-only or immutable after acceptance.
4. Which fields are required for audit.
5. Which fields are personal data or sensitive provider data.
6. Which provider references are correlation metadata only.
7. Which indexes are needed for identity resolution, idempotency, reconciliation and support.
8. Which records require retention or anonymization policy.
9. How historical orders, payments, refunds, bonus transactions and Club Account transactions remain reconstructable.
10. How the migration can be rolled back safely without losing accepted business facts.

Future migrations must not:

- store provider secrets;
- store raw card data;
- store raw Telegram init data;
- rewrite historical financial records;
- make UI state the source of truth;
- collapse Customer, Payment, Order and Machine ownership into one generic table;
- bypass audit for sensitive state changes.

---

# 9. Readiness Criteria

Database foundation v1 is complete when:

- PostgreSQL primary datasource strategy is documented;
- Prisma ORM and migration layer role is documented;
- immutable financial record strategy is documented;
- auditability strategy is documented;
- domain separation strategy is documented;
- Customer, ClubAccount, BonusAccount, PaymentIntent, PaymentOperation, Order, Machine and MachineEvent are documented;
- relationships between entities are documented;
- not-implemented scope is explicit;
- future readiness for multiple machines, products, payment providers and sales channels is documented;
- `docs/architecture/PROJECT_DECISIONS.md`, `CHANGELOG.md`, `ENGINEERING_JOURNAL.md` and `docs/tasks/TASK_INDEX.md` are updated;
- `git diff --check` passes;
- no application build is required because this task is documentation-only.

---

# 10. Documentation Scope

This document is documentation-only.

It does not introduce application code, frontend code, backend runtime code, Telegram bot code, Prisma schema changes, Prisma migrations, database tables, generated build output, real payment processing, payment webhooks, production database infrastructure, production credentials, machine dispatch runtime or notification runtime.
