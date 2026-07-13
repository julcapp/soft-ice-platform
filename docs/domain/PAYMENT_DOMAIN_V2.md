# Payment Domain v2

Document code: DOMAIN-PAYMENT-002
Task: FINANCE-009 / PAYMENT-DOMAIN-V2
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
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/MVP_BACKEND_ARCHITECTURE.md`
- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/data/DATABASE_FOUNDATION.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/domain/BONUS_DOMAIN.md`
- `docs/domain/ORDER_DOMAIN.md`
- `docs/domain/MACHINE_DOMAIN.md`
- `docs/api/REST_API.md`
- `docs/api/EVENT_API.md`
- `docs/tasks/TASK_INDEX.md`

Required decisions:

- `DECISION-033` - YooKassa Is the Primary Payment Provider.
- `DECISION-034` - Payment Operations Registry.
- `DECISION-035` - Financial Registry Is Internal.
- `DECISION-036` - Payment Provider Agnostic Model.
- `DECISION-037` - YooKassa API Configuration Uses Environment Variables.
- `DECISION-041` - Database Foundation Uses PostgreSQL and Prisma With Domain-Separated Immutable Records.

---

# 1. Purpose

This document defines Payment Domain v2 architecture for Soft ICE Platform.

Payment Domain v2 is the provider-independent architecture for payment intents, payment sessions, immutable payment operations, refund operations and internal payment registry records.

The domain exists so the platform can:

- create payment requests for Club Account top-up, product purchase and future approved financial scenarios;
- create concrete payment attempts through providers and payment presentations such as links, QR codes and Telegram payment surfaces;
- normalize provider outcomes into platform payment states;
- record immutable financial events for downstream domains;
- support refunds and reconciliation;
- support multiple vending machines, products, payment providers and sales channels;
- stay ready for future ERP and accounting export.

Core rule:

```text
Payment Domain records and confirms payment facts.
Payment Domain does not own product price, Club Account balance, Bonus balance, Order lifecycle or Machine execution.
Successful payment creates auditable financial events consumed by other domains.
```

This document is documentation-only and introduces no payment code.

---

# 2. Scope

Included:

- Payment Domain v2 principles;
- PaymentIntent model;
- PaymentSession model;
- PaymentOperation model;
- PaymentRegistry model;
- refund model;
- Club Account top-up flow;
- product purchase flow;
- QR payment flow;
- YooKassa integration boundary;
- PaymentIntent and PaymentSession state models;
- audit, reconciliation and future readiness rules;
- explicit non-implementation scope.

Out of scope:

- real API keys;
- YooKassa API calls;
- SBP production integration;
- webhook handlers;
- database migrations;
- accounting integration;
- runtime implementation;
- provider credentials;
- production payment processing.

---

# 3. Payment Domain Principles

Payment Domain v2 follows these non-negotiable principles:

1. Payment domain is provider-independent.
2. Payment does not store business balance.
3. Payment does not modify Club Account directly.
4. Successful payment creates financial events consumed by other domains.
5. All operations must be auditable.

Provider independence means YooKassa, SBP link, QR payment, Telegram payment and future providers use the same domain concepts:

```text
PaymentIntent
-> PaymentSession
-> PaymentOperation
-> PaymentRegistry
```

Payment does not store business balance:

- Club Account stores customer-facing prepaid balance and transactions.
- Bonus Domain stores non-monetary discount rights.
- Wallet or Ledger-backed projections store financial balance projections where approved.
- Payment stores amount, currency, purpose, provider references, status and immutable operation facts.

Payment does not modify Club Account directly:

```text
Payment confirms payment
-> PaymentOperation is appended
-> payment financial event is published
-> Club Account consumes event/command through its own contract
-> Club Account appends its own transaction
```

Successful payment creates financial events consumed by:

- Club Account for top-up credit;
- Order for paid-state evaluation;
- Ledger or future Finance Runtime for financial source-of-truth recording;
- Accounting Adapter for future export;
- CRM and support projections;
- Notification Runtime for customer-safe messages;
- Analytics for minimized reporting.

Auditability applies to every sensitive payment operation:

- intent creation;
- session creation;
- provider request;
- payment confirmation;
- payment failure;
- cancellation;
- refund creation;
- refund completion;
- provider reconciliation;
- manual review and support resolution.

