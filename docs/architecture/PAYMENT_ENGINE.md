# Payment Engine

Document code: ARCH-FIN-PAYMENT-001
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
- `docs/tasks/FINANCE-007_PAYMENT_ENGINE.md`
- `docs/governance/ENGINEERING_PROCESS.md`
- `docs/governance/QUALITY_GATES.md`

Provider references checked for architecture context on 2026-07-02:

- YooKassa API: `https://yookassa.ru/developers/api`
- YooKassa payment process: `https://yookassa.ru/developers/payment-acceptance/getting-started/payment-process`

---

# 1. Purpose

Payment Engine executes financial settlement for already accepted checkout flows.

Payment Engine exists so Soft ICE Platform can:

- create payment attempts for an order or checkout;
- route payments to a selected payment method;
- interact with external payment providers through adapters;
- coordinate internal wallet payment settlement without owning Wallet balance;
- authorize, capture, cancel and refund payments;
- translate provider callbacks into platform payment facts;
- publish formal payment events for Order, Ledger, Wallet, CRM, Notification, Machine and Reporting consumers;
- preserve idempotency and auditability for payment operations.

Core boundary:

```text
Payment never changes business logic.
Payment only executes financial settlement.
Ledger remains the source of truth for financial history.
Payment publishes events after accepted payment state changes.
```

Payment Engine does not calculate product price, discounts, bonus eligibility, wallet balance, order availability, machine readiness or customer loyalty rules.

---

# 2. Architecture Role

Payment Engine is the Finance Platform domain responsible for payment attempts and provider settlement.

Architecture position:

```text
Product Configuration
->
Pricing Result
->
Discount Result
->
Checkout Settlement Plan
->
Wallet reservation, when internal balance is used
->
Payment Engine
->
Provider / Wallet settlement
->
Transaction and Ledger
->
Payment events
->
Order / Machine / Notification / CRM / Reporting
```

Payment Engine owns:

- Payment aggregate lifecycle;
- payment method selection state;
- payment attempt records;
- provider adapter contracts;
- provider request and response correlation;
- webhook verification and translation;
- authorization, capture, cancellation and refund commands;
- payment idempotency;
- payment events.

Payment Engine does not own:

- Product Catalog;
- Configuration;
- Recipe;
- Pricing;
- Discount rules;
- Bonus rules;
- Wallet projection;
- Ledger entries as the financial source of truth;
- Order business lifecycle;
- Machine commands;
- CRM screens;
- notification templates;
- fiscalization or accounting adapters.

Payment Engine may validate that a requested settlement amount matches the approved settlement plan. It must not recalculate the plan or invent a new payable amount.

---

# 3. Payment Lifecycle

Payment lifecycle is method-independent. Provider-specific states are mapped into the platform lifecycle.

Common lifecycle:

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

Failure and compensation paths:

```text
created -> failed
pending_confirmation -> failed
pending_confirmation -> expired
authorized -> cancelled
capture_pending -> failed
captured -> refund_pending -> partially_refunded
captured -> refund_pending -> refunded
completed -> refund_pending -> partially_refunded
completed -> refund_pending -> refunded
any uncertain state -> manual_review
```

Lifecycle rules:

- payment is created only from an approved checkout, order or finance command;
- payment amount must come from the accepted Discount Result or settlement plan;
- payment amount cannot be changed by provider callback or UI state;
- a payment can have one or more payment method lines;
- every payment method line has its own status and correlation references;
- external provider settlement must be represented in Ledger before it becomes authoritative financial history;
- failed payment does not change product, discount or bonus rules;
- cancelled authorization is not a refund;
- refund is always a new compensating operation;
- manual review does not mutate the original payment facts.

---

# 4. Payment States

Internal payment states are platform states, not direct provider statuses.

