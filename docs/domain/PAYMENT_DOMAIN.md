# Payment Domain

Document code: DOMAIN-PAYMENT-001
Task: EPIC-300 / DOMAIN-004
Version: 0.1
Status: Draft
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-07
Last updated: 2026-07-07
Scope: Documentation only

Related documents:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/domain/BONUS_DOMAIN.md`
- `docs/api/REST_API.md`
- `docs/api/EVENT_API.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/ACCOUNTING_ADAPTER.md`
- `docs/architecture/PROJECT_DECISIONS.md`
- `docs/architecture/LEDGER.md`
- `docs/architecture/WALLET.md`
- `docs/architecture/CHECKOUT.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/tasks/TASK_INDEX.md`

Required decisions:

- `DECISION-033` - YooKassa Is the Primary Payment Provider.
- `DECISION-034` - Payment Operations Registry.
- `DECISION-035` - Financial Registry Is Internal.
- `DECISION-036` - Payment Provider Agnostic Model.
- `DECISION-037` - YooKassa API Configuration Uses Environment Variables.

---

# 1. Payment Domain Purpose

Payment Domain describes how Soft ICE Platform accepts, confirms, records, reconciles, cancels and refunds payments.

The domain exists so the platform can:

- create payment intents from approved checkout, order or Club Account top-up scenarios;
- create limited-lifetime payment sessions for card, SBP, QR, payment link, saved payment method and future payment methods;
- use YooKassa as the primary provider while keeping business logic provider agnostic;
- normalize external provider states into platform payment states;
- confirm payment through webhooks, status polling or approved internal settlement facts;
- prevent product preparation until full confirmed payment exists;
- store every meaningful payment operation internally;
- support full and partial refunds as new compensating financial operations;
- build internal financial history independently from provider reports;
- reconcile internal payment state, Ledger facts, provider reports, accounting exports, order state and Club Account projections;
- provide safe payment events for Order, Club Account, Bonus, Ledger, Accounting, Notification, CRM, Analytics and Machine domains.

Core rule:

```text
Payment Domain owns payment lifecycle and settlement confirmation.
Payment model is provider agnostic.
YooKassa is the primary provider adapter, not the business model.
Payment operations are stored internally.
Provider reports are reconciliation inputs, not the only financial history.
Machine receives only paid orders.
```

This document is documentation-only and introduces no application code.

---

# 2. DDD Lite Boundary

Payment Domain is a DDD Lite bounded context inside the Finance Platform.

Architecture position:

```text
Customer / Club Account / Checkout / Order
->
Accepted payable amount and settlement plan
->
Payment Domain
->
Payment Provider Adapter / Wallet / Club Account settlement
->
Payment Operations Registry
->
Ledger / Accounting Adapter / Reports
->
Order paid state
->
Machine dispatch
```

Payment Domain owns:

- payment intent model;
- payment session model;
- payment aggregate lifecycle;
- payment method and method-line model;
- saved payment method references and consent status for payment use;
- one-click top-up payment flow;
- recurring payment and auto top-up payment policy boundary;
- provider adapter abstraction;
- YooKassa provider role and mapping rules;
- SBP, QR and payment-link settlement flows;
- confirmation, webhook and status polling rules;
- expiration, failure and cancellation rules;
- refund and partial refund operations;
- payment operation registry;
- payment reports and provider registries;
- reconciliation rules;
- payment audit trail;
- payment domain events.

Payment Domain does not own:

- product catalog, recipes or media;
- product configuration;
- price calculation;
- discount stacking or payable amount calculation;
- bonus rights, bonus reservation, bonus redemption or bonus expiration;
- Club Account balance projection;
- Wallet balance projection;
- Ledger as financial source of truth;
- external provider API schemas as platform business contracts;
- accounting export formats;
- order lifecycle outside payment facts;
- machine command delivery;
- notification templates or delivery;
- CRM screens;
- API route authentication and authorization.

Boundary rule:

```text
Payment consumes an accepted payable amount.
Payment does not decide what should be payable.
```

Payment may reject inconsistent settlement input, such as method-line totals that do not equal the accepted payable amount. It must not recalculate the settlement plan locally.

---

# 3. Ubiquitous Language

| Term | Meaning |
|---|---|
| Payment Domain | Bounded context that owns payment lifecycle and settlement confirmation. |
| Payment ID | Stable platform identifier stored as `payment_id`. |
| Payment Intent | Platform-owned request to collect a specific amount for an approved business purpose. |
| Payment Session | Limited-lifetime confirmation context shown to or used by the customer. |
| Payment Method | Provider-neutral method type such as `card`, `sbp`, `payment_link`, `qr`, `club_account`, `wallet` or future method. |
| Method Line | One part of a settlement plan with amount, currency, method and state. |
| Saved Payment Method | Provider-safe reusable payment method reference saved after explicit consent. It is not called a saved card. |
| One-Click Top-Up | Customer-confirmed top-up using a saved payment method reference. |
| Auto Top-Up | Voluntary customer policy that may initiate a top-up when configured conditions are met. |
| Confirmation | Accepted evidence that payment status has changed, from webhook, polling or internal settlement fact. |
| Webhook | Provider callback verified before it can affect platform payment state. |
| Status Polling | Platform-initiated provider status read used when webhook is delayed, absent or ambiguous. |
| QR Payment | Payment session represented as QR code or QR payload. |
| Payment Link | Provider-safe or platform-safe URL that leads to payment confirmation. |
| Refund | New compensating financial operation linked to original payment. |
| Partial Refund | Refund for less than the refundable remaining captured amount. |
| Payment Operation | Append-only internal record of an accepted payment-related action or fact. |
| Provider Report | External provider statement, registry, settlement file or report used for reconciliation. |
| Reconciliation | Comparison of Payment operations, Ledger, provider reports, accounting state and order state. |

Customer-facing language should use "payment method", "saved payment method", "payment link", "QR payment", "SBP payment", "refund" and "top up". It must not call saved payment methods "saved cards" unless a future legal and UX decision explicitly approves that wording.

---

# 4. Required Architecture Decisions

Payment Domain relies on four required decisions.

| Decision | Summary |
|---|---|
| `DECISION-033` | YooKassa is the primary payment provider for the first provider-backed payment integration. |
| `DECISION-034` | Payment operations must be stored in an internal append-only operations registry. |
| `DECISION-035` | Financial registry is internal; external provider reports are reconciliation inputs, not the only source of financial history. |
| `DECISION-036` | Payment business model is provider agnostic; provider-specific fields stay inside adapters and protected integration records. |

Rules created by these decisions:

- business logic must not depend on YooKassa-specific field names, statuses or payloads;
- SBP, QR, payment links, cards, saved payment methods and future providers use the same payment model;
- every provider action must be correlated to a platform payment operation;
- provider success alone does not replace internal payment and Ledger recording policy;
- refunds, cancellations and corrections are new operations, not edits of old records.

---

# 5. Payment Provider Agnostic Model

Payment Domain uses a provider-neutral model for all payment methods.

Core model:

```json
{
  "payment_id": "payment_01JZ0000000000000000000000",
  "payment_intent_id": "payment_intent_01JZ0000000000000000000000",
  "customer_id": "customer_01JZ0000000000000000000000",
  "order_id": "order_01JZ0000000000000000000000",
  "club_account_id": null,
  "purpose": "order_payment",
  "status": "pending_confirmation",
  "amount": 130,
  "currency": "RUB",
  "provider": "yookassa",
  "provider_payment_reference": "provider_payment_ref_masked",
  "method_lines": [
    {
      "method_line_id": "payment_line_01JZ0000000000000000000000",
      "method_type": "sbp",
      "amount": 130,
      "currency": "RUB",
      "status": "pending_confirmation",
      "provider": "yookassa",
      "provider_reference": "provider_line_ref_masked"
    }
  ],
  "session": {
    "payment_session_id": "payment_session_01JZ0000000000000000000000",
    "confirmation_type": "qr",
    "expires_at": "2026-07-07T10:15:00Z"
  },
  "created_at": "2026-07-07T10:00:00Z",
  "updated_at": "2026-07-07T10:00:05Z"
}
```

Provider-agnostic rules:

- `payment_id` is the platform payment identity;
- provider payment ID is only a correlation reference;
- payment status uses platform enum values, not provider enum values;
- method-line amounts must sum to the accepted payable amount;
- one payment may contain one or more method lines;
- payment links and QR codes are confirmation presentations for a payment session, not separate business models;
- provider capabilities are selected by policy, channel, currency, legal and risk configuration;
- provider raw payloads, signatures and secrets must not become Payment Domain fields;
- provider-specific data may be stored only in protected integration records or adapter logs with masking and retention policy;
- UI, Order, Club Account, Bonus and Machine domains consume platform state only.

MVP examples use integer RUB amounts for readability. Future API schemas must explicitly define whether amount fields use minor units, decimal strings or another finance-wide money representation.

---

# 6. YooKassa as Primary Payment Provider

YooKassa is the primary payment provider for initial external payment processing.

Role:

```text
Payment Domain
->
Payment Provider Port
->
YooKassa Provider Adapter
->
YooKassa API
```

YooKassa rules:

- YooKassa is primary provider, not the Payment Domain model;
- YooKassa API calls live only inside the YooKassa provider adapter;
- YooKassa SDKs, constants, request fields and status names must not be imported by Order, Club Account, Bonus, Machine, UI or generic Payment Domain code;
- YooKassa API configuration is read from environment variables by backend/runtime configuration only;
- YooKassa payment ID is stored as provider reference, not platform payment ID;
- YooKassa confirmation data is short-lived operational data;
- YooKassa webhooks must be verified before platform state changes;
- YooKassa statuses are mapped into platform payment states;
- YooKassa idempotency keys are derived from platform operation identity;
- YooKassa refunds are represented as platform refund operations;
- YooKassa provider reports are reconciliation inputs, not authoritative platform financial history by themselves;
- YooKassa receipt, fiscalization and tax details require separate fiscalization/accounting decisions before production use;
- YooKassa secrets must never appear in frontend code, events, examples, logs or customer-visible responses.

Expected YooKassa capability use:

| Capability | Payment Domain interpretation |
|---|---|
| Card payment | External provider method line of type `card`. |
| SBP payment | External provider method line of type `sbp`. |
| Payment link | Confirmation presentation for a limited-lifetime session. |
| QR confirmation | Confirmation presentation for SBP or another provider-supported flow. |
| Webhook | Provider fact input after signature verification and deduplication. |
| Refund | Provider-backed compensating operation linked to original payment line. |

If YooKassa and platform state disagree, reconciliation decides the next action. Other domains must not resolve the conflict from provider data directly.

## YooKassa API Configuration

YooKassa API settings are runtime configuration for the YooKassa provider adapter.

Required variables:

| Variable | Required value or source | Secret | Storage rule |
|---|---|---:|---|
| `YOOKASSA_SHOP_ID` | `1368517` | No | May be documented and stored in non-secret configuration. |
| `YOOKASSA_SECRET_KEY` | Secure environment variable | Yes | Must never be stored in code, Markdown, `.env.example`, committed `.env` files, events or logs. |
| `YOOKASSA_API_URL` | `https://api.yookassa.ru/v3` | No | May be documented and stored in non-secret configuration. |

