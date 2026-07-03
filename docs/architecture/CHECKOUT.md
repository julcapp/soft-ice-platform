# Checkout

Document code: ARCH-ORDER-CHECKOUT-001
Version: 0.2
Status: Draft
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-02
Last updated: 2026-07-02

Related documents:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/architecture/CONFIGURATION_ENGINE.md`
- `docs/architecture/PRICING_ENGINE.md`
- `docs/architecture/DISCOUNT_ENGINE.md`
- `docs/architecture/BONUS_ENGINE.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/WALLET.md`
- `docs/architecture/LEDGER.md`
- `docs/architecture/EVENT_PLATFORM.md`
- `docs/tasks/ORDER-002_CHECKOUT_PIPELINE.md`

---

# 1. Purpose

Checkout defines the deterministic customer purchase pipeline from product selection to confirmed order creation, payment success and machine queue handoff.

Checkout is an orchestration flow. It does not own product data, configuration rules, price rules, discount rules, bonus rights, wallet balance, payment provider integration, Ledger history, machine commands or notification delivery.

Core rules:

- Checkout validates and coordinates.
- Product, Configuration, Pricing, Discount, Bonus, Payment, Order, Ledger and Machine domains keep their own ownership.
- Every financial calculation occurs before Payment Engine starts settlement.
- Payment starts only from the accepted payable amount.
- Order stores accepted configuration, pricing and discount facts as snapshots.
- Order snapshots are immutable after confirmation.
- Events are published only after accepted state changes.
- Machine queue entry is created only after payment success policy is satisfied.

---

# 2. Architecture Role

Checkout sits between customer channel interactions and the Order aggregate.

Architecture position:

```text
Customer channel
->
Product selection
->
Checkout orchestration
->
Configuration Engine
->
Availability validation
->
Pricing Engine
->
Discount Engine
->
Bonus Engine reservation when used
->
Order snapshot acceptance
->
Payment Engine
->
Order confirmation
->
Event Platform
->
Machine queue
```

Checkout owns:

- checkout intent identity;
- orchestration order;
- idempotency keys for customer commands;
- validation sequence;
- accepted settlement plan assembly;
- reservation cleanup coordination;
- timeout and retry coordination;
- user-facing recoverable checkout state.

Checkout does not own:

- Product Catalog;
- configuration compatibility rules;
- machine recipe calculation;
- price calculation;
- discount stacking;
- bonus lifecycle;
- Wallet balance;
- payment lifecycle;
- financial Ledger;
- Order historical snapshots;
- machine hardware execution;
- event storage;
- notification templates.

---

# 3. Deterministic Pipeline

The canonical checkout pipeline is:

```text
1. Product selection
2. Checkout intent creation
3. Configuration validation
4. Availability validation
5. Pricing calculation
6. Discount calculation
7. Bonus reservation
8. Order snapshot acceptance
9. Payment initialization
10. Payment confirmation
11. Order confirmation
12. Event publication
13. Machine queue handoff
14. Customer-visible fulfillment tracking
```

This order is mandatory. A later step must not run until every required earlier step has produced an accepted result.

Determinism rules:

- the same accepted input, context, rule versions and idempotency key must produce the same checkout result;
- if active catalog, pricing, discount, bonus, payment or machine state changes before acceptance, checkout must recalculate or reject the stale flow;
- if a repeated command uses the same idempotency key and same semantic payload, checkout returns the existing result;
- if a repeated command uses the same idempotency key and conflicting payload, checkout rejects it;
- Checkout must read current Order, Payment, Bonus and Machine state before retrying side effects;
- UI refresh, repeated button tap, delayed callback or webhook replay must not create duplicate orders, duplicate payments, duplicate bonus redemption or duplicate machine preparation.

---

# 4. Successful Flow

## 4.1 Product Selection

Customer selects a product and options in a channel such as Mini App, terminal or future web app.

Input:

- `customer_id` or anonymous customer context;
- `channel`;
- `machine_id` when the channel is tied to a vending machine;
- `product_id`;
- selected flavor, size, syrup, topping and future extras;
- optional coupon or campaign input;
- optional requested bonus redemption amount;
- requested payment method.

Rules:

- UI may collect selection intent but must not calculate final price.
- UI may display availability hints but must not be the authority for availability.
- selected IDs must be stable semantic IDs, not translated labels.
- product selection does not reserve inventory, bonuses, coupons or payment funds by itself.

Output:

- checkout selection input ready for checkout intent creation.

## 4.2 Checkout Intent Creation

Checkout creates or resumes a checkout intent.

Required identity:

- `checkout_intent_id`;
- `idempotency_key`;
- `customer_id` or anonymous customer reference;
- `channel`;
- `machine_id` when required;
- `correlation_id`;
- request payload hash.

Rules:

- checkout intent is not a confirmed order;
- duplicate intent creation with the same key and same payload resumes the existing intent;
- duplicate intent creation with the same key and different payload is rejected;
- abandoned intents can expire without creating a committed order;
- every side effect after intent creation must use stable correlation and causation IDs.

## 4.3 Configuration Validation

Checkout sends the selected product and options to Configuration Engine.

Configuration Engine validates:

- product ID exists;
- flavor, size, syrup, topping and extras exist;
- selected options are compatible;
- selected configuration is complete for the product type;
- recipe and media references can be resolved for the accepted configuration when required by current policy.

Output:

- accepted configuration result with product, option, recipe and media semantic IDs;
- validation errors when the configuration is incomplete or incompatible.

Rules:

- invalid configuration cannot be priced;
- invalid configuration cannot start payment;
- Checkout does not reinterpret historical configuration results;
- after Order confirmation, the configuration snapshot is immutable.

## 4.4 Availability Validation

Checkout validates product and fulfillment availability before financial calculation and again when policy requires it before payment initialization.

Availability inputs:

- Product Catalog availability;
- channel availability;
- machine availability;
- machine ingredient and topping availability when exposed through an approved projection;
- recipe availability;
- payment method availability;
- risk or operational blocks when applicable.

Rules:

- unavailable product or required option rejects checkout before payment;
- unavailable machine before payment blocks payment start;
- unavailable payment method blocks payment initialization;
- stale availability requires revalidation;
- machine availability hints do not replace Machine Platform state.

Output:

- accepted availability context;
- deterministic rejection reason;
- recovery instruction such as choose another product, choose another machine or retry later.

## 4.5 Pricing Calculation

Checkout sends the accepted configuration result to Pricing Engine.

Pricing Engine calculates:

- line base amount;
- option amount when applicable;
- gross amount;
- currency;
- pricing rule version;
- bonus eligibility and bonus redemption limit.

Rules:

- Pricing Engine calculates gross financial facts before discounts and payment;
- Checkout must not calculate base price, option price or bonus cap locally;
- Payment Engine must not recalculate price;
- Order stores the accepted Pricing Result as a pricing snapshot;
- historical orders never recalculate price from live catalog data.

Output:

- `pricing_result_id`;
- `gross_amount`;
- `currency`;
- line details;
- `bonus_allowed`;
- `bonus_redemption_limit`;
- pricing version.

## 4.6 Discount Calculation

Checkout sends the accepted Pricing Result and checkout context to Discount Engine.

Discount Engine calculates:

- automatic discount eligibility;
- coupon eligibility and usage reservation when applicable;
- membership, campaign or trusted customer effects when applicable;
- allowed stacking;
- accepted and rejected discount lines;
- total discount amount;
- payable amount before payment.

Rules:

- discounts are price reductions, not money;
- Discount Engine calculates payable amount before Payment Engine starts;
- UI must not combine discounts locally;
- final payable amount must be non-negative;
- changes to discounts after payment require refund, cancellation or support correction flow;
- Order stores the accepted Discount Result as a discount snapshot.

Formula:

```text
gross_amount
- total_discount_amount
= payable_amount
```

Output:

- `discount_result_id`;
- discount lines with rule IDs and versions;
- `total_discount_amount`;
- `payable_amount`;
- `currency`;
- bonus stacking decision.

## 4.7 Bonus Reservation

When the customer chooses to use bonuses, Checkout coordinates with Bonus Engine after pricing and discount eligibility are known.

Bonus Engine validates and reserves:

- customer bonus projection state;
- active eligible bonus rights;
- requested bonus amount;
- pricing or discount cap;
- reservation expiry;
- idempotency key.

Rules:

- bonuses are discount rights, not money;
- Bonus Engine owns reservation, redemption, release and expiration;
- reserved bonuses cannot be reused by another checkout;
- bonus reservation must expire or be released when checkout fails;
- bonus redemption occurs after payment success through the approved checkout/order flow;
- Payment Engine never treats bonus amount as a payment method line.

Output:

- `bonus_reservation_id` when bonuses are used;
- reserved bonus amount;
- reservation expiry;
- accepted bonus discount effect included in the final Discount Result.

## 4.8 Order Snapshot Acceptance

Checkout creates or updates the Order aggregate with accepted snapshots before payment initialization.

Order accepts:

- product snapshot;
- configuration snapshot;
- pricing snapshot;
- discount snapshot;
- bonus reservation reference when used;
- machine and fulfillment context;
- audit and idempotency metadata.

Resulting Order state:

```text
created
->
priced
->
discounted
->
awaiting_payment
```

Rules:

- Order is the business aggregate;
- Order owns historical snapshots;
- Order snapshots must be accepted before Payment Engine starts settlement;
- Order snapshots become immutable after order confirmation;
- Order must not reference mutable catalog data as historical truth;
- Order amount is derived from accepted snapshots, not recalculated;
- if snapshot acceptance fails, payment must not start.

Output:

- `order_id`;
- `order_number`;
- immutable snapshot references;
- `payable_amount`;
- `currency`;
- `awaiting_payment` state;
- event candidates for accepted state changes.

## 4.9 Payment Initialization

Checkout prepares a settlement plan from the accepted Order discount snapshot and starts Payment Engine.

Settlement plan includes:

- `order_id`;
- `discount_result_id`;
- `payable_amount`;
- `currency`;
- one or more payment method lines;
- wallet reservation reference when internal wallet is used;
- provider selection for external method lines;
- payment idempotency key.

Rules:

- payment method lines must sum to payable amount;
- Payment Engine validates amount consistency but does not recalculate price or discounts;
- wallet reservation happens before external provider payment in mixed flows;
- provider-specific confirmation details stay inside Payment Engine and provider adapters;
- payment credentials, tokens, raw card data and provider secrets must not enter Order or Checkout records.

Output:

- `payment_id`;
- payment status;
- confirmation URL, token, QR/deep link or other provider-safe handoff when needed;
- Order payment binding.

## 4.10 Payment Confirmation

Payment confirmation is completed by provider callback, polling, wallet settlement or approved internal settlement process.

Payment Engine confirms:

- provider or wallet status;
- amount and currency;
- payment method line results;
- idempotent callback or poll handling;
- Ledger-backed financial fact according to Payment and Ledger policy.

Rules:

- provider success alone is not enough when Ledger policy requires financial recording first;
- duplicate callbacks must not duplicate captures or Order transitions;
- ambiguous provider state requires reconciliation before retry;
- payment failure does not mutate pricing, discount or bonus rules;
- payment failure releases wallet, bonus and coupon reservations through their owning domains.

Output:

- `PaymentCompleted`, `PaymentFailed`, `PaymentCancelled`, `PaymentExpired` or manual review event;
- Ledger references when payment is completed;
- updated Payment aggregate state.

## 4.11 Order Confirmation

Order confirmation is the business acceptance that payment succeeded for the accepted snapshots.

Order reacts to `PaymentCompleted` and confirms:

- payment ID matches the Order payment binding;
- payment amount equals accepted payable amount;
- currency matches;
- payment completion is Ledger-backed or satisfies approved Ledger policy;
- bonus reservation, coupon reservation and wallet states can move to success follow-up;
- Order is eligible for fulfillment.

Resulting Order state:

```text
awaiting_payment
->
paid
```

Rules:

- Order confirmation does not recalculate configuration, pricing, discount or payable amount;
- Order snapshots are immutable after confirmation;
- corrections after confirmation require explicit cancellation, refund, support or compensating workflow;
- bonus reservation is redeemed after payment success through Bonus Engine;
- Order confirmation publishes an Order business event.

Output:

- confirmed `order_id`;
- `paid` order state;
- immutable historical snapshots;
- fulfillment request eligibility.

## 4.12 Event Publication

Every accepted state change publishes formal events through Event Platform.

Expected event sequence for the successful MVP flow:

| Step | Event examples | Producer |
|---|---|---|
| Configuration accepted | `ConfigurationValidated` | Configuration Engine |
| Pricing calculated | `PriceCalculated` | Pricing Engine |
| Discount calculated | `DiscountCalculated`, `DiscountApplied` | Discount Engine |
| Bonus reserved | `BonusReserved` | Bonus Engine |
| Order accepted | `OrderCreated`, `OrderPriced`, `OrderDiscounted`, `OrderAwaitingPayment` | Order Platform |
| Payment initialized | `PaymentCreated`, `PaymentStarted`, `PaymentConfirmationRequired` | Payment Engine |
| Payment completed | `PaymentCompleted` | Payment Engine |
| Order confirmed | `OrderPaid` | Order Platform |
| Bonus redeemed | `BonusRedeemed` | Bonus Engine |
| Fulfillment requested | `OrderFulfillmentRequested` | Order Platform |
| Machine queued | `MachinePreparationRequested` or approved Machine queue event | Machine Platform |

Rules:

- events are facts, not commands;
- payload fields use snake_case;
- event names use stable English PascalCase;
- event payloads include stable IDs and correlation IDs;
- events must not contain payment credentials, provider secrets or unnecessary personal data;
- consumers must be idempotent;
- event retries use the same event ID for the same accepted state transition.

## 4.13 Machine Queue Handoff

Machine queue handoff happens only after Order confirmation.

Order requests fulfillment with:

- `order_id`;
- `order_item_id`;
- `machine_id`;
- accepted recipe ID from configuration snapshot;
- quantity;
- fulfillment priority;
- correlation ID;
- idempotency key.

Rules:

- Checkout and Order do not send low-level machine commands directly;
- Machine Platform owns queue, readiness, hardware commands, telemetry and preparation outcome;
- queue entry must be idempotent by order item and accepted recipe snapshot;
- duplicate fulfillment requests must not produce duplicate dessert preparation;
- machine queue timeout requires status reconciliation before retry;
- machine failure after payment starts fulfillment recovery, support or refund policy.

Output:

- queued machine operation reference;
- Order transition to `fulfillment_requested` when accepted;
- later Machine events drive `preparing`, `ready`, `completed` or `fulfillment_failed`.

---

# 5. Financial Boundary

All financial calculations occur before payment.

Financial calculation order:

```text
Configuration Result
->
Pricing Result
->
Discount Result
->
Bonus reservation and discount effect
->
Accepted payable amount
->
Settlement plan
->
Payment initialization
```

Payment amount rule:

```text
sum(payment_method_lines) = accepted payable_amount
```

Payment Engine must reject settlement input when:

- amount does not match accepted payable amount;
- currency does not match;
- method line sum does not equal payable amount;
- discount or bonus identifiers conflict with accepted snapshots;
- idempotency key is reused with a conflicting payload.

Discount amount and bonus amount are not payment method lines. Wallet amount is a payment method line only when Wallet balance is used for settlement.

---

# 6. Snapshot Immutability

Order snapshots are immutable after Order confirmation.

Immutable snapshots:

- product snapshot;
- configuration snapshot;
- pricing snapshot;
- discount snapshot;
- bonus reservation and redemption references;
- payment binding reference;
- accepted fulfillment recipe reference.

Rules:

- snapshots may be assembled before payment while Order is awaiting payment;
- snapshots become historical truth when the Order is confirmed as paid;
- confirmed snapshots are not edited when catalog, price, discount, bonus, recipe or media data changes later;
- support corrections are new compensating operations, not silent edits;
- refunds and cancellations reference original snapshots;
- CRM, support, analytics and reporting read historical facts from snapshots.

---

# 7. Failure Scenarios

Expected failure scenarios:

| Scenario | Detection point | Checkout behavior | Required cleanup |
|---|---|---|---|
| Product unavailable | Product selection or availability validation | Reject checkout and ask customer to choose another product. | None unless prior reservations exist. |
| Invalid configuration | Configuration validation | Reject before pricing. | None. |
| Recipe unavailable | Configuration or availability validation | Reject before payment or route to approved fallback. | None. |
| Machine unavailable before payment | Availability validation | Block payment start. | Release coupon or bonus reservations if already created. |
| Pricing input stale | Pricing calculation | Recalculate or reject stale checkout. | None. |
| Pricing conflict | Pricing calculation or Order snapshot acceptance | Reject acceptance until pricing is recalculated. | Release temporary reservations if any. |
| Discount expired | Discount calculation | Recalculate and require customer confirmation if payable amount changes. | Release coupon reservation if invalid. |
| Coupon reservation failed | Discount calculation | Continue without coupon only if customer accepts new payable amount. | Release failed or partial coupon state through Discount Engine. |
| Bonus reservation failed | Bonus reservation | Continue without bonuses only if customer accepts new payable amount. | Release partial bonus reservation if created. |
| Wallet reservation failed | Payment initialization | Require another method or corrected wallet amount. | Release any dependent reservation if checkout cannot continue. |
| Payment provider initialization failed | Payment initialization | Keep Order awaiting payment when retry is safe; otherwise expire or cancel by policy. | Release wallet, bonus and coupon reservations on terminal failure. |
| Customer abandons payment | Payment confirmation timeout | Expire payment or checkout by policy. | Release wallet, bonus and coupon reservations. |
| Payment declined | Payment confirmation | Mark payment attempt failed; allow new payment attempt if Order is still valid. | Release wallet reservation and keep/release bonus by policy. |
| Payment status unknown | Payment confirmation | Reconcile provider status before new payment attempt. | Do not duplicate settlement. |
| Payment succeeds but callback delayed | Payment confirmation | Wait for callback or poll provider; do not create second payment. | None until reconciliation outcome. |
| Payment completed but Ledger recording delayed | Payment confirmation | Hold Order confirmation until Ledger policy is satisfied or manual review is opened. | Do not fulfill yet. |
| Payment completed but bonus redemption fails | Order confirmation follow-up | Move to support review or retry idempotent redemption. | Do not mutate payment history. |
| Machine queue rejected after payment | Machine queue handoff | Move Order to fulfillment recovery or support review. | Start retry, alternate fulfillment or refund policy. |
| Machine preparation fails | Fulfillment | Move Order to `fulfillment_failed`. | Trigger recovery, support or refund workflow. |
| Event publication fails | Event publication | Retry through Event Platform with same event ID. | Do not duplicate accepted state transition. |

Failure handling must preserve idempotency and avoid duplicate payment, duplicate bonus redemption and duplicate product preparation.

---

# 8. Retry Scenarios

Retry rules:

- retry only idempotent operations automatically;
- use bounded exponential backoff for transient infrastructure failures;
- reconcile current domain state before retrying external side effects;
- do not create a second payment when provider state is unknown;
- do not create a second machine queue entry when operation state is unknown;
- do not redeem or release the same bonus reservation twice;
- preserve original correlation and causation IDs;
- move repeated failures to support review or dead-letter handling.

Retry examples:

| Scenario | Retry behavior |
|---|---|
| Checkout intent creation timeout | Read by idempotency key before creating another intent. |
| Pricing calculation timeout | Retry calculation because no external side effect should have happened. |
| Discount calculation timeout | Retry calculation; coupon reservation retry must use same idempotency key. |
| Bonus reservation timeout | Read Bonus reservation by idempotency key before reserving again. |
| Payment creation network timeout | Read Payment state and provider state before retrying provider creation. |
| Provider callback replay | Deduplicate by provider event ID, provider payment ID and platform payment ID. |
| Payment capture timeout | Read provider capture status before retrying capture. |
| Event publish timeout | Retry same event ID according to Event Platform policy. |
| Machine queue timeout | Read machine operation state before sending another request. |
| Machine completion event delayed | Reconcile Machine Platform state before marking fulfillment failed. |

Retry policy must favor reconciliation over duplicate settlement or duplicate preparation.

---

# 9. Idempotency

Checkout requires idempotency at every side-effect boundary.

Idempotent operations:

- checkout intent creation;
- configuration acceptance;
- pricing calculation acceptance;
- discount calculation acceptance;
- coupon reservation;
- bonus reservation;
- Order snapshot acceptance;
- payment creation;
- provider payment creation;
- webhook handling;
- payment success or failure handling;
- bonus redemption or release;
- event publication;
- fulfillment request;
- machine queue handoff;
- timeout expiration;
- cancellation.

Recommended checkout idempotency scope:

```text
customer_id + channel + checkout_intent_id + operation_type + accepted_payload_hash
```

Recommended order idempotency scope:

```text
order_id + operation_type + accepted_snapshot_hash
```

Recommended payment idempotency scope:

```text
payment_id + operation_type + method_line_id + amount + currency
```

Recommended machine queue idempotency scope:

```text
order_id + order_item_id + machine_id + recipe_id + operation_type
```

Rules:

- duplicate commands with the same payload return existing result;
- duplicate commands with conflicting payload under the same key are rejected;
- external callbacks are deduplicated by provider event ID and platform correlation IDs;
- event consumers deduplicate by `event_id`;
- idempotency records must not contain secrets.

---

# 10. Timeout Handling

Checkout timeouts must be explicit and stateful.

Timeout types:

| Timeout | Example behavior |
|---|---|
| Checkout intent timeout | Expire abandoned checkout before committed Order confirmation. |
| Availability hold timeout | Revalidate availability before payment. |
| Coupon reservation timeout | Release coupon reservation through Discount Engine. |
| Bonus reservation timeout | Release or expire bonus reservation through Bonus Engine. |
| Wallet reservation timeout | Release wallet reservation through Wallet/Ledger policy. |
| Payment confirmation timeout | Reconcile provider status before cancellation or retry. |
| Provider webhook delay | Poll provider or wait according to Payment policy; do not duplicate payment. |
| Ledger recording timeout | Hold Order confirmation or route to manual review. |
| Machine queue timeout | Reconcile machine operation status before queue retry. |
| Fulfillment timeout | Move to fulfillment recovery or support review by policy. |

Rules:

- timeout does not automatically mean failure when an external side effect may have succeeded;
- ambiguous payment and machine outcomes require reconciliation;
- timeout cleanup must release temporary reservations through owning domains;
- timeout events must include correlation IDs and reason codes;
- customer-visible state should reflect current Order, Payment and Machine facts, not assumed timers.

---

# 11. Event Publication

Checkout-related events follow `docs/architecture/EVENT_PLATFORM.md`.

Event publication rules:

- publish only after accepted domain state changes;
- use stable English PascalCase event names;
- use snake_case payload fields;
- include stable IDs and correlation IDs;
- keep payloads minimal and sufficient;
- never include provider secrets, payment credentials, raw cards or unnecessary personal data;
- retry publication without duplicating business state transitions;
- consumers must be idempotent.

Event publication is not a substitute for Order repository, Payment aggregate, Bonus projection, Machine state or Finance Ledger.

---

# 12. Machine Queue

Machine queue is the bridge from confirmed order to physical preparation.

Machine queue contract must include:

- `queue_entry_id` or machine operation ID;
- `order_id`;
- `order_item_id`;
- `machine_id`;
- `recipe_id`;
- quantity;
- priority or scheduling policy;
- idempotency key;
- correlation ID;
- requested timestamp.

Queue rules:

- only paid and confirmed orders can enter the machine queue;
- queue entry references immutable Order snapshots;
- machine preparation uses recipe snapshot references, not live UI state;
- Machine Platform owns hardware commands and telemetry;
- Order owns business fulfillment status;
- repeated queue handoff must resolve to one machine operation;
- machine failure after payment must trigger recovery, retry, support or refund policy.

---

# 13. Customer-Visible State

Customer channels may show checkout progress, but they must not become the source of truth.

Allowed customer-visible states:

- selecting product;
- validating configuration;
- checking availability;
- calculating price;
- applying discounts;
- reserving bonuses;
- awaiting payment;
- payment confirmation required;
- payment processing;
- order confirmed;
- preparing;
- ready;
- completed;
- failed with recovery action.

Rules:

- UI state is derived from Checkout, Order, Payment and Machine facts;
- UI must not infer payment success from a redirect alone;
- UI must not infer machine success from a timer alone;
- user-facing messages are channel concerns and must not change domain state.

---

# 14. Security and Audit

Checkout must preserve auditability without storing secrets.

Audit fields:

- `checkout_intent_id`;
- `order_id`;
- `payment_id`;
- `customer_id`;
- `channel`;
- `machine_id`;
- `actor`;
- `correlation_id`;
- `causation_id`;
- `idempotency_key`;
- command timestamp;
- accepted snapshot hash;
- state transition reason;
- timeout or failure reason when applicable.

Security rules:

- customer can access only their own checkout and order;
- provider callbacks require verification inside Payment Engine;
- machine-originated facts require trusted machine or adapter identity;
- payment credentials, card data and provider secrets are forbidden in Checkout and Order records;
- idempotency keys must not leak secrets;
- support actions require actor ID and reason.

---

# 15. Architecture Principles

Checkout architecture follows these principles:

1. Checkout orchestrates; domains own their facts.
2. Checkout is deterministic.
3. Product selection is intent, not payment or fulfillment.
4. Configuration must be valid before pricing.
5. Availability must be valid before payment.
6. All financial calculations occur before payment.
7. Pricing calculates gross amount.
8. Discount calculates payable amount.
9. Bonus reservation holds discount rights, not money.
10. Payment collects only accepted payable amount.
11. Order owns immutable historical snapshots.
12. Order snapshots are immutable after confirmation.
13. Ledger remains the source of truth for financial history.
14. Machine Platform owns hardware execution and queue state.
15. Events are facts published after accepted state changes.
16. Every side-effect boundary is idempotent.
17. Retries reconcile before repeating side effects.
18. Timeouts release temporary reservations only through owning domains.
19. Corrections are compensating operations, not silent edits.
20. UI does not calculate totals, redeem bonuses, confirm payment or infer machine fulfillment.

---

# 16. Documentation Scope

This document is architecture-only.

It does not introduce JavaScript implementation, frontend changes, routes, styles, package changes, database migrations, payment provider integration, machine integration, CRM screens, notification templates or cloud infrastructure.