---

# 4. Domain Boundary

Payment Domain owns:

- payment intent lifecycle;
- payment session lifecycle;
- provider-neutral payment status;
- provider adapter boundary;
- provider references and reconciliation metadata;
- immutable payment operations;
- refund operations;
- payment registry and reports;
- payment audit and idempotency requirements.

Payment Domain does not own:

- product catalog;
- product configuration;
- price calculation;
- discount calculation;
- bonus accrual, reservation or redemption;
- Club Account balance mutation;
- business balance projections;
- Ledger as financial source of truth;
- Order lifecycle outside consumed payment facts;
- Machine dispatch or physical execution;
- notification template or delivery;
- CRM operator UI;
- external accounting system integration.

Boundary summary:

```text
Checkout / Order / Club Account produces an approved payable purpose.
Payment creates and confirms a provider-independent payment.
Payment emits immutable financial events.
Owning domains consume those events through their own contracts.
```

---

# 5. Core Entities

Payment Domain v2 uses four primary entities and one refund model:

| Entity | Purpose |
|---|---|
| `PaymentIntent` | Customer or system request to create a payment. |
| `PaymentSession` | Concrete payment attempt with an external or channel-specific provider. |
| `PaymentOperation` | Immutable financial event. |
| `PaymentRegistry` | Internal register of payment operations, references, reports and reconciliation. |
| `Refund` | Compensating payment operation linked to an original payment. |

---

# 6. PaymentIntent

Purpose:

```text
Customer or system request to create payment.
```

PaymentIntent is provider-independent. It represents the platform decision that a specific amount should be collected for a specific purpose.

Fields concept:

| Field | Meaning |
|---|---|
| `id` | Stable platform payment intent identifier. |
| `customer_reference` | Reference to `customer_id`, anonymous customer context or system actor where allowed. |
| `amount` | Payment amount in approved money representation. |
| `currency` | Currency, MVP default `RUB`. |
| `purpose` | Why payment is required. |
| `status` | Intent state from the PaymentIntent state model. |
| `expiration_time` | Time after which the intent cannot be paid normally. |
| `created_at` | UTC creation timestamp. |

Recommended additional references:

- `order_id` for product purchase;
- `club_account_id` for top-up destination correlation only;
- `sales_channel_id`;
- `machine_id` when a specific machine context is already selected;
- `idempotency_key`;
- `correlation_id`;
- `created_by`.

Supported purpose values:

| Purpose | Meaning |
|---|---|
| `club_account_top_up` | Customer adds prepaid value to Club Account. |
| `product_purchase` | Customer pays for an order. |
| `support_payment` | Approved support or CRM payment request. |
| `replacement_payment` | Replacement for an expired or failed prior attempt. |
| `future_provider_purpose` | Reserved for future approved payment use cases. |

PaymentIntent rules:

- intent amount comes from an approved domain flow;
- intent amount is not recalculated by Payment Domain;
- one intent can have one or more sessions over time;
- expired intent cannot create normal successful payment without review or replacement;
- paid intent is not edited to represent refunds;
- intent history must remain auditable.

---

# 7. PaymentSession

Purpose:

```text
Concrete payment attempt with external provider.
```

PaymentSession represents the provider or channel-specific attempt that the customer can act on.

Supported payment session types:

- YooKassa;
- SBP link;
- QR payment;
- Telegram payment.

Fields concept:

| Field | Meaning |
|---|---|
| `id` | Stable platform payment session identifier. |
| `payment_intent_id` | Parent PaymentIntent. |
| `provider` | Provider or channel adapter, such as `yookassa`, `sbp`, `qr`, `telegram_payment`. |
| `external_payment_id` | Provider payment ID or channel attempt reference. |
| `payment_url` | Provider, platform or channel URL for customer confirmation. |
| `qr_payload` | QR payload or opaque QR reference when QR is used. |
| `expiration_time` | Time after which this attempt is invalid. |
| `status` | Session state from the PaymentSession state model. |

Recommended additional fields:

- `created_at`;
- `activated_at`;
- `expired_at`;
- `confirmed_at`;
- `failure_reason`;
- `replacement_session_id`;
- `idempotency_key`;
- `correlation_id`;
- `provider_capability_snapshot`.

PaymentSession rules:

- session is an attempt, not the financial source of truth;
- session must belong to exactly one PaymentIntent;
- session has explicit expiration;
- session provider references are correlation metadata, not platform identity;
- payment URL and QR payload must not contain provider secrets, API keys, card data or raw personal data;
- replacing a session creates a new session or operation; it does not erase the old session;
- session success must create a PaymentOperation before other domains consume payment success.

---

# 8. PaymentOperation

Purpose:

```text
Immutable financial event.
```

PaymentOperation is the append-only fact that records what happened in the payment lifecycle.

Required operation types:

| Type | Meaning |
|---|---|
| `PAYMENT_CREATED` | A payment intent/session or payment attempt was created. |
| `PAYMENT_CONFIRMED` | Payment was confirmed successfully by platform policy. |
| `PAYMENT_FAILED` | Payment failed, was declined or cannot be completed normally. |
| `REFUND_CREATED` | Refund workflow was created. |
| `REFUND_COMPLETED` | Refund completed successfully. |
| `PAYMENT_CANCELLED` | Payment was cancelled before successful completion. |

Fields concept:

| Field | Meaning |
|---|---|
| `id` | Stable payment operation identifier. |
| `payment_intent_id` | Related PaymentIntent. |
| `payment_session_id` | Related PaymentSession when applicable. |
| `operation_type` | One of the required operation types. |
| `amount` | Amount affected by this operation. |
| `currency` | Currency. |
| `provider` | Provider or channel adapter. |
| `external_reference` | Masked provider payment, refund, webhook or report reference. |
| `status` | Accepted, rejected, pending review or completed operation status. |
| `reason` | Reason code or failure/refund/cancellation reason. |
| `created_at` | UTC timestamp when operation was recorded. |

Audit fields:

- `actor_type`;
- `actor_id`;
- `source_channel`;
- `correlation_id`;
- `causation_id`;
- `idempotency_key`;
- `provider_event_reference`;
- `manual_review_reference`;
- `recorded_at`.

PaymentOperation rules:

- operations are immutable after acceptance;
- corrections use a new operation;
- provider payloads are normalized before operation creation;
- operation events must not contain provider secrets or raw card data;
- consumers must be idempotent;
- `PAYMENT_CONFIRMED` is the successful payment fact consumed by other domains.

---

# 9. PaymentRegistry

Purpose:

```text
Internal register of payment operations.
```

PaymentRegistry is the internal register used to reconstruct, reconcile, report and export payment history. It is not a provider cabinet mirror and it is not the Club Account balance.

PaymentRegistry includes:

- provider reconciliation;
- external references;
- reports;
- accounting export.

Registry responsibilities:

| Area | Responsibility |
|---|---|
| Provider reconciliation | Compare internal operations with YooKassa, SBP, QR or Telegram provider reports/statuses. |
| External references | Store masked provider payment IDs, refund IDs, webhook IDs, report IDs and import batch IDs. |
| Reports | Produce internal payment reports for finance, support, CRM and Product Owner review. |
| Accounting export | Prepare Ledger-backed or finance-approved export references for future accounting/ERP integration. |

Registry record concept:

```json
{
  "payment_registry_id": "payment_registry_01JZ0000000000000000000000",
  "payment_intent_id": "payment_intent_01JZ0000000000000000000000",
  "payment_operation_id": "payment_op_01JZ0000000000000000000000",
  "provider": "yookassa",
  "external_payment_reference": "provider_payment_ref_masked",
  "external_refund_reference": null,
  "registry_type": "provider_reconciliation",
  "status": "matched",
  "report_period": "2026-07-13",
  "accounting_export_reference": null,
  "created_at": "2026-07-13T00:00:00Z"
}
```

PaymentRegistry rules:

- internal registry is the platform-controlled traceability layer;
- provider reports are inputs, not the only source of history;
- every imported provider record must be correlated, matched, marked unknown or routed to review;
- registry reports must not expose secrets or raw card data;
- accounting export depends on approved finance and Ledger/accounting contracts;
- unresolved mismatches require manual review or compensating operations.

---

# 10. Refund Model

Refund is a compensating payment process linked to an original successful payment.

Refund types:

| Type | Meaning |
|---|---|
| `full_refund` | Refunds the full remaining refundable amount. |
| `partial_refund` | Refunds less than the remaining refundable amount. |