| State | Meaning | Terminal |
|---|---|---|
| `created` | Payment aggregate was created from approved settlement intent. | No |
| `pending_confirmation` | Customer, provider or external app must complete confirmation. | No |
| `authorized` | Funds are authorized or reserved by a provider or Wallet, but not captured. | No |
| `capture_pending` | Capture was requested or is waiting for final provider confirmation. | No |
| `captured` | Funds were captured by the payment method. Ledger recording may still be completing. | No |
| `completed` | Payment settlement is complete and financial facts are recorded. | Yes |
| `failed` | Payment attempt failed before settlement completion. | Yes |
| `cancelled` | Payment authorization or unfinished attempt was cancelled before capture. | Yes |
| `expired` | Payment confirmation window or authorization window expired. | Yes |
| `refund_pending` | Refund command was accepted and is being processed. | No |
| `partially_refunded` | Part of the captured amount was refunded. | No |
| `refunded` | Captured amount was fully refunded. | Yes for the refund flow |
| `manual_review` | State is ambiguous or risky and requires operator or support handling. | No |

State rules:

- payment state is not Wallet state;
- payment state is not Order state;
- payment state is not Ledger state;
- provider status must be translated before it enters platform contracts;
- terminal payment states are immutable except through new refund, correction or support workflows;
- duplicate provider callbacks must not create duplicate state transitions.

---

# 5. Payment Methods

Supported payment method types:

| Method | Purpose | Primary settlement owner |
|---|---|---|
| `card` | Bank card payment through external provider. | Payment provider |
| `sbp` | Fast Payment System payment through provider or future bank adapter. | Payment provider / SBP adapter |
| `wallet` | Internal balance payment through Wallet and Ledger. | Wallet / Ledger |
| `mixed` | Settlement split across wallet and one external method. | Payment orchestrates, domains own their parts |

Payment method rules:

- method lines must sum to the approved payable amount;
- each method line must include amount and currency;
- method-specific details must not leak into UI business logic;
- external provider credentials, card data, tokens and secrets must not be stored in Payment events;
- payment method availability can be configured by channel, provider, currency, machine, risk rules and legal requirements;
- Payment Engine validates settlement consistency but does not decide discounts or bonus rights.

Example settlement plan:

```json
{
  "payment_id": "payment_01JZ0000000000000000000000",
  "order_id": "order_01JZ0000000000000000000000",
  "discount_result_id": "discount_result_01JZ0000000000000000000000",
  "payable_amount": 117,
  "currency": "RUB",
  "method_lines": [
    {
      "method": "wallet",
      "amount": 50,
      "currency": "RUB",
      "wallet_reservation_id": "wallet_reservation_01JZ0000000000000000000000"
    },
    {
      "method": "card",
      "amount": 67,
      "currency": "RUB",
      "provider": "yookassa"
    }
  ]
}
```

---

# 6. Card Payments

Card payments are external provider payments.

Rules:

- card data must be handled by the provider, hosted payment form, SDK, tokenization flow or another approved PCI-safe mechanism;
- Soft ICE Platform must not store raw card numbers, CVV, magnetic stripe data or payment credentials;
- card confirmation, including 3-D Secure or equivalent customer challenge, is provider-owned;
- provider payment ID must be stored as a reference, not as the platform source of truth;
- card authorization can be separated from capture when provider and business policy support it;
- one-stage card payments are allowed when the provider captures immediately and the business flow accepts that behavior;
- card payment amount must be the external method line amount, not the gross product amount when wallet, bonus or discount applies;
- card refund must reference the original card payment provider ID and platform payment ID;
- card failures must release related wallet and bonus reservations through their owning domains.

Card flow:

```text
PaymentCreated
->
ProviderPaymentCreated
->
PaymentConfirmationRequired
->
Provider callback or status poll
->
PaymentAuthorized or PaymentCaptured
->
Ledger records financial fact
->
PaymentCompleted
```

Card payment is a settlement operation. It must not modify product configuration, discount result or bonus rules.

---

# 7. SBP Payments

SBP payments are external bank-transfer style payments through an approved provider or future direct SBP adapter.

Rules:

- SBP payment is initiated from the approved payable amount;
- customer confirmation happens through a QR code, deep link, bank app or provider-supported confirmation flow;
- Payment Engine stores provider references and confirmation metadata, not customer bank credentials;
- SBP settlement is treated as asynchronous until provider status confirms success or failure;
- SBP normally behaves as immediate payment, not a card-style authorization hold, unless a future provider contract explicitly supports two-stage behavior;
- timeout and expiry must be explicit because customer confirmation may never happen;
- duplicate SBP callbacks must be idempotent;
- refund policy must be provider-supported and must reference the original payment.