Configuration rules:

- `YOOKASSA_SECRET_KEY` is supplied only by the deployment/runtime environment or a local uncommitted `.env` file;
- `.env.example` may contain only the variable name with an empty value;
- real `.env` files must remain ignored by Git;
- backend startup may validate that `YOOKASSA_SECRET_KEY` exists, but must not print the value;
- adapter logs may include safe configuration presence checks and masked provider references, never the secret key or authorization header;
- frontend, Mini App, Telegram bot UI and public documentation must not receive `YOOKASSA_SECRET_KEY`.

---

# 7. Supported Payment Experiences

Payment Domain supports several customer payment experiences through the same model.

| Experience | Model mapping | Notes |
|---|---|---|
| Card payment | Payment method `card` with provider session. | Provider owns card entry and challenge. |
| SBP payment | Payment method `sbp` with QR, deep link or bank-app handoff. | Confirmation is asynchronous. |
| Payment by link | Payment session with URL presentation. | Link has limited lifetime. |
| QR payment | Payment session with QR presentation. | QR has limited lifetime and no secrets. |
| Club Account payment | Internal prepaid method line through Club Account and Ledger contracts. | Payment does not own Club Account balance. |
| Wallet payment | Internal wallet method line through Wallet and Ledger contracts where used. | Wallet projection remains separate. |
| Saved payment method | Provider-safe method reference after consent. | Not raw card storage. |
| One-click top-up | Customer-confirmed top-up using saved payment method. | Still creates a payment intent and operations. |
| Auto top-up | Consented policy-triggered top-up. | Voluntary, limited and revocable. |
| Future provider method | New provider adapter behind same payment model. | No business-model rewrite. |

Experience rules:

- every experience creates or uses a platform payment intent;
- every confirmable experience has a payment session with `expires_at`;
- expired sessions cannot start product preparation;
- method-specific UI is presentation only and must not infer financial success;
- successful provider confirmation must be normalized into Payment Domain state before Order can become paid.

---

# 8. SBP Payments

SBP payments are provider-backed or future adapter-backed payments using the Fast Payment System.

SBP model:

```json
{
  "method_type": "sbp",
  "confirmation_type": "qr_or_deep_link",
  "amount": 130,
  "currency": "RUB",
  "status": "pending_confirmation",
  "provider": "yookassa"
}
```

SBP rules:

- SBP payment is created only for an accepted payable amount;
- confirmation may happen through QR code, deep link, bank app handoff or provider-hosted page;
- customer bank credentials are never stored by Soft ICE Platform;
- SBP is asynchronous until provider status is confirmed or the session expires;
- SBP normally behaves as immediate payment after confirmation, not as long authorization hold;
- SBP QR or link has limited lifetime;
- duplicate SBP callbacks are idempotent;
- delayed SBP success after local expiration enters reconciliation instead of starting preparation automatically;
- SBP refund must reference the original payment and method line.

SBP flow:

```text
PaymentIntentCreated
->
PaymentSessionCreated
->
SBP confirmation presented
->
Customer confirms in bank app
->
Webhook or polling confirms status
->
PaymentCompleted after internal recording policy
->
Order may become paid
```

---

# 9. Payment by Link

Payment by link is a limited-lifetime payment session represented as a URL.

Link types:

- provider-hosted confirmation URL;
- platform-hosted URL that redirects to provider confirmation;
- deep link to a bank or provider app when approved;
- CRM or support-generated payment link for an approved payment intent.

Payment link model:

```json
{
  "payment_session_id": "payment_session_01JZ0000000000000000000000",
  "confirmation_type": "payment_link",
  "url_reference": "payment_link_ref_masked",
  "status": "active",
  "expires_at": "2026-07-07T10:15:00Z"
}
```

Payment link rules:

- link is a confirmation route for a payment session, not a payment source of truth;
- link must have an explicit expiration timestamp;
- link must not contain raw secrets, card data or provider credentials;
- link may contain opaque token references only when they are signed, scoped and expiring;
- expired link cannot be reused to start preparation;
- regenerating a link creates a new session or replacement operation and preserves the old session history;
- link access may be logged for security and support, but access alone is not payment confirmation.

---

# 10. QR Payment

QR payment is a payment session presented as a QR code.

QR may represent:

- SBP payment handoff;
- provider-hosted payment URL;
- platform-hosted payment URL;
- terminal or vending context that resolves to a payment session.

QR payment rules:

- QR code is a presentation artifact, not a source of financial truth;
- QR payload must point to a limited-lifetime payment session;
- QR payload must not include raw provider secrets, customer personal data, card data or business rules;
- QR scan may create analytics or security telemetry, but it does not confirm payment;
- QR may be refreshed only by creating a new session or renewing through approved provider capability;
- displayed QR must be tied to payment intent, amount, currency, purpose and expiration;
- QR payment completion still requires webhook, polling or internal settlement confirmation.

QR display must make expiration visible to the customer where the UI surface supports it.

---

# 11. QR Lifetime

QR lifetime is the validity window for a QR-backed payment session.

Required fields:

```json
{
  "payment_session_id": "payment_session_01JZ0000000000000000000000",
  "confirmation_type": "qr",
  "issued_at": "2026-07-07T10:00:00Z",
  "expires_at": "2026-07-07T10:15:00Z",
  "lifetime_policy_id": "payment_session_lifetime_default_v1"
}
```

QR lifetime rules:

- every QR payment session must have `issued_at` and `expires_at`;
- lifetime is controlled by versioned platform/provider policy, not hardcoded UI logic;
- QR must be considered invalid after `expires_at`;
- expired QR sessions cannot start product preparation;
- if provider later reports success for an expired session, Payment Domain must reconcile before any order transition;
- refreshing QR creates an operation record;
- replacing QR must not delete the old session record;
- short lifetime reduces stale-payment and machine-context risk;
- customer messaging should make expiration understandable without exposing internal policy names.

Recommended QR expiration behavior:

```text
active QR session
->
expires_at reached
->
PaymentSessionExpired
->
PaymentExpired or replacement allowed by policy
->
Order remains unpaid unless confirmed payment is reconciled
```

---

# 12. Payment Intent

Payment Intent is the platform-owned request to collect a specific amount for a specific approved purpose.

Intent may be created for:

- order payment;
- Club Account top-up;
- one-click top-up;
- auto top-up;
- support payment link;
- future subscription or recurring payment scenario;
- future partner or corporate billing scenario.

Payment intent model:

```json
{
  "payment_intent_id": "payment_intent_01JZ0000000000000000000000",
  "purpose": "order_payment",
  "customer_id": "customer_01JZ0000000000000000000000",
  "order_id": "order_01JZ0000000000000000000000",
  "club_account_id": null,
  "accepted_payable_amount": 130,
  "currency": "RUB",
  "settlement_plan_id": "settlement_plan_01JZ0000000000000000000000",
  "status": "active",
  "allowed_methods": [
    "card",
    "sbp",
    "payment_link",
    "qr"
  ],
  "created_at": "2026-07-07T10:00:00Z",
  "expires_at": "2026-07-07T10:20:00Z"
}
```

Intent lifecycle:

```text
draft
->
active
->
session_created
->
confirmed
```

Failure and closure paths:

```text
draft -> cancelled
active -> expired
session_created -> expired
session_created -> failed
active / session_created -> replaced
confirmed -> closed
```

Intent rules:

- intent amount comes from approved checkout, order, Club Account or finance command;
- intent amount cannot be changed by UI, provider callback or QR scan;
- changing amount requires a new intent or an explicit replacement operation;
- intent must include purpose and stable source references;
- one intent may create multiple sessions only when replacement, retry or method switch policy allows it;
- only one session should be active for the same intent unless a specific multi-method policy allows parallel sessions;
- confirmed intent can close after payment completion, cancellation, refund workflow or reconciliation policy.

---

# 13. Payment Session Lifecycle

Payment Session is a limited-lifetime confirmation context.

Payment session model:

```json
{
  "payment_session_id": "payment_session_01JZ0000000000000000000000",
  "payment_intent_id": "payment_intent_01JZ0000000000000000000000",
  "payment_id": "payment_01JZ0000000000000000000000",
  "confirmation_type": "qr",
  "status": "active",
  "provider": "yookassa",
  "method_type": "sbp",
  "issued_at": "2026-07-07T10:00:00Z",
  "expires_at": "2026-07-07T10:15:00Z",
  "confirmed_at": null,
  "cancelled_at": null
}
```

Session lifecycle:

```text
created
->
active
->
awaiting_customer
->
provider_processing
->
confirmed
```

Failure and closure paths:

```text
created -> failed
active -> expired
awaiting_customer -> expired
awaiting_customer -> cancelled
provider_processing -> confirmed
provider_processing -> failed
provider_processing -> manual_review
active / awaiting_customer -> replaced
```

Session rules:

- session is always linked to one payment intent;
- session has one confirmation type;
- session has an explicit expiration;
- session is not financial truth by itself;
- customer interaction with session does not equal payment confirmation;
- session confirmation may be received from webhook or polling;
- expired session cannot be used to start product preparation;
- replacement preserves original session history.

---

# 14. Payment Method

Payment Method is a provider-neutral method type.

Supported method types:

| Method | Meaning | Owner boundary |
|---|---|---|
| `card` | Bank card payment through provider. | Provider adapter, Payment Domain. |
| `sbp` | Fast Payment System payment. | Provider adapter or future SBP adapter. |
| `payment_link` | Link-based confirmation session. | Payment Domain and provider adapter. |
| `qr` | QR-backed confirmation session. | Payment Domain and provider adapter. |
| `club_account` | Internal Club Account prepaid balance. | Club Account owns balance; Payment coordinates settlement. |
| `wallet` | Internal wallet projection where used. | Wallet/Ledger own balance; Payment coordinates settlement. |
| `saved_payment_method` | Provider-safe reusable reference. | Payment stores reference and consent metadata. |
| `mixed` | Multiple method lines in one payment. | Payment coordinates line completion and compensation. |

Method rules:

- every method line has amount, currency, status and source references;
- method lines must sum to accepted payable amount;
- discounts and bonus redemptions are not method lines;
- provider method availability is policy-driven;
- method-specific provider data must be normalized before it reaches platform contracts;
- method failure must release or compensate related Club Account, Wallet, Bonus or Order reservations through owning domains.

---

# 15. Saved Payment Method

Saved Payment Method is a provider-safe reusable payment reference saved after explicit customer consent.

It must not be called saved card in domain contracts.

Saved payment method model:

```json
{
  "saved_payment_method_id": "saved_pm_01JZ0000000000000000000000",
  "customer_id": "customer_01JZ0000000000000000000000",
  "provider": "yookassa",
  "provider_method_reference": "provider_method_ref_masked",
  "method_type": "card_or_provider_token",
  "status": "active",
  "consent_id": "consent_01JZ0000000000000000000000",
  "consent_version": "2026-07-07.v1",
  "allowed_uses": [
    "one_click_top_up"
  ],
  "created_at": "2026-07-07T10:00:00Z",
  "revoked_at": null
}
```

Saved payment method rules:

- raw card number, CVV, PIN, magnetic stripe data and payment credentials are never stored;
- provider-safe reference must be protected and masked in events and logs;
- consent is mandatory before saving or using the method;
- consent scope must identify allowed uses;
- saved method can be revoked by the customer;
- revoked saved method cannot be used for new charges;
- saved method can become unavailable because provider reference expired, provider revoked it or risk policy blocked it;
- provider-safe reference is not customer identity and must not replace `customer_id`;
- saved method does not imply auto top-up consent.

---

# 16. One-Click Top-Up

One-click top-up is a customer-confirmed Club Account top-up using a saved payment method.

One-click top-up flow:

```text
Customer chooses top-up amount
->
Payment Intent created for Club Account top-up
->
Saved payment method consent and status validated
->
Payment operation created
->
Provider charge started through saved method
->
Webhook or polling confirms result
->
PaymentCompleted
->
Club Account top-up credited through approved contract
```

One-click top-up rules:

- one-click top-up still requires explicit customer action for each top-up;
- saved payment method consent must be active;
- amount must be validated by Club Account and payment policy;
- payment operation must be idempotent;
- provider failure does not change Club Account balance;
- Club Account is credited only after payment completion and approved internal recording policy;
- customer can choose another method when saved method is unavailable;
- one-click top-up is not auto top-up.

---

# 17. Recurring Payments and Auto Top-Up

Recurring payment is a repeated or scheduled payment policy. Auto top-up is the initial recurring-like scenario for Club Account.

Auto top-up is voluntary and requires explicit consent.

Auto top-up model:

```json
{
  "auto_top_up_policy_id": "auto_top_up_01JZ0000000000000000000000",
  "customer_id": "customer_01JZ0000000000000000000000",
  "club_account_id": "club_account_01JZ0000000000000000000000",
  "status": "enabled",
  "saved_payment_method_id": "saved_pm_01JZ0000000000000000000000",
  "trigger": {
    "type": "balance_below_threshold",
    "threshold_amount": 150,
    "currency": "RUB"
  },
  "top_up_amount": 100,
  "daily_limit": 300,
  "monthly_limit": 1000,
  "consent_id": "consent_01JZ0000000000000000000000"
}
```

Recurring and auto top-up rules:

- auto top-up is disabled by default;
- customer must explicitly enable it;
- saved payment method consent and auto top-up consent are separate scopes;
- limits are mandatory before production use;
- customer can disable auto top-up at any time;
- triggers must be idempotent and rate-limited;
- a trigger creates a new payment intent and operation;
- auto top-up failure must not block ordinary customer payment by another method;
- repeated failed auto top-ups must disable or pause the policy by risk rule;
- legal, provider and Product Owner approval are required before production auto debit.

---

# 18. Payment Confirmation

Payment confirmation is accepted evidence that payment state changed.

Confirmation sources:

- verified provider webhook;
- provider status polling;
- internal Club Account or Wallet settlement fact;
- operator-confirmed reconciliation result where policy allows;
- future provider callback or bank adapter event.

Confirmation rules:

- confirmation must be normalized before it changes platform payment state;
- webhook and polling must converge to the same platform state;
- duplicate confirmations must be idempotent;
- provider status cannot change amount, currency, order ID or accepted payable amount;
- ambiguous confirmation enters reconciliation or manual review;
- payment completion should be published only after internal recording policy is satisfied;
- Order must not mark paid from UI state, QR scan, link click or unverified provider payload.

Confirmation result states:

| Result | Meaning |
|---|---|
| `confirmed_success` | Payment succeeded or captured according to provider/internal state. |
| `confirmed_failure` | Payment failed or was declined. |
| `confirmed_cancellation` | Payment was cancelled before capture. |
| `confirmed_expiration` | Payment session or provider payment expired. |
| `confirmed_refund` | Refund operation status changed. |
| `ambiguous` | State requires polling, reconciliation or manual review. |

---

# 19. Webhook Confirmation

Webhook confirmation is provider-initiated input.

Webhook handling flow:

```text
Provider callback received
->
Authenticate provider source and verify signature
->
Deduplicate provider event
->
Parse provider payload inside adapter
->
Map provider status to platform status
->
Append payment operation
->
Apply state transition if valid
->
Publish Payment event when accepted
```

Webhook rules:

- unverified webhook cannot change payment state;
- raw webhook payload must not be exposed to general domain events;
- provider event ID, provider payment reference and platform payment ID are used for deduplication;
- invalid signature is a security event, not a payment fact;
- duplicate webhook returns current known state or is safely ignored;
- webhook after local expiration requires reconciliation before order transitions;
- webhook with amount or currency mismatch enters manual review;
- webhook handler must not start machine preparation directly.

---

# 20. Payment Status Polling

Payment status polling is platform-initiated provider status read.

Polling is used when:

- webhook is delayed;
- webhook is not supported for a method;
- provider callback is ambiguous;
- customer returns from payment page before webhook arrives;
- QR or payment link session is near expiration;
- support or reconciliation requests current provider status;
- refund status is pending.

Polling rules:

- polling is a read operation and must not create duplicate provider payments;
- polling result is normalized through the same mapping as webhook;
- polling must be idempotent and rate-limited;
- polling must stop when terminal state is reached unless reconciliation policy requests review;
- polling must not rewrite accepted operations;
- polling result with mismatch enters reconciliation;
- polling and webhook races are resolved by payment state machine and idempotency keys.

Polling flow:

```text
Payment pending
->
Status polling scheduled
->
Provider status read
->
Provider state mapped
->
Operation appended
->
State transition accepted or rejected
```

---

# 21. Payment Expiration

Payment expiration closes an unconfirmed payment or session after its validity window.

Expiration applies to:

- payment intent;
- payment session;
- QR code;
- payment link;
- provider payment confirmation window;
- authorization window where used;
- refund operation timeout where policy defines expiration.

Expiration rules:

- expired payment sessions cannot start product preparation;
- expiration must be recorded as a payment operation;
- expiration does not delete original payment, session or provider references;
- expiration can release related Club Account, Wallet or Bonus reservations through owning domains;
- if provider later confirms success after expiration, Payment Domain enters reconciliation before changing Order state;
- expiration must be visible to Order so unpaid order can cancel or expire safely;
- customer retry creates a new intent/session or approved replacement operation.

Expiration event examples:

- `Payments.SessionExpired`;
- `Payments.Expired`;
- `Payments.ConfirmationExpired`.

---

# 22. Payment Failure

Payment failure means payment did not complete successfully.

Failure sources:

- provider decline;
- customer failed or abandoned confirmation;
- provider technical failure;
- fraud or risk rejection;
- amount/currency mismatch;
- unavailable method;
- expired confirmation;
- internal settlement failure;
- reconciliation failure.

Failure rules:

- failure must preserve the original intent and operation history;
- provider decline is a business result and should not be retried automatically unless provider contract says it is transient;
- technical failures may be retried only with idempotency;
- failure must release related reservations through owning domains when safe;
- failed payment does not make an order paid;
- failed top-up does not credit Club Account;
- failed payment may allow retry with a new session or method depending on order state and policy;
- repeated failures may trigger fraud review or method suppression.

---

# 23. Payment Cancellation

Payment cancellation stops an unfinished payment before completed settlement.

Cancellation is not a refund.

Cancellation applies when:

- customer cancels payment before confirmation;
- payment session expires;
- order is cancelled before payment completes;
- provider cancels unfinished payment;
- risk review blocks payment before capture;
- support cancels an unfinished payment with reason.

Cancellation rules:

- captured or completed payment cannot be cancelled and must use refund;
- cancellation must be idempotent;
- cancellation reason must be recorded;
- provider cancellation is requested only when provider state allows it;
- related Club Account, Wallet or Bonus reservations are released through owning domains;
- cancellation does not delete the original payment operation history;
- if provider reports success during cancellation race, state enters reconciliation.

Cancellation state:

```text
pending_confirmation / authorized
->
cancellation_requested
->
cancelled
```

Ambiguous cancellation:

```text
cancellation_requested
->
provider_status_unknown
->
manual_review or reconciled state
```

---

# 24. Refunds

Refund is a new compensating financial operation.

Refund rules:

- refund never edits or deletes historical payment records;
- refund is represented as a new financial operation;
- refund references original payment, method line, order, customer and Ledger entries where available;
- refund to original payment method is preferred when provider and policy allow it;
- refund to Club Account or Wallet requires approved business policy and owning domain contracts;
- refund amount cannot exceed captured amount minus previous refunds;
- refund must preserve method-line attribution for card, SBP, Club Account, Wallet and future methods;
- provider refund must be idempotent;
- refund must be recorded internally before and after provider interaction;
- refund completion requires internal recording policy and reconciliation with Ledger;
- refund failure does not silently make the original payment unpaid.

Refund model:

```json
{
  "refund_id": "refund_01JZ0000000000000000000000",
  "payment_id": "payment_01JZ0000000000000000000000",
  "order_id": "order_01JZ0000000000000000000000",
  "customer_id": "customer_01JZ0000000000000000000000",
  "status": "pending",
  "amount": 130,
  "currency": "RUB",
  "reason": "order_cancelled_after_payment",
  "method_lines": [
    {
      "payment_method_line_id": "payment_line_01JZ0000000000000000000000",
      "refund_amount": 130,
      "provider": "yookassa"
    }
  ],
  "created_at": "2026-07-07T10:30:00Z"
}
```

Refund flow:

```text
RefundRequested
->
RefundOperationRecorded
->
Provider refund or internal refund requested
->
Refund status confirmed by webhook or polling
->
Ledger records refund fact
->
RefundCompleted
```

---

# 25. Partial Refunds

Partial refund is a refund for less than the remaining refundable amount.

Partial refund scenarios:

- product was partially fulfilled or partially unavailable;
- support approved service recovery;
- machine incident requires partial compensation;
- order had multiple items in future flows;
- mixed payment requires partial method-line compensation;
- Product Owner-approved policy allows partial refund for a specific case.

Partial refund rules:

- partial refund requires explicit reason and policy;
- amount must be greater than zero;
- amount cannot exceed refundable remaining amount;
- multiple partial refunds are allowed only until total refunded amount reaches captured amount;
- each partial refund is a separate operation;
- partial refund must preserve method-line attribution;
- partial refund may trigger Bonus cancellation or reversal through Bonus rules;
- partial refund may trigger Club Account correction through Club Account rules;
- customer-facing history must show refund as separate event, not as edited original payment.

Refund state after partial refund:

```text
completed
->
refund_pending
->
partially_refunded
->
refund_pending
->
refunded
```

---

# 26. Payment Operations Registry

Payment Operations Registry is the internal append-only record of payment actions and accepted facts.

Decision reference: `DECISION-034`.

Operation registry model:

```json
{
  "payment_operation_id": "payment_op_01JZ0000000000000000000000",
  "operation_type": "payment_session_created",
  "payment_id": "payment_01JZ0000000000000000000000",
  "payment_intent_id": "payment_intent_01JZ0000000000000000000000",
  "refund_id": null,
  "customer_id": "customer_01JZ0000000000000000000000",
  "order_id": "order_01JZ0000000000000000000000",
  "provider": "yookassa",
  "provider_operation_reference": "provider_ref_masked",
  "amount": 130,
  "currency": "RUB",
  "from_status": "created",
  "to_status": "pending_confirmation",
  "source": "payment_runtime",
  "idempotency_key": "payment_01JZ_create_session_v1",
  "correlation_id": "corr_01JZ0000000000000000000000",
  "created_at": "2026-07-07T10:00:00Z"
}
```

Required operation types:

| Operation | Meaning |
|---|---|
| `payment_intent_created` | Intent was created from approved source. |
| `payment_created` | Payment aggregate was created. |
| `payment_session_created` | Confirmable session was created. |
| `confirmation_required` | Customer/provider confirmation is required. |
| `payment_link_created` | Limited-lifetime link was created. |
| `qr_created` | QR presentation was created. |
| `qr_refreshed` | QR session was replaced or refreshed. |
| `webhook_received` | Verified provider webhook was accepted for processing. |
| `status_polled` | Provider status was read. |
| `provider_status_mapped` | Provider status was normalized. |
| `payment_authorized` | Funds were authorized where applicable. |
| `payment_captured` | Funds were captured or provider success was accepted. |
| `payment_completed` | Payment completion was accepted internally. |
| `payment_failed` | Payment failed. |
| `payment_expired` | Payment or session expired. |
| `payment_cancel_requested` | Cancellation was requested. |
| `payment_cancelled` | Payment was cancelled. |
| `refund_requested` | Refund command was accepted. |
| `refund_provider_requested` | Provider refund was requested. |
| `refund_completed` | Refund completed. |
| `refund_failed` | Refund failed. |
| `reconciliation_started` | Reconciliation workflow started. |
| `reconciliation_matched` | Reconciliation confirmed consistency. |
| `manual_review_requested` | Payment state requires support or finance review. |

Registry rules:

- operation records are append-only;
- operation records are never edited to change history;
- corrections are new operation records;
- every side-effect operation requires idempotency;
- provider events must be deduplicated before operation effects are accepted;
- operation registry must not store raw card data, CVV, provider secrets or raw personal data;
- operation registry is internal financial history support, not provider report copy;
- operation registry must support audit, reconciliation, support and reporting.

---

# 27. Payment Reports and Registries

Payment Domain maintains internal reports and registries for operations, settlement, refunds and reconciliation.

Internal registries:

| Registry | Purpose |
|---|---|
| Payment Operations Registry | Append-only payment operation history. |
| Payment Session Registry | Active, expired, cancelled and replaced sessions. |
| Payment Intent Registry | Payment purpose, source and accepted amount records. |
| Refund Registry | Full and partial refund operations. |
| Provider Reference Registry | Mapping between platform IDs and provider references. |
| Provider Report Import Registry | Imported provider reports and processing status. |
| Reconciliation Registry | Match, mismatch and manual review records. |
| Settlement Report | Daily or period settlement summaries by method/provider. |
| Accounting Handoff Registry | Ledger-backed export references for Accounting Adapter. |

Report rules:

- reports are generated from internal operations, Ledger and approved provider imports;
- provider reports are evidence, not the only source of financial history;
- reports must preserve payment ID, order ID, customer ID, method line, amount, currency, operation type and timestamps;
- sensitive reports require authorization and audit;
- reports must identify unresolved mismatches;
- provider-specific columns remain in provider import or adapter views, not in the core payment model.

---

# 28. Reconciliation

Reconciliation compares internal payment history with external and downstream facts.

Decision reference: `DECISION-035`.

Reconciliation inputs:

- Payment aggregate state;
- Payment Operations Registry;
- Payment Session Registry;
- Refund Registry;
- Ledger entries;
- provider reports and webhook history;
- provider status polling results;
- Accounting Adapter export/import state;
- Order state;
- Club Account transaction history;
- Wallet projection where used;
- Bonus reservation/redemption/reversal state where relevant;
- Machine dispatch state when payment/order/machine consistency matters.

Reconciliation checks:

- provider payment reference maps to exactly one platform payment unless explicitly linked by replacement policy;
- amount and currency match accepted payment method line;
- payment completed state has Ledger-backed financial facts or approved recording references;
- refund totals do not exceed captured amount;
- partial refunds preserve method-line attribution;
- expired sessions did not start machine preparation;
- paid orders have full confirmed payment;
- provider report item has matching internal operation;
- internal completed payment appears in provider report or is marked as expected exception;
- accounting export references Ledger-backed facts.

Reconciliation outcomes:

| Outcome | Meaning |
|---|---|
| `matched` | Internal, provider, Ledger and order facts agree. |
| `provider_missing` | Internal payment exists but provider report lacks expected item. |
| `internal_missing` | Provider report has item without matching internal payment operation. |
| `amount_mismatch` | Amount differs between sources. |
| `currency_mismatch` | Currency differs between sources. |
| `status_mismatch` | Provider, Payment, Ledger or Order states conflict. |
| `duplicate_provider_reference` | Same provider reference appears more than once unexpectedly. |
| `late_success_after_expiry` | Provider success arrived after session expired. |
| `manual_review` | Human or finance review is required. |

Reconciliation rules:

- reconciliation never edits historical payment records;
- reconciliation creates new reconciliation and correction operations;
- Ledger wins for financial statements until a new approved correction is recorded;
- provider reports can trigger investigation but cannot directly rewrite Order, Club Account or Ledger state;
- unresolved mismatch blocks machine dispatch if order is not already safely paid;
- repeated reconciliation failures must be visible to finance/support.

---

# 29. Accounting Interaction

Accounting Adapter translates Ledger-backed financial facts to external accounting systems.