Refund fields concept:

| Field | Meaning |
|---|---|
| `refund_id` | Stable platform refund identifier. |
| `payment_intent_id` | Original payment intent. |
| `payment_session_id` | Original session where applicable. |
| `payment_operation_id` | Original successful operation reference. |
| `refund_type` | `full_refund` or `partial_refund`. |
| `amount` | Refund amount. |
| `currency` | Currency. |
| `refund_reason` | Business, support, machine, cancellation or provider reason. |
| `provider` | Provider used for refund execution. |
| `provider_reference` | Masked provider refund ID/reference. |
| `status` | Refund state. |
| `created_at` | UTC creation timestamp. |
| `completed_at` | UTC completion timestamp when completed. |

Recommended refund statuses:

| Status | Meaning |
|---|---|
| `CREATED` | Refund was requested and recorded. |
| `PROCESSING` | Provider/internal refund execution is in progress. |
| `COMPLETED` | Refund was completed. |
| `FAILED` | Refund failed and requires retry or review. |
| `CANCELLED` | Refund request was cancelled before execution where policy allows. |
| `MANUAL_REVIEW` | Outcome is ambiguous or risky. |

Refund rules:

- refund never edits the original payment operation;
- full refund and partial refund create new operations;
- partial refund cannot exceed remaining refundable amount;
- refund reason is required;
- provider reference is correlation metadata only;
- refund completion creates `REFUND_COMPLETED`;
- refund failure must not silently change Order, Club Account or Machine state;
- refund to Club Account, original method or future wallet follows approved domain policy.

---

# 11. State Models

## 11.1 PaymentIntent States

Required states:

| State | Meaning |
|---|---|
| `CREATED` | Payment intent exists but no active payment session is waiting for customer confirmation yet. |
| `WAITING_PAYMENT` | At least one active session is waiting for customer or provider confirmation. |
| `PAID` | Payment was confirmed and accepted by Payment Domain policy. |
| `FAILED` | Payment cannot complete through this intent because of failure. |
| `EXPIRED` | Intent expired before successful payment. |
| `CANCELLED` | Intent was cancelled before successful payment. |

Allowed high-level transitions:

```text
CREATED -> WAITING_PAYMENT
WAITING_PAYMENT -> PAID
WAITING_PAYMENT -> FAILED
WAITING_PAYMENT -> EXPIRED
CREATED -> CANCELLED
WAITING_PAYMENT -> CANCELLED
```

State rules:

- `PAID`, `FAILED`, `EXPIRED` and `CANCELLED` are terminal for normal payment collection;
- refund does not change a `PAID` intent back to unpaid;
- replacement payment uses a new intent or an explicitly linked replacement flow;
- terminal state corrections use audit and new operations.

## 11.2 PaymentSession States

Required states:

| State | Meaning |
|---|---|
| `CREATED` | Session record exists but is not yet active for customer confirmation. |
| `ACTIVE` | Session can be used by the customer through URL, QR, Telegram payment or provider handoff. |
| `EXPIRED` | Session lifetime ended without normal success. |
| `SUCCESS` | Provider/channel confirmed successful payment for this session and Payment Domain accepted it. |
| `FAILED` | Session failed or was declined. |

Allowed high-level transitions:

```text
CREATED -> ACTIVE
ACTIVE -> SUCCESS
ACTIVE -> FAILED
ACTIVE -> EXPIRED
```

State rules:

- session expiration does not delete PaymentIntent or PaymentOperation history;
- old sessions remain auditable after replacement;
- session `SUCCESS` must be correlated to `PAYMENT_CONFIRMED`;
- expired session success reported later enters reconciliation before downstream state changes.

---

# 12. Payment Flow A: Club Account Top-Up

Scenario:

```text
Customer
-> PaymentIntent
-> PaymentSession
-> Provider
-> Confirmation
-> PaymentOperation
-> Club Account transaction
```

Flow:

1. Customer chooses top-up amount through an approved channel.
2. Club Account or Checkout-facing policy validates that a top-up may be requested.
3. Payment Domain creates `PaymentIntent` with purpose `club_account_top_up`.
4. Payment Domain creates `PaymentSession` for the selected provider or channel.
5. Customer confirms through provider URL, QR, SBP link or Telegram payment surface.
6. Provider confirmation is normalized by Payment Domain.
7. Payment Domain appends `PAYMENT_CONFIRMED` as a `PaymentOperation`.
8. Payment Domain emits a financial event.
9. Club Account consumes the event through its own contract.
10. Club Account appends a Club Account transaction such as top-up credit.

Top-up boundaries:

- Payment does not increase Club Account balance directly.
- Club Account does not call provider APIs directly.
- A failed top-up creates `PAYMENT_FAILED` and no balance credit.
- Duplicate provider confirmations must credit Club Account only once through idempotency.

---

# 13. Payment Flow B: Product Purchase

Scenario:

```text
Customer
-> Order
-> Payment
-> Machine dispatch
-> Completion
```

Flow:

1. Customer selects product and options.
2. Product, Pricing, Discount and Bonus domains produce an accepted payable result.
3. Order is created with immutable product, configuration, price and discount snapshots.
4. Payment Domain creates `PaymentIntent` with purpose `product_purchase`.
5. Payment Domain creates `PaymentSession`.
6. Customer confirms payment.
7. Payment Domain appends `PAYMENT_CONFIRMED`.
8. Order consumes payment fact and evaluates paid transition.
9. Order requests Machine dispatch only after paid state is accepted.
10. Machine Domain executes paid fulfillment and reports completion/failure facts.

Purchase boundaries:

- Payment does not calculate product price.
- Payment does not decide machine readiness.
- Machine never starts preparation from provider status alone.
- Order is the boundary between payment confirmation and machine dispatch.
- Machine failure after payment is handled through Order, Payment and support/refund policy, not by editing payment history.

---

# 14. Payment Flow C: QR Payment

QR payment is a PaymentSession presentation where the customer scans a QR code to confirm payment.

Required QR concepts:

- QR generation;
- QR lifetime;
- expiration;
- payment checking;
- successful confirmation.

Flow:

```text
PaymentIntent CREATED
-> PaymentSession CREATED
-> QR generated
-> PaymentSession ACTIVE
-> Customer scans QR
-> Provider or channel processes payment
-> Platform checks payment by webhook or polling
-> PAYMENT_CONFIRMED
-> PaymentIntent PAID
```

QR generation rules:

- QR is generated only from a valid PaymentIntent and PaymentSession.
- QR payload points to an opaque payment reference, provider URL or platform URL.
- QR payload must not include secrets, raw card data, provider API keys or unnecessary personal data.
- QR display should include expiration where the channel supports it.

QR lifetime rules:

- every QR session has `expiration_time`;
- QR validity is controlled by platform/provider policy, not by frontend timers alone;
- expiration makes the session unusable for normal confirmation;
- regenerated QR creates a new session or operation reference;
- expired QR remains auditable.

Payment checking:

- webhook confirmation is the preferred provider-originated fact when available and verified;
- polling fallback reads provider status when webhook is delayed, unavailable or ambiguous;
- polling must not create duplicate provider side effects;
- UI timers must not decide successful payment.

Successful confirmation:

- provider success is mapped into platform state;
- Payment Domain appends `PAYMENT_CONFIRMED`;
- PaymentIntent becomes `PAID`;
- PaymentSession becomes `SUCCESS`;
- downstream domains consume the platform event, not the raw QR/provider payload.

Expiration behavior:

- if the QR expires without success, PaymentSession becomes `EXPIRED`;
- PaymentIntent may become `EXPIRED` or receive a replacement session according to policy;
- late provider success after expiration enters reconciliation before Order, Club Account or Machine state changes.

---

# 15. Payment Flow D: YooKassa

YooKassa is the primary initial provider, but it remains an adapter boundary.

Architecture boundary:

```text
Payment Domain
-> Payment Provider Port
-> YooKassa Adapter
-> YooKassa API
```

API integration boundary:

- YooKassa API request/response shapes stay inside the YooKassa adapter.
- Payment Domain receives normalized provider-independent results.
- YooKassa payment ID is stored as provider reference, not platform ID.
- YooKassa credentials are runtime secrets and are not stored in this document.
- This document does not add YooKassa API calls.

Webhook boundary:

- YooKassa webhook payload enters through a provider webhook boundary.
- Webhook authenticity must be verified before it can affect payment state.
- Webhook handling must be idempotent.
- Raw webhook payloads are protected integration records, not domain events.
- This document does not add webhook handlers.

Polling fallback concept:

- polling reads provider status when webhook is delayed, absent or ambiguous;
- polling maps provider status into platform states;
- polling must use idempotency and current-state checks;
- polling must not repeat charge/refund side effects;
- ambiguous provider result enters reconciliation or manual review.

Reconciliation reports:

- internal PaymentOperations are compared with YooKassa provider reports;
- mismatches are recorded in PaymentRegistry;
- unknown provider records require investigation before becoming platform facts;
- missing provider records for internal payments require reconciliation review;
- accounting export uses approved internal financial facts and registry references, not raw provider cabinet data alone.

YooKassa flow:

```text
PaymentIntent
-> PaymentSession with provider yookassa
-> YooKassa Adapter creates provider attempt
-> Customer confirmation URL or QR is shown
-> YooKassa webhook or polling reports status
-> YooKassa status is mapped
-> PaymentOperation is appended
-> PaymentRegistry records provider reference
-> Downstream domains consume platform financial event
```

---

# 16. Sales Channels

Payment Domain v2 supports multiple sales channels through the same model.

Supported and future channels:

- Telegram Mini App;
- Telegram Bot;
- Web App;
- vending terminal UI;
- CRM/support;
- future partner or franchise channels.

Channel rules:

- every PaymentIntent should include `sales_channel_id`;
- channel-specific presentation is handled by PaymentSession;
- Telegram payment is a session/provider type, not a separate business model;
- channel UI must not infer financial success from redirect, QR scan, timer or button state;
- channel-specific errors are normalized into Payment Domain outcomes.

---

# 17. Multi-Machine, Product and Provider Readiness

Payment Domain v2 must support:

- multiple vending machines;
- multiple products;
- multiple providers;
- multiple sales channels;
- future ERP/accounting integration.

Multiple vending machines:

- PaymentIntent may include machine context when payment is tied to a selected machine.
- Payment success alone does not dispatch to a machine.
- Order and Machine domains decide paid fulfillment using safe references.
- Payment records can be correlated with `machine_id` or dispatch IDs for support and reconciliation.

Multiple products:

- Payment does not store product configuration as source of truth.
- Order stores product snapshots.
- Payment references Order or payable purpose.
- Product changes do not rewrite payment history.

Multiple providers:

- provider is a PaymentSession/adapter attribute;
- PaymentIntent and PaymentOperation remain provider-neutral;
- adding a provider requires adapter and capability mapping, not a new payment business model;
- provider-specific statuses are mapped before leaving the adapter boundary.

Multiple sales channels:

- channel is explicit through `sales_channel_id`;
- each channel can present different PaymentSession forms;
- all channels create the same PaymentIntent, PaymentSession and PaymentOperation facts.

Future ERP/accounting:

- PaymentRegistry stores export references and reconciliation status;
- accounting export requires future Accounting Adapter/Ledger approval;
- ERP records consume internal financial facts, not raw provider payloads alone;
- payment audit and registry records must support period reports and reconciliation batches.

---

# 18. Audit and Idempotency

All operations must be auditable.

Required audit metadata:

| Field | Purpose |
|---|---|
| `actor_type` | customer, system, operator, provider, adapter or scheduler. |
| `actor_id` | Stable actor reference where available. |
| `source_channel` | Mini App, Telegram Bot, terminal, CRM, backend, provider or scheduler. |
| `operation_type` | PaymentOperation type or refund action. |
| `target_id` | Intent, session, operation, refund or registry record. |
| `amount` | Amount affected when financial. |
| `currency` | Currency. |
| `provider` | Provider or channel adapter. |
| `external_reference` | Masked provider reference. |
| `reason` | Reason code. |
| `correlation_id` | End-to-end business flow ID. |
| `causation_id` | Command, event or provider fact that caused the operation. |
| `idempotency_key` | Duplicate side-effect protection. |
| `created_at` | UTC timestamp. |

Idempotency rules:

- intent creation uses idempotency for duplicate customer/system commands;
- provider session creation uses idempotency to avoid duplicate charges;
- webhook processing is deduplicated by provider event and payment references;
- polling must not duplicate payment or refund side effects;
- `PAYMENT_CONFIRMED` must be consumed once by each downstream domain;
- refunds require idempotency by refund request and amount;
- repeated reports/reconciliation imports must not create duplicate operations.