SBP flow:

```text
PaymentCreated
->
SBP confirmation generated
->
PaymentPendingConfirmation
->
Customer confirms in bank app
->
Provider callback or status poll
->
PaymentCaptured
->
Ledger records financial fact
->
PaymentCompleted
```

SBP provider details are hidden behind Payment Provider abstraction.

---

# 8. Wallet Payments

Wallet payments use internal balance. Wallet is a separate domain and Ledger is the source of truth.

Rules:

- Payment Engine never mutates Wallet projection directly;
- Wallet reservation, capture and release happen through Wallet, Transaction and Ledger contracts;
- wallet payment line amount must come from the approved settlement plan;
- active wallet reservation is not revenue;
- wallet capture is the internal settlement step that converts reserved balance into spending;
- wallet release returns reserved balance when payment, order or machine flow fails;
- wallet refund is a new compensating operation;
- wallet balance display must not be reconstructed from Payment state.

Wallet payment flow:

```text
Discount Result
->
Wallet reserves payable wallet amount
->
Payment Engine creates wallet payment line
->
Wallet capture requested after settlement confirmation
->
Ledger records capture
->
Wallet projection updates from Ledger
->
PaymentCompleted
```

If wallet reservation fails, Payment Engine must not start external payment for a mixed flow until the settlement plan is corrected by the checkout owner.

---

# 9. Mixed Payments

Mixed payment uses multiple method lines for one payable amount.

Supported MVP mixed flow:

```text
wallet + card
wallet + sbp
```

Mixed payment rules:

- each payment method line has explicit amount and currency;
- method line amounts must equal the approved payable amount;
- wallet portion should be reserved before starting external provider payment;
- external portion must not include the wallet amount;
- bonus redemption is not a payment line because bonus is a discount right;
- discount amount is not a payment line because discount is a price reduction;
- partial success must be handled through retry, release, refund or manual review;
- all method line settlements must be represented in Ledger;
- a mixed payment is completed only when all required settlement lines are completed or correctly compensated.

Recommended mixed flow:

```text
Discount Result payable amount
->
Wallet reserves internal part
->
Payment Engine creates external payment for remaining part
->
External payment succeeds
->
Wallet capture requested
->
Ledger records external payment and wallet capture
->
PaymentCompleted
```

Failure rules:

- external payment failure releases wallet reservation;
- external payment timeout releases wallet reservation after approved expiry policy;
- external success with wallet capture failure enters `manual_review`;
- wallet capture success with external provider ambiguity enters `manual_review` until provider status is resolved;
- duplicate retries must not duplicate wallet captures or provider captures.

---

# 10. Idempotency

Payment operations must be idempotent.

Idempotency applies to:

- payment creation;
- provider payment creation;
- authorization;
- capture;
- cancellation;
- refund;
- webhook handling;
- wallet line capture and release coordination;
- event publishing;
- retry workers and support replays.

Rules:

- every external command must include an idempotency key;
- every internal payment command must include a stable command ID;
- provider idempotency keys must be stored with the platform payment attempt;
- webhook events must be deduplicated by provider event ID, provider payment ID and platform correlation IDs;
- retry must read current platform and provider state before issuing a new side-effect command;
- duplicate commands return the existing result when the request matches the original command;
- duplicate commands with the same idempotency key and different semantic payload must be rejected;
- idempotency records must not contain provider secrets or card data.

Recommended idempotency scope:

```text
payment_id + operation_type + method_line_id + amount + currency
```

Idempotency is mandatory because external providers and event delivery may be at-least-once.

---

# 11. Authorization

Authorization has two meanings and both must be explicit.

Access authorization:

- customer can create payment only for their own checkout or order;
- operator and support actions require role-based access, actor ID and reason;
- provider callbacks require signature or trusted source verification;
- internal services require authenticated service identity;
- sensitive operations such as refund, cancellation and manual correction require audit metadata.

Payment authorization:

- card provider authorization holds funds before capture when two-stage payment is used;
- wallet reservation is the internal equivalent of holding funds, but it belongs to Wallet;
- SBP normally proceeds through customer confirmation and final payment rather than long authorization hold;
- authorization is not revenue;
- authorization does not mean product should be dispensed;
- authorization expiry must release related internal reservations.