Payment Domain interaction with accounting:

```text
PaymentCompleted / RefundCompleted
->
Ledger records financial fact
->
Accounting Adapter prepares export
->
External accounting acknowledgement imported
->
Reconciliation compares Ledger, Payment and accounting state
```

Accounting rules:

- Payment Domain does not call external accounting systems directly;
- Accounting Adapter reads Ledger-backed facts and safe Payment references;
- external accounting system is not platform source of financial truth;
- provider reports and accounting acknowledgements are reconciliation inputs;
- accounting rejection does not rewrite original payment or Ledger entries;
- refunds and corrections are exported as separate compensating facts;
- tax, fiscal receipt and OFD integration require separate approved decisions before production use.

Payment references useful for accounting:

- `payment_id`;
- `refund_id`;
- `order_id`;
- `customer_id` or minimized customer reference;
- method line ID;
- provider reference;
- amount and currency;
- operation type;
- Ledger entry IDs;
- occurred timestamp.

---

# 30. Club Account Interaction

Club Account is separate from Payment Domain.

Interaction scenarios:

- customer tops up Club Account through Payment Domain;
- customer uses Club Account balance to pay for an order;
- customer uses saved payment method for one-click top-up;
- customer enables voluntary auto top-up after explicit consent;
- refund returns value to Club Account only by approved policy.

Rules:

- Club Account balance is not Payment state;
- Payment Domain never mutates Club Account projection directly;
- Club Account owns available, reserved and total balance;
- Payment Domain confirms provider or internal payment facts;
- top-up credits Club Account only after payment completion and approved internal recording policy;
- one-click top-up uses saved payment method only after consent validation;
- auto top-up is disabled unless customer explicitly enabled it;
- failed top-up does not change Club Account balance;
- refund to Club Account is a new Club Account transaction and Payment refund operation.

Club Account top-up flow:

```text
Customer requests top-up
->
Club Account validates amount and account state
->
Payment Intent created
->
Payment Session or saved method charge created
->
Payment confirmed
->
Ledger/payment operation recorded
->
Club Account top-up credited
```

---

# 31. Bonus Interaction

Bonus Account remains separate from Payment Domain and Club Account.

Rules:

- bonus is not money;
- bonus is not a payment method;
- bonus is not Club Account balance;
- bonus redemption creates a discount effect before payment;
- Payment collects only the accepted payable amount after bonus and discount effects;
- Payment never accrues, reserves, redeems, expires or reverses bonuses directly;
- payment success may trigger Bonus Domain to capture a reserved redemption through approved checkout flow;
- payment failure, cancellation or expiration may trigger Bonus Domain to release reserved bonus rights;
- refund may trigger bonus reversal or cancellation through Bonus Domain rules.

Example:

```text
Gross product price: 130 RUB
Bonus discount: 20 RUB
Payable amount: 110 RUB
Payment amount: 110 RUB
```

Payment collects 110 RUB. It does not collect the discounted 20 RUB and does not treat bonus as money.

---

# 32. Order Interaction

Order owns purchase lifecycle and immutable order snapshots.

Payment interaction with Order:

- Order or Checkout provides accepted payable amount and settlement plan;
- Payment creates intent, session and provider/internal settlement operations;
- Payment publishes payment facts;
- Order becomes paid only after full confirmed payment;
- Order cancellation before payment can cancel or expire payment;
- Order cancellation after payment requires refund workflow;
- Order cannot start machine preparation from pending payment state.

Order rules:

- Payment does not modify product configuration or price snapshot;
- Order does not call provider APIs directly;
- Order state must be based on platform payment state, not provider raw status;
- failed or expired payment keeps order unpaid and may cancel/expire order by policy;
- paid order snapshot must include payment references needed for support and reconciliation;
- refunds are coordinated between Order and Payment but recorded as compensating operations.

Paid-order rule:

```text
Order may transition to paid only when Payment Domain confirms the full accepted payable amount.
```

---

# 33. Machine Dispatch Rule

Machine receives only paid orders.

Mandatory rule:

```text
Product preparation starts only after full confirmed payment.
```

Machine dispatch is forbidden when payment is:

- `created`;
- `pending_confirmation`;
- `awaiting_customer`;
- `authorized` without full capture/completion;
- `capture_pending`;
- `failed`;
- `expired`;
- `cancelled`;
- `manual_review`;
- only partially paid;
- mismatched in reconciliation.

Machine dispatch allowed:

```text
PaymentCompleted
->
Order marked paid
->
Order queued for fulfillment
->
Machine dispatch command created
```

Machine dispatch rules:

- authorization alone does not start product preparation;
- QR scan does not start product preparation;
- payment link click does not start product preparation;
- webhook receipt does not start preparation until verified and normalized;
- provider success must pass platform recording and order transition policy;
- expired payment session cannot start preparation;
- payment ambiguity blocks dispatch and enters reconciliation/manual review;
- machine must receive only paid order references, not payment provider credentials.

---

# 34. Security and Audit

Payment Domain is security-sensitive.

Security rules:

- raw card data, CVV, PIN, magnetic stripe data and payment credentials are forbidden;
- provider secrets, webhook secrets, API keys and signatures are forbidden in frontend code, events and general logs;
- provider callbacks require authentication and signature verification where supported;
- payment links and QR payloads must not contain raw secrets or personal data;
- saved payment method references must be protected and masked;
- customer can access only their own payment views;
- CRM/support payment access requires authorization, audit and least privilege;
- refunds, cancellations, manual reconciliation and saved method changes require actor, reason and correlation ID;
- idempotency keys must not contain secrets;
- payment events must minimize personal data;
- provider raw payload retention must follow security and privacy policy.

Audit records should capture:

- actor type and actor ID;
- operation type;
- payment ID, intent ID, session ID and refund ID;
- order ID and customer ID;
- provider and masked provider reference;
- amount and currency;
- from/to state;
- idempotency key reference;
- reason code;
- source channel;
- correlation ID and causation ID;
- timestamp;
- manual review outcome when applicable.

Fraud and risk controls:

- duplicate provider reference detection;
- duplicate webhook detection;
- amount and currency mismatch detection;
- payment velocity checks where legally allowed;
- saved payment method abuse detection;
- refund velocity checks;
- one-click and auto top-up limits;
- suspicious QR/link reuse detection;
- manual review for ambiguous provider outcomes;
- operator refund/cancellation audit.

---

# 35. Domain Events

Payment events follow Event API `<Domain>.<Fact>` naming.

Recommended events:

| Event | Produced after | Meaning |
|---|---|---|
| `Payments.IntentCreated` | Payment intent created. | Platform intends to collect an accepted amount. |
| `Payments.Created` | Payment aggregate created. | Payment exists. |
| `Payments.SessionCreated` | Confirmation session created. | Customer can be asked to confirm payment. |
| `Payments.ConfirmationRequired` | Confirmation details are available. | UI or channel may present link, QR or redirect. |
| `Payments.PaymentLinkCreated` | Payment link created. | Limited-lifetime link exists. |
| `Payments.QrCreated` | QR presentation created. | Limited-lifetime QR exists. |
| `Payments.QrExpired` | QR session expired. | QR can no longer confirm normally. |
| `Payments.WebhookReceived` | Verified webhook accepted. | Provider fact entered adapter boundary. |
| `Payments.StatusPolled` | Provider status read. | Polling fact recorded. |
| `Payments.Authorized` | Funds authorized where supported. | Authorization exists, not yet full payment. |
| `Payments.Captured` | Funds captured or provider success accepted. | Capture fact exists. |
| `Payments.Completed` | Payment fully confirmed internally. | Order may become paid by policy. |
| `Payments.Failed` | Payment failed. | Payment cannot complete without retry/replacement. |
| `Payments.Expired` | Payment expired. | Session or intent expired unpaid. |
| `Payments.CancelRequested` | Cancellation requested. | Cancellation workflow started. |
| `Payments.Cancelled` | Payment cancelled before completion. | No captured funds in this flow. |
| `Payments.RefundRequested` | Refund accepted. | Refund workflow started. |
| `Payments.RefundCompleted` | Refund completed. | Compensating operation accepted. |
| `Payments.RefundFailed` | Refund failed. | Refund requires retry or review. |
| `Payments.PartiallyRefunded` | Partial refund completed. | Some captured amount has been refunded. |
| `Payments.Reconciled` | Reconciliation matched. | Payment facts agree for scope. |
| `Payments.ReconciliationFailed` | Reconciliation mismatch found. | Review or correction needed. |
| `Payments.ManualReviewRequested` | Ambiguous/risky state found. | Support or finance review required. |
| `Payments.SavedPaymentMethodCreated` | Saved method reference stored. | Consent-backed provider reference exists. |
| `Payments.SavedPaymentMethodRevoked` | Saved method revoked. | Reference cannot be used for new charges. |
| `Payments.AutoTopUpTriggered` | Auto top-up trigger accepted. | A consented top-up attempt may start. |