Security rules:

- no raw card number;
- no CVV or PIN;
- no provider secret key;
- no unmasked authorization headers;
- no raw webhook signatures in domain events;
- no unnecessary personal data in PaymentOperation events.

---

# 19. Domain Events

Payment Domain v2 emits facts, not commands.

Recommended event mapping:

| PaymentOperation | Event meaning | Example consumers |
|---|---|---|
| `PAYMENT_CREATED` | Payment was created and can be presented or tracked. | CRM, analytics, support. |
| `PAYMENT_CONFIRMED` | Payment succeeded by platform policy. | Order, Club Account, Ledger/Finance, Notification. |
| `PAYMENT_FAILED` | Payment failed or was declined. | Order, Club Account, Notification, CRM. |
| `REFUND_CREATED` | Refund workflow started. | Order, CRM, support, finance. |
| `REFUND_COMPLETED` | Refund completed. | Order, Club Account, Ledger/Finance, Notification. |
| `PAYMENT_CANCELLED` | Payment cancelled before success. | Order, CRM, support, analytics. |

Event rules:

- events use platform IDs and normalized statuses;
- events must be idempotent for consumers;
- events must not contain provider secrets or raw payment credentials;
- provider raw payloads stay in protected adapter records;
- downstream domains make their own source-of-truth changes after consuming events.

---

# 20. What Is Not Implemented

This document explicitly does not implement:

- no real API keys;
- no YooKassa calls;
- no SBP production integration;
- no webhook handlers;
- no accounting integration;
- no payment runtime code;
- no provider adapter code;
- no database migrations;
- no Prisma schema changes;
- no frontend payment UI;
- no Telegram payment integration;
- no machine dispatch changes;
- no Club Account transaction code;
- no refund execution code.

---

# 21. Future Implementation Guardrails

Future implementation must not begin until the relevant task explicitly approves code changes.

Before implementing Payment Domain v2, future tasks must define:

1. command and query contracts;
2. event payload schemas;
3. money representation;
4. provider adapter ports;
5. YooKassa status mapping;
6. webhook verification policy;
7. polling schedule and retry policy;
8. QR lifetime policy;
9. refund authorization policy;
10. PaymentRegistry storage schema;
11. reconciliation workflow;
12. Ledger and Accounting Adapter mapping;
13. CRM/support manual review flow;
14. test scenarios for top-up, purchase, QR, YooKassa, failure, expiration and refund.

Future implementation must preserve:

- provider independence;
- immutable operations;
- no direct Club Account mutation by Payment;
- no business balance in Payment;
- auditable provider references;
- no raw secrets or card data in domain records;
- machine dispatch only after accepted Order paid state.

---

# 22. Readiness Criteria

Payment Domain v2 architecture is complete when:

- payment domain principles are documented;
- PaymentIntent is defined;
- PaymentSession is defined with YooKassa, SBP link, QR payment and Telegram payment support;
- PaymentOperation is defined as immutable financial event with required operation types;
- PaymentRegistry is defined with provider reconciliation, external references, reports and accounting export direction;
- refund model defines full refund, partial refund, refund reason, provider reference and status;
- Club Account top-up flow is documented;
- product purchase flow is documented;
- QR payment flow is documented;
- YooKassa boundary is documented;
- PaymentIntent and PaymentSession states are documented;
- explicit non-implemented scope is documented;
- support for multiple machines, products, providers, sales channels and future ERP/accounting integration is documented;
- `docs/architecture/PROJECT_DECISIONS.md`, `CHANGELOG.md`, `ENGINEERING_JOURNAL.md` and `docs/tasks/TASK_INDEX.md` are updated;
- `git diff --check` passes;
- no application build is required because this task is documentation-only.

---

# 23. Documentation Scope

This document is documentation-only.

It does not introduce application code, frontend code, backend runtime code, Telegram bot code, YooKassa API integration, SBP production integration, QR payment runtime, webhook handlers, database migrations, Prisma schema changes, real API keys, provider credentials, accounting integration, generated build output, Club Account transaction code, Order runtime changes or Machine dispatch changes.