Authorization rules:

- Payment Engine may authorize settlement but must not authorize business discounts or bonuses;
- payment authorization amount must match the method line amount;
- provider authorization ID must be stored as correlation metadata;
- failed authorization must publish a payment failure event and trigger reservation release where needed.

---

# 12. Capture

Capture converts an authorized or confirmed payment into captured funds.

Capture rules:

- capture is allowed only for authorized or capture-eligible payment lines;
- one-stage provider payments may combine authorization and capture in one provider operation;
- capture amount must not exceed authorized amount;
- partial capture is allowed only when product, order and finance policy explicitly support it;
- provider capture must be idempotent;
- wallet capture must go through Wallet, Transaction and Ledger;
- captured external funds must be recorded in Ledger as financial facts;
- downstream fulfillment should rely on completed payment settlement and Ledger-backed financial facts, not UI state.

Capture flow:

```text
PaymentAuthorized
->
CapturePayment command
->
Provider capture or Wallet capture
->
PaymentCaptured
->
Ledger Entry recorded
->
PaymentCompleted
```

If capture outcome is ambiguous, Payment Engine must enter `manual_review` or retry status reconciliation. It must not create a second capture blindly.

---

# 13. Refund

Refund is a new compensating financial operation.

Refund rules:

- refund never edits or deletes the original payment;
- refund must reference original `payment_id`, payment line and Ledger entries;
- refund can be full or partial if policy and provider support it;
- refund amount cannot exceed captured amount minus previous refunds;
- refund to original external method is preferred when available;
- refund to Wallet is allowed only through approved business policy and Wallet/Ledger contracts;
- refund of mixed payment must preserve method-line attribution;
- refund publishes events;
- refund must be recorded in Ledger;
- refund failure must not silently mark the original payment as unpaid.

Refund flow:

```text
RefundRequested
->
Refund command validated
->
Provider refund or Wallet refund flow
->
Ledger records refund
->
RefundCompleted
```

Refund events should allow CRM and Notification to explain what happened without exposing provider secrets.

---

# 14. Cancellation

Cancellation stops an unfinished payment before capture.

Cancellation rules:

- cancellation is allowed for `created`, `pending_confirmation`, `authorized` or equivalent provider states;
- captured payment cannot be cancelled and must use refund instead;
- provider cancellation must be idempotent;
- wallet reservation release must go through Wallet and Ledger contracts;
- bonus and coupon reservations must be released by their owning domains;
- cancellation reason must be recorded;
- cancellation can be customer-initiated, system-initiated, provider-initiated, order-initiated or operator-initiated;
- cancellation publishes `PaymentCancelled`.

Cancellation reasons:

- customer abandoned payment;
- confirmation expired;
- order cancelled;
- machine unavailable before capture;
- fraud review rejected;
- provider cancelled;
- operator cancelled with reason;
- duplicate payment replaced by canonical payment.

Cancellation is not refund. Cancellation removes or releases an unsettled obligation before captured funds exist.

---

# 15. Retry Policy

Payment retry must be conservative because duplicate settlement is harmful.

Retry rules:

- retry only idempotent operations automatically;
- use provider status read before repeating provider side effects;
- apply exponential backoff with a bounded retry count;
- use dead-letter or manual review after repeated failures;
- never retry with a different amount under the same payment operation;
- never create a second external payment when provider state is unknown;
- distinguish network failure from provider decline;
- provider decline is a business result and should not be retried automatically unless provider contract says it is transient;
- webhooks and polling must converge to the same platform state;
- event publishing retries must be deduplicated by event ID.

Ambiguous result handling:

```text
provider command sent
->
network timeout
->
read provider payment status
->
map provider status
->
complete, retry same idempotent command or enter manual_review
```

Retry policy must favor reconciliation over duplicate settlement.

---

# 16. Provider Abstraction

Payment Provider abstraction hides provider-specific APIs from platform domains.

Provider adapter responsibilities:

- create provider payment;
- provide confirmation information;
- read provider payment status;
- capture provider payment;
- cancel provider payment;
- create refund;
- read refund status;
- verify webhook authenticity;
- parse webhook payload;
- map provider status to platform state;
- expose provider capability metadata;
- normalize provider errors.