Minimal event payload:

```json
{
  "payment_id": "payment_01JZ0000000000000000000000",
  "payment_intent_id": "payment_intent_01JZ0000000000000000000000",
  "payment_session_id": "payment_session_01JZ0000000000000000000000",
  "customer_id": "customer_01JZ0000000000000000000000",
  "order_id": "order_01JZ0000000000000000000000",
  "amount": 130,
  "currency": "RUB",
  "method_type": "sbp",
  "provider": "yookassa",
  "operation_id": "payment_op_01JZ0000000000000000000000",
  "correlation_id": "corr_01JZ0000000000000000000000"
}
```

Event rules:

- events are facts, not commands;
- payloads use platform states and IDs;
- provider secrets and raw payment credentials are forbidden;
- provider raw payloads are not event payloads;
- consumers must be idempotent;
- event replay must not repeat payments, refunds, top-ups, notifications or machine commands;
- `Payments.Completed` is the event used by Order to evaluate paid transition.

---

# 36. State Machine

Payment aggregate state machine:

```text
created
->
pending_confirmation
->
authorized
->
capture_pending
->
captured
->
completed
```

Common one-stage provider flow:

```text
created
->
pending_confirmation
->
captured
->
completed
```

Failure and timeout paths:

```text
created -> failed
pending_confirmation -> failed
pending_confirmation -> expired
pending_confirmation -> cancelled
authorized -> cancelled
capture_pending -> failed
any uncertain state -> manual_review
```

Refund paths:

```text
completed
->
refund_pending
->
partially_refunded

completed / partially_refunded
->
refund_pending
->
refunded
```

Payment session state machine:

```text
created
->
active
->
awaiting_customer
->
provider_processing
->
confirmed
```

Session closure paths:

```text
active -> expired
awaiting_customer -> expired
awaiting_customer -> cancelled
provider_processing -> failed
provider_processing -> manual_review
active / awaiting_customer -> replaced
```

State rules:

- terminal payment states are immutable except through new refund or correction operations;
- `completed` means full accepted payable amount is confirmed by platform policy;
- `authorized` is not enough for machine dispatch;
- `captured` may still wait for internal recording before `completed`;
- `partially_refunded` does not delete original completed payment;
- `refunded` means full captured amount has been compensated;
- `manual_review` blocks automatic order paid transition unless an approved reconciliation operation resolves it.

---

# 37. Edge Cases

| Edge case | Required behavior |
|---|---|
| Webhook arrives twice | Deduplicate and return current known state. |
| Webhook arrives after polling already completed payment | Deduplicate by provider reference and operation scope. |
| Polling says success while webhook says pending | Re-read provider state or enter reconciliation by policy. |
| Provider success arrives after session expiration | Enter reconciliation; do not start preparation automatically. |
| QR expired while customer is in bank app | Wait for provider outcome, then reconcile before order transition. |
| Customer scans old QR after replacement | Old session remains expired/replaced; no preparation starts from old QR. |
| Payment link opened many times | Link access is not payment confirmation; rate-limit if needed. |
| Payment amount from provider differs from intent | Block completion and request manual review. |
| Currency differs from accepted plan | Block completion and request manual review. |
| Saved payment method revoked during top-up | Do not start new charge; current in-flight operation follows Payment policy. |
| Auto top-up trigger fires twice | Use idempotency, cooldown and limits. |
| One-click top-up provider decline | Do not credit Club Account; show retry/alternate method. |
| Payment succeeds but Ledger recording is delayed | Do not dispatch until completion policy is satisfied; reconcile. |
| Ledger says payment recorded but provider report missing | Mark provider_missing and reconcile with provider report/status. |
| Provider report has unknown payment | Mark internal_missing and investigate before importing as platform payment. |
| Mixed payment external part succeeds and Club Account capture fails | Enter manual review and compensate by policy. |
| Refund webhook arrives before refund request response | Correlate by provider/idempotency reference and process once. |
| Partial refund requested after full refund | Reject as already fully refunded. |
| Order cancelled while payment pending | Cancel payment/session where possible and expire order after reconciliation. |
| Machine dispatch exists for unpaid order | Serious reconciliation incident; stop or review machine operation. |

---

# 38. Error Scenarios

Recommended error codes:

| Code | Meaning | Recovery |
|---|---|---|
| `PAYMENT_INTENT_NOT_FOUND` | Intent is unknown. | Recreate from approved source or support review. |
| `PAYMENT_INTENT_EXPIRED` | Intent expired. | Create a new intent if order/top-up policy allows. |
| `PAYMENT_SESSION_EXPIRED` | Link or QR session expired. | Create replacement session if allowed. |
| `PAYMENT_AMOUNT_MISMATCH` | Amount differs from accepted plan. | Manual review. |
| `PAYMENT_CURRENCY_MISMATCH` | Currency differs from accepted plan. | Manual review. |
| `PAYMENT_METHOD_UNAVAILABLE` | Selected method cannot be used. | Choose another method. |
| `PAYMENT_CONFIRMATION_REQUIRED` | Customer/provider confirmation is still needed. | Continue confirmation. |
| `PAYMENT_CONFIRMATION_FAILED` | Confirmation failed. | Retry or choose another method. |
| `PAYMENT_PROVIDER_UNAVAILABLE` | Provider is unavailable. | Retry later or use another method. |
| `PAYMENT_PROVIDER_DECLINED` | Provider declined payment. | Use another method. |
| `PAYMENT_WEBHOOK_INVALID_SIGNATURE` | Webhook verification failed. | Security review; no state change. |
| `PAYMENT_WEBHOOK_DUPLICATE` | Webhook already processed. | Return existing state. |
| `PAYMENT_STATUS_AMBIGUOUS` | Provider outcome is unclear. | Poll, reconcile or manual review. |
| `PAYMENT_ALREADY_COMPLETED` | Duplicate completion attempted. | Return existing completed state. |
| `PAYMENT_ALREADY_CANCELLED` | Duplicate cancellation attempted. | Return existing cancelled state. |
| `PAYMENT_CANNOT_CANCEL_CAPTURED` | Captured payment cannot be cancelled. | Use refund workflow. |
| `PAYMENT_REFUND_AMOUNT_INVALID` | Refund amount exceeds refundable amount or is zero. | Correct amount or support review. |
| `PAYMENT_REFUND_PROVIDER_FAILED` | Provider refund failed. | Retry or manual review. |
| `PAYMENT_PARTIAL_REFUND_NOT_ALLOWED` | Policy does not allow partial refund. | Request full refund or support policy. |
| `SAVED_PAYMENT_METHOD_CONSENT_REQUIRED` | Saved method use lacks consent. | Ask customer to consent or choose another method. |
| `SAVED_PAYMENT_METHOD_UNAVAILABLE` | Saved reference cannot be used. | Choose another method. |
| `AUTO_TOP_UP_CONSENT_REQUIRED` | Auto top-up is not enabled. | Enable with explicit consent. |
| `AUTO_TOP_UP_LIMIT_EXCEEDED` | Configured top-up limit blocks charge. | Manual top-up. |
| `PAYMENT_RECONCILIATION_REQUIRED` | Facts disagree or are incomplete. | Reconciliation/manual review. |
| `PAYMENT_OPERATION_IDEMPOTENCY_CONFLICT` | Same key used with different payload. | Reject and investigate. |

Error rules:

- customer-facing messages must be simple and safe;
- internal errors include correlation IDs;
- provider raw error payloads are normalized before exposure;
- errors must not expose secrets, card data, provider signatures or raw personal data;
- rejected sensitive operations should be auditable.

---

# 39. Commands and Queries

Future Payment Runtime commands:

| Command | Purpose |
|---|---|
| `CreatePaymentIntent` | Create intent from approved order/top-up/support source. |
| `CreatePaymentSession` | Create link, QR, redirect or provider confirmation session. |
| `ReplacePaymentSession` | Replace expired or unusable session. |
| `ConfirmPaymentFromWebhook` | Process verified provider callback. |
| `PollPaymentStatus` | Read provider status and normalize result. |
| `CancelPayment` | Cancel unfinished payment. |
| `RequestRefund` | Start full or partial refund. |
| `ConfirmRefundStatus` | Process provider or internal refund result. |
| `SavePaymentMethodReference` | Store provider-safe reference after consent. |
| `RevokeSavedPaymentMethod` | Disable future use of saved method. |
| `StartOneClickTopUp` | Start top-up using saved payment method after customer action. |
| `TriggerAutoTopUp` | Start top-up from consented policy trigger. |
| `RecordPaymentOperation` | Append accepted internal operation. |
| `StartPaymentReconciliation` | Compare internal and external facts. |
| `ResolvePaymentManualReview` | Apply approved review outcome as new operation. |

Future queries:

| Query | Purpose |
|---|---|
| `GetPayment` | Read payment state. |
| `GetPaymentIntent` | Read intent state and source references. |
| `GetPaymentSession` | Read safe session state. |
| `GetPaymentStatus` | Read customer-safe status. |
| `GetPaymentOperations` | Read authorized operation history. |
| `GetRefund` | Read refund state. |
| `GetRefundableAmount` | Read remaining refundable amount. |
| `GetSavedPaymentMethods` | Read safe saved payment method list. |
| `GetPaymentReport` | Read authorized internal payment report. |
| `GetReconciliationStatus` | Read reconciliation result. |

Command/query rules:

- commands require actor, source, reason where needed and correlation metadata;
- side-effect commands require idempotency;
- customer queries can read only customer's own payment data;
- CRM/support queries require authorization and audit;
- queries must not expose provider secrets, raw card data or raw webhook payloads.

---

# 40. Business Rules

1. Payment Domain is provider agnostic.
2. YooKassa is the primary payment provider.
3. YooKassa-specific fields stay inside the YooKassa provider adapter and protected integration records.
4. YooKassa API settings use `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` and `YOOKASSA_API_URL`.
5. `YOOKASSA_SECRET_KEY` must come from secure environment configuration only.
6. `YOOKASSA_SECRET_KEY` must not be stored in code, Markdown, committed `.env` files, frontend bundles, events or logs.
7. SBP, QR, payment links, cards, saved payment methods and future providers use the same payment model.
8. Payment consumes accepted payable amount and does not calculate price.
9. Payment does not calculate discounts.
10. Bonus is not money and is not a payment method.
11. Club Account and Bonus Account remain separate.
12. Saved payment method is not called saved card.
13. Saved payment method requires explicit consent.
14. Auto top-up is voluntary and requires explicit consent.
15. QR and payment links have limited lifetime.
16. Expired payment sessions cannot start product preparation.
17. Product preparation starts only after full confirmed payment.
18. Machine receives only paid orders.
19. Payment confirmation may come from webhook or status polling.
20. Webhooks must be verified and deduplicated.
21. Polling must not create duplicate provider side effects.
22. Payment operations must be stored internally.
23. External provider reports are not the only source of financial history.
24. Financial registry is internal and reconciled with provider reports.
25. Refunds never edit historical payment records.
26. Refunds are represented as new financial operations.
27. Partial refunds preserve method-line attribution.
28. Provider raw data and secrets are forbidden in domain events.
29. Payment events are facts and consumers must be idempotent.
30. Reconciliation creates new records; it does not rewrite history.
31. Ledger remains the source of truth for financial facts.
32. Accounting Adapter translates Ledger-backed facts; Payment does not call accounting systems directly.
33. Ambiguous payment outcome blocks automatic machine dispatch.

---

# 41. Readiness Criteria

Payment Domain is architecture-ready when:

- Payment purpose is documented;
- provider agnostic model is documented;
- YooKassa primary provider role is documented;
- YooKassa API environment configuration and secret handling are documented;
- SBP, payment link and QR payment handling are documented;
- QR lifetime and session expiration are documented;
- payment intent and payment session lifecycle are documented;
- payment method and saved payment method boundaries are documented;
- one-click top-up and auto top-up rules are documented;
- webhook and polling confirmation rules are documented;
- expiration, failure and cancellation are documented;
- full and partial refunds are documented as new operations;
- Payment Operations Registry is documented;
- reports, registries and reconciliation are documented;
- Accounting, Club Account, Bonus, Order and Machine interactions are documented;
- security, audit, domain events, state machine, edge cases and error scenarios are documented;
- required decisions `DECISION-033` through `DECISION-037` are included or referenced;
- no application source code is modified.

Implementation-ready criteria for future tasks:

- Payment command, query and event schemas are approved;
- money representation is standardized for API and storage;
- YooKassa provider adapter contract is approved;
- webhook signature verification rules are approved;
- QR/link lifetime policies are approved;
- saved payment method consent texts are approved;
- auto top-up legal/provider policy and limits are approved;
- payment operation storage schema is approved;
- provider report import format is approved;
- reconciliation workflow and support screens are approved;
- Ledger and Accounting mapping is approved;
- test scenarios cover card, SBP, QR, link, saved method, one-click top-up, auto top-up, expiration, webhook, polling, cancellation, refunds and reconciliation.

---

# 42. Future Roadmap

Recommended future tasks:

1. Define Payment command contracts.
2. Define Payment query contracts.
3. Define Payment event payload schemas and Event Registry entries.
4. Define provider-agnostic payment DTOs and money representation.
5. Define YooKassa Provider Adapter contract.
6. Define YooKassa webhook verifier and status mapper.
7. Define SBP confirmation, QR and deep-link policies.
8. Define payment link creation and expiration policy.
9. Define QR lifetime configuration and refresh/replacement policy.
10. Define Payment Operations Registry storage schema.
11. Define Payment Session Registry and active-session replacement rules.
12. Define saved payment method consent, storage and revocation flow.
13. Define one-click top-up implementation with Club Account.
14. Define auto top-up legal/provider approval, limits and disable rules.
15. Define refund and partial refund command contracts.
16. Define provider report import model.
17. Define payment reconciliation workflow and reports.
18. Define Accounting Adapter mapping for payment and refund operations.
19. Define CRM/support payment audit views.
20. Define fraud review queue for ambiguous provider outcomes.
21. Add test scenarios for payment confirmation, expiration, cancellation, refund and machine dispatch blocking.
22. Implement Payment Runtime only after contracts and Product Owner-approved payment policies are ready.

---

# Documentation Scope

This document is documentation-only.

It does not introduce application code, frontend code, backend code, Telegram bot code, active deployment configuration, database migrations, payment provider integration, real YooKassa credentials, saved payment method storage, generated build output, fiscalization implementation, accounting integration, CRM screens or notification templates.