Provider adapter must not:

- calculate product price;
- apply discounts;
- redeem bonuses;
- mutate Wallet;
- write Ledger directly without approved finance contract;
- publish domain events outside Payment Engine coordination;
- expose provider secrets to event payloads.

Provider capability examples:

| Capability | Meaning |
|---|---|
| `supports_card` | Provider can process card payments. |
| `supports_sbp` | Provider can process SBP payments. |
| `supports_two_stage_capture` | Provider supports authorization before capture. |
| `supports_refund` | Provider supports refunds through API. |
| `supports_partial_refund` | Provider supports partial refunds. |
| `supports_webhook_signature` | Provider can authenticate inbound callbacks. |

Provider abstraction allows replacing YooKassa or adding future providers without changing Pricing, Discount, Bonus, Wallet, Ledger, Order or UI business logic.

---

# 17. YooKassa Integration

YooKassa is the planned initial external payment provider candidate.

YooKassa integration role:

```text
Payment Engine
->
YooKassaProviderAdapter
->
YooKassa API
```

Integration rules:

- YooKassa-specific API calls live only inside the YooKassa provider adapter;
- platform payment state remains provider-neutral;
- YooKassa payment ID is a provider reference, not the platform payment ID;
- YooKassa idempotency keys must be derived from platform payment operation identity;
- YooKassa webhooks must be verified before becoming platform events;
- YooKassa statuses must be mapped into Payment Engine states;
- YooKassa confirmation data must be treated as short-lived operational data;
- YooKassa receipt, tax or fiscalization details require a separate fiscalization/accounting decision before production use;
- YooKassa secrets must never appear in events, logs, docs examples with real values or frontend code.

Expected status mapping:

| YooKassa-style provider status | Platform interpretation |
|---|---|
| `pending` | `pending_confirmation` or provider processing, depending on confirmation state. |
| `waiting_for_capture` | `authorized` / `capture_pending`. |
| `succeeded` | `captured`, then `completed` after Ledger recording. |
| `canceled` | `cancelled`, `failed` or `expired` depending on cancellation reason and timing. |

Expected operations:

- create payment for card or SBP;
- redirect or confirmation handoff for customer approval;
- capture authorized payment when two-stage capture is used;
- cancel payment before capture when possible;
- create refund for captured payment;
- process YooKassa webhook into provider-neutral Payment events.

YooKassa integration must remain replaceable. No other domain should import YooKassa SDKs, constants, request shapes or provider status names.

---

# 18. Future Provider Support

Payment Engine must support future providers through the same abstraction.

Future provider types:

- another acquiring provider;
- direct SBP bank adapter;
- marketplace or aggregator provider;
- regional provider for future markets;
- offline or terminal provider if a vending terminal flow is approved;
- future saved payment method provider;
- future corporate or partner billing provider.

Future provider rules:

- provider selection must be policy-driven and explicit;
- provider capabilities must be declared before use;
- provider adapters must map into the same platform payment states;
- provider-specific risk signals may inform fraud review but must not change Pricing, Discount or Bonus logic;
- failover to another provider must not duplicate payment attempts;
- migrating providers must preserve old provider references for refunds and reconciliation;
- provider contract changes require payment contract version review.

The platform should be able to add providers without changing checkout business rules.

---

# 19. Event Interaction

Payment Engine publishes events after accepted state changes.

Payment events follow `docs/architecture/EVENT_PLATFORM.md`.

Published events:

| Event | Type | Meaning |
|---|---|---|
| `PaymentCreated` | domain/integration | Payment aggregate was created from approved settlement intent. |
| `PaymentStarted` | integration | Payment attempt was started. |
| `PaymentConfirmationRequired` | integration | Customer or provider confirmation is required. |
| `PaymentAuthorized` | integration | Payment line or payment was authorized but not captured. |
| `PaymentCaptureRequested` | domain | Capture was requested. |
| `PaymentCaptured` | integration | Funds were captured by provider or internal method. |
| `PaymentCompleted` | integration | Payment settlement completed and Ledger-backed facts are available. |
| `PaymentFailed` | integration | Payment failed before completion. |
| `PaymentCancelled` | integration | Payment was cancelled before capture. |
| `PaymentExpired` | integration | Payment confirmation or authorization expired. |
| `RefundRequested` | domain/integration | Refund flow was requested. |
| `RefundCompleted` | integration | Refund completed and Ledger-backed facts are available. |
| `RefundFailed` | integration | Refund could not be completed. |
| `PaymentManualReviewRequested` | integration | Payment requires operator or support review. |
| `ProviderWebhookReceived` | domain | Verified provider webhook was accepted for processing. |

Minimal `PaymentCompleted` payload:

```json
{
  "payment_id": "payment_01JZ0000000000000000000000",
  "order_id": "order_01JZ0000000000000000000000",
  "customer_id": "customer_01JZ0000000000000000000000",
  "transaction_id": "transaction_01JZ0000000000000000000000",
  "ledger_entry_ids": [
    "ledger_entry_01JZ0000000000000000000000"
  ],
  "discount_result_id": "discount_result_01JZ0000000000000000000000",
  "amount": 117,
  "currency": "RUB",
  "method_lines": [
    {
      "method": "card",
      "amount": 117,
      "currency": "RUB",
      "provider": "yookassa",
      "provider_payment_reference": "provider_payment_ref_masked"
    }
  ]
}
```

Event rules:

- event names use English PascalCase;
- payload fields use snake_case;
- events are facts, not commands;
- payloads include stable platform IDs;
- provider secrets, payment credentials and card data are forbidden in events;
- consumers must be idempotent;
- Event Storage does not replace Ledger;
- `PaymentCompleted` should be published only after the financial fact is Ledger-backed or explicitly correlated with Ledger recording policy.

---

# 20. Ledger Interaction

Ledger is the source of truth for financial history.

Payment Engine owns operational payment state. Ledger owns immutable financial facts.

Rules:

- Payment Engine never edits Ledger entries;
- successful payment, capture, cancellation with financial effect and refund must be represented in Ledger;
- provider success alone is not enough to become authoritative financial history;
- if Payment state and Ledger conflict for financial facts, Ledger wins;
- Ledger entries must reference payment ID, order ID, customer ID, method line and provider reference where applicable;
- Ledger must not store provider secrets or raw payment credentials;
- refund is a new Ledger entry, not an edit to the original sale or payment entry;
- reconciliation compares provider reports, Payment attempts and Ledger entries.

Ledger interaction flow:

```text
PaymentCaptured
->
Transaction / Ledger recording
->
LedgerEntryRecorded
->
PaymentCompleted
->
Wallet, CRM, Notification, Machine and Reporting consumers
```

Payment events may reference Ledger entry IDs. Ledger remains the authority for financial statements, accounting adapters and historical reconstruction.

---

# 21. Wallet Interaction

Wallet owns internal balance projection. Ledger owns Wallet financial history.

Payment and Wallet boundaries:

- Payment Engine never mutates Wallet projection directly;
- Wallet Engine never calls card, SBP, YooKassa or other payment providers;
- wallet payment lines are settled through Wallet reservation, capture and release;
- wallet refunds are represented through Wallet, Transaction and Ledger contracts;
- Payment failure can trigger wallet reservation release through approved events or commands;
- Payment completion can trigger wallet capture only through approved Wallet/Ledger flow;
- Wallet balance must not be inferred from payment state.

Typical wallet + external flow:

```text
WalletReserved
->
ExternalPaymentStarted
->
ExternalPaymentCompleted
->
WalletCaptureRequested
->
LedgerEntryRecorded
->
PaymentCompleted
```

If wallet and external provider states diverge, Payment Engine must pause the flow and request manual review or compensating action.

---

# 22. Discount Interaction

Discount Engine calculates price reductions and payable amount before Payment starts settlement.

Rules:

- Payment Engine consumes accepted Discount Result;
- Payment Engine must not calculate or stack discounts;
- payment amount equals Discount Result payable amount, after wallet split if applicable;
- payment events should reference `discount_result_id`;
- discount amount is not received money;
- discount amount is not Wallet balance;
- discount amount is not a provider payment amount;
- discount corrections after payment require refund, cancellation or approved order/finance correction flow.

Payment validates:

```text
sum(payment method line amounts) = discount_result.payable_amount
```

Payment rejects inconsistent settlement input. It does not recalculate it.

---

# 23. Bonus Interaction

Bonus Engine owns bonus rights. Bonus redemption creates a discount effect, not payment money.

Rules:

- Payment Engine never accrues bonuses;
- Payment Engine never reserves or redeems bonuses directly;
- bonus redemption must be represented in Discount Result before Payment starts;
- bonus amount is not a payment method line;
- payment success can be a trigger for Bonus Engine to redeem reserved bonus rights through approved checkout flow;
- payment failure, cancellation or expiry can trigger Bonus Engine to release reserved bonus rights;
- refund may trigger bonus reversal or cancellation only through Bonus Engine rules;
- Payment events may reference bonus reservation or redemption IDs for correlation when available.

Example:

```text
Gross amount: 130 RUB
Bonus discount: 20 RUB
Payable amount: 110 RUB
Payment amount: 110 RUB
```

Payment collects 110 RUB. It does not collect 130 RUB and it does not treat 20 bonuses as money.

---

# 24. Fraud Protection

Payment Engine must protect settlement from abuse, duplication and provider risk.

Required controls:

- idempotency keys for every side-effect operation;
- provider webhook verification;
- duplicate webhook detection;
- provider payment ID uniqueness checks;
- amount and currency consistency checks;
- customer, device, account, machine and payment velocity checks where legally allowed;
- suspicious mixed-payment pattern detection;
- refund velocity and refund amount controls;
- operator action audit for refunds, cancellations and manual review;
- manual review queue for ambiguous provider outcomes;
- provider risk code normalization;
- prevention of hidden UI-only payment amounts;
- secure storage of provider tokens and secrets outside frontend code;
- personal data minimization in events and logs;
- reconciliation against provider reports and Ledger.

Fraud review rules:

- Payment Engine may block, fail or hold payment settlement according to approved risk policy;
- fraud review must not mutate original payment history directly;
- confirmed correction uses refund, cancellation, Ledger correction or support workflow;
- payment risk decisions must not rewrite Pricing, Discount, Bonus or Wallet rules.

---

# 25. Architecture Principles

Payment architecture follows these principles:

1. Payment never changes business logic.
2. Payment only executes financial settlement.
3. Ledger remains the source of truth for financial history.
4. Payment publishes events after accepted state changes.
5. Payment is independent from UI, channel and provider API details.
6. Payment consumes approved payable amount; it does not calculate price.
7. Payment consumes Discount Result; it does not calculate discounts.
8. Payment references Bonus results; it does not manage bonus rights.
9. Payment coordinates Wallet settlement; it does not mutate Wallet projection.
10. Payment supports card, SBP, wallet and mixed payments.
11. Provider adapters hide provider-specific APIs and statuses.
12. YooKassa integration must remain replaceable.
13. Every payment side effect must be idempotent.
14. Refunds and corrections are new operations, never edits to original financial facts.
15. Captured funds must be represented in Ledger.
16. Provider callbacks must be verified and deduplicated.
17. Payment events must not expose secrets, credentials or raw card data.
18. Ambiguous provider outcomes require reconciliation or manual review.
19. Mixed payment settlement must preserve method-line attribution.
20. Future providers must not require changes to Pricing, Discount, Bonus, Wallet, Ledger or Order business logic.

---

# 26. Readiness Criteria

Payment architecture is ready for implementation when:

- Payment command, query and event contracts are approved;
- Discount Result and settlement plan contracts are stable;
- Wallet reservation, capture and release contracts are approved;
- Ledger operation mapping for payment, capture, cancellation and refund is approved;
- YooKassa provider adapter contract is approved;
- idempotency policy is approved;
- webhook verification and retry policy are documented;
- refund and cancellation policies are approved;
- fraud review rules are approved;
- test scenarios cover card, SBP, wallet, mixed payment, idempotency, retry, cancellation and refund.

---

# 27. Documentation Scope

This document is architecture-only.

It does not introduce JavaScript implementation, frontend changes, routes, styles, package changes, database migrations, payment provider integration, YooKassa credentials, cloud infrastructure, fiscalization implementation, accounting integration, CRM screens or notification templates.
