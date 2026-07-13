# Domain Events Contract

Document code: ARCH-DOMAIN-EVENTS-CONTRACT-001
Task: API-006
Version: 0.1
Status: Draft
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-13
Last updated: 2026-07-13
Scope: Documentation only

Related documents:

- `docs/api/EVENT_API.md`
- `docs/architecture/EVENT_PLATFORM.md`
- `docs/architecture/MVP_BACKEND_ARCHITECTURE.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/architecture/CHECKOUT.md`
- `docs/domain/PAYMENT_LEDGER_CONTRACT.md`
- `docs/domain/CLUB_ACCOUNT_CONTRACT.md`
- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/MACHINE_DOMAIN.md`
- `docs/machine/MACHINE_EVENTS_TELEMETRY.md`
- `docs/product/TELEGRAM_BOT_FLOW.md`
- `docs/data/DATABASE_FOUNDATION.md`

---

# 1. Purpose

This document defines the platform domain events contract for the MVP backend and future Event Registry.

It narrows the general Event API into concrete domain event families for:

- Payment;
- Club Account;
- Order;
- Machine;
- Customer;
- Telegram notification triggers;
- idempotency and audit requirements.

Core rule:

```text
Domain events are immutable Runtime-owned facts.
They are emitted after the owning Runtime accepts the state change.
Consumers react idempotently and must not treat event delivery as exactly-once.
```

This document is documentation-only. It does not create event bus code, backend handlers, database migrations, schemas, Telegram bot behavior, payment provider calls, machine commands or generated build output.

---

# 2. Event Naming Rules

Canonical platform event names use the Event API format:

```text
<Domain>.<Fact>
```

Examples:

```text
Payments.Completed
ClubAccounts.TopUpCredited
Orders.PaymentConfirmed
Machines.ProductDispensed
Customers.TelegramIdentityLinked
Notifications.Sent
```

Naming rules:

- the domain segment uses an approved English PascalCase namespace;
- the fact segment uses an English PascalCase fact phrase;
- names describe facts that already happened;
- names do not describe commands, UI actions, buttons, screens or wishes;
- names do not include provider names, queue names, broker names or transport technology;
- names do not use Russian words, local abbreviations or customer-facing copy;
- names do not expose implementation class names;
- event names remain reserved after deprecation;
- changed semantics require a new event version or a new event name;
- old pre-Event-API aliases such as `PaymentCompleted` or `OrderCreated` may appear in legacy architecture docs, but new platform contracts use `Payments.Completed` and `Orders.Created`.

Approved initial domain namespaces:

| Namespace | Owner | Notes |
|---|---|---|
| `Payments` | Payment Runtime | Provider-independent payment, refund and reconciliation facts. |
| `ClubAccounts` | Club Account Runtime | Customer prepaid account and transaction facts. |
| `Orders` | Order Runtime | Purchase lifecycle and fulfillment gating facts. |
| `Machines` | Machine Runtime | Equipment, telemetry, command acceptance and physical outcome facts. |
| `Customers` | Customer Runtime | Identity, profile, consent, club, trust and referral facts. |
| `Notifications` | Notification Runtime | Notification request, send, delivery and suppression facts. |
| `Bonus` | Bonus Runtime | Bonus rights facts; documented elsewhere but consumed by notification triggers. |
| `Promotions` | Promotion Runtime | Future campaign facts. |

`Wallet.*` names in older documents are not the preferred namespace for new Club Account prepaid-balance facts. Any bridge from legacy `Wallet.*` wording to `ClubAccounts.*` must be explicit in the Event Registry and must not duplicate financial side effects.

---

# 3. Event Envelope Structure

Every domain event uses the Event API envelope around a Runtime-owned payload.

Required envelope shape:

```json
{
  "event_id": "evt_01K0000000000000000000000",
  "event_name": "Orders.PaymentConfirmed",
  "event_version": 1,
  "event_category": "domain",
  "source_runtime_id": "runtime_order",
  "source_domain": "orders",
  "occurred_at": "2026-07-13T00:00:00Z",
  "published_at": "2026-07-13T00:00:01Z",
  "aggregate_type": "order",
  "aggregate_id": "order_01K0000000000000000000000",
  "aggregate_sequence": 7,
  "correlation_id": "checkout_01K0000000000000000000000",
  "causation_id": "evt_01K0000000000000000000001",
  "idempotency_key": "orders.payment_confirmed:order_01K0000000000000000000000:payment_01K0000000000000000000000",
  "actor_context": {
    "actor_type": "system",
    "actor_id": "runtime_order"
  },
  "payload": {},
  "metadata": {
    "schema_ref": "event://orders/Orders.PaymentConfirmed/v1",
    "producer": "Order Runtime",
    "environment": "production",
    "sensitivity": "payment-sensitive"
  }
}
```

Required fields:

| Field | Rule |
|---|---|
| `event_id` | Globally unique event identity. Publication retries for the same fact reuse the same value. |
| `event_name` | Canonical `<Domain>.<Fact>` name. |
| `event_version` | Integer contract version. |
| `event_category` | `domain`, `integration`, `notification`, `analytics`, `operational` or `audit`. |
| `source_runtime_id` | Runtime Registry ID of the producer. |
| `source_domain` | Domain namespace that owns payload meaning. |
| `occurred_at` | UTC timestamp when the fact was accepted or occurred. |
| `published_at` | UTC timestamp when Event Runtime accepted the event for delivery. |
| `aggregate_type` | Aggregate or resource type affected by the fact. |
| `aggregate_id` | Stable aggregate or resource ID. |
| `correlation_id` | End-to-end business flow ID. |
| `causation_id` | Command, request, event or external fact that caused this event. |
| `payload` | Versioned event-specific data owned by the producer Runtime. |
| `metadata` | Technical metadata for schema, sensitivity, producer and delivery policy. |

Recommended fields:

| Field | Rule |
|---|---|
| `aggregate_sequence` | Monotonic sequence inside one aggregate when available. |
| `idempotency_key` | Stable duplicate protection key for producer and consumers. |
| `actor_context` | Safe actor reference for customer, machine, operator, provider, system or support. |
| `authorization_context_ref` | Reference to authorization decision where needed. |
| `trace_context` | Future distributed tracing metadata. |
| `replay_context` | Present only during replay delivery. |

Envelope rules:

- envelope fields use `snake_case`;
- timestamps use UTC ISO 8601 / RFC 3339;
- payload fields use `snake_case`;
- payloads carry stable platform IDs and immutable snapshot references;
- raw provider payloads, raw Telegram init data, raw card data, tokens, signatures, bot tokens and API keys are forbidden;
- personal data is minimized and included only when the owning contract and consent policy allow it;
- event storage does not replace source Runtime storage or Finance Ledger.

---

# 4. Domain Event Ownership

Ownership rules:

- the producing Runtime owns event semantics, payload shape and versioning;
- Event Runtime owns envelope validation, routing, delivery, retry, replay and dead-letter behavior;
- consumers own idempotent processing and supported-version declarations;
- Notification Runtime owns notification request, template, channel, throttling and suppression policy;
- Telegram Bot is a delivery channel and launcher, not a source of payment, account, order or machine truth;
- Analytics consumes events and builds projections, but analytics events are not a substitute for domain events;
- external provider facts must be authenticated and translated by adapters before platform events are emitted.

Producer responsibilities:

- validate the business fact before event publication;
- persist accepted state or transaction before event publication;
- publish through transactional outbox or equivalent durable pattern when implemented;
- reuse the same `event_id` for publication retries;
- include correlation, causation, actor and idempotency metadata;
- never publish facts owned by another Runtime.

Consumer responsibilities:

- deduplicate by `event_id` at minimum;
- use domain idempotency keys for balance, payment, refund, machine and notification side effects;
- tolerate delayed, duplicate and out-of-order events;
- reject or skip unsupported versions according to documented policy;
- suppress non-replay-safe side effects during replay;
- never call private producer internals as part of event interpretation.

---

# 5. Payment Events

Owner:

```text
Payment Runtime
```

Payment events are provider-independent facts. YooKassa, SBP, QR links, redirects, webhooks and polling results are inputs to Payment Runtime, not direct business events for Order, Club Account or Machine.

Canonical Payment event catalog:

| Event | Category | Produced after | Required downstream rule |
|---|---|---|---|
| `Payments.IntentCreated` | domain | PaymentIntent accepted. | No money is collected yet. |
| `Payments.SessionCreated` | domain | Concrete provider or channel session created. | Session is not proof of payment. |
| `Payments.ConfirmationRequired` | domain | Customer must confirm payment through approved channel. | UI or bot may show safe confirmation data. |
| `Payments.Started` | domain | Settlement attempt started from accepted payable or top-up amount. | Amount and currency must match source contract. |
| `Payments.Completed` | integration | Payment ledger entry is completed and required Ledger policy is satisfied. | Club Account, Order and notifications may consume this fact. |
| `Payments.Failed` | integration | Payment attempt failed before completion. | No balance credit, paid order state or machine dispatch. |
| `Payments.Cancelled` | integration | Payment was cancelled before completed settlement. | Consumers release or close only through their own policy. |
| `Payments.Expired` | integration | Payment session or intent expired before completed settlement. | Late success requires reconciliation, not automatic fulfillment. |
| `Payments.RefundRequested` | domain | Refund workflow accepted. | No refund completion yet. |
| `Payments.RefundCompleted` | integration | Refund payment ledger entry is completed and Ledger refund policy is satisfied. | Order, Club Account and CRM may react idempotently. |
| `Payments.ManualReviewRequested` | domain | Payment outcome is ambiguous or risky. | Downstream financial side effects are blocked. |
| `Payments.Reconciled` | audit | Reconciliation result accepted. | May unblock completion only through Payment/Ledger policy. |

`Payments.Completed` emission preconditions:

1. PaymentIntent is known.
2. PaymentSession or internal method outcome is accepted.
3. PaymentOperation exists.
4. PaymentRegistry registered provider or internal references.
5. PaymentLedgerEntry is `completed`.
6. Required Ledger entries or approved Ledger policy references exist.
7. Amount, currency, purpose and method lines match the accepted source contract.
8. Event idempotency key is stable.

Required `Payments.Completed` payload fields:

| Field | Rule |
|---|---|
| `payment_completed_id` | Stable completion fact ID. |
| `payment_intent_id` | Required. |
| `payment_session_id` | Required when a session exists. |
| `payment_operation_id` | Required. |
| `payment_ledger_entry_id` | Required. |
| `ledger_entry_ids` | Required for Ledger-backed completion. |
| `purpose` | `club_account_top_up`, `product_purchase` or approved future purpose. |
| `customer_id` | Required when payment is customer-linked. |
| `amount` | Completed amount. |
| `currency` | MVP default `RUB`. |
| `method_lines` | Payment method-line attribution. |
| `order_id` | Required for `product_purchase`. |
| `club_account_id` | Required for `club_account_top_up`. |
| `top_up_id` | Required when top-up workflow exists. |
| `correlation_id` | Required. |
| `causation_id` | Required. |
| `idempotency_key` | Required. |

Forbidden Payment payload fields:

- raw card number, CVV or PIN;
- provider secret keys and authorization headers;
- raw webhook signatures;
- raw provider payloads;
- unmasked provider customer references;
- unnecessary phone, email or Telegram personal data.

---

# 6. Club Account Events

Owner:

```text
Club Account Runtime
```

Club Account events describe customer prepaid account facts. They do not replace Ledger and must not be emitted from raw provider success.

Canonical Club Account event catalog:

| Event | Category | Produced after | Notes |
|---|---|---|---|
| `ClubAccounts.Created` | domain | ClubAccount aggregate created. | No balance effect. |
| `ClubAccounts.Activated` | domain | Account became active. | No automatic bonus or discount. |
| `ClubAccounts.TopUpRequested` | domain | Customer or policy requested top-up. | No balance effect. |
| `ClubAccounts.TopUpCredited` | integration | One immutable `top_up_credit` transaction posted. | Requires accepted `Payments.Completed`. |
| `ClubAccounts.TopUpFailed` | domain | Top-up workflow failed or expired. | No balance effect. |
| `ClubAccounts.PurchaseReserved` | integration | Available balance reserved for an accepted purchase. | Amount equals accepted payable after discounts/bonus. |
| `ClubAccounts.PurchaseCaptured` | integration | Reserved balance captured for a completed purchase. | Uses reservation and Order references. |
| `ClubAccounts.ReservationReleased` | integration | Reservation released after failure, cancellation or expiration. | Must not duplicate release. |
| `ClubAccounts.RefundCredited` | integration | Refund credit transaction posted. | Requires refund/payment/Ledger policy. |
| `ClubAccounts.BalanceChanged` | domain | Balance projection changed after a posted transaction. | Projection event only; not a financial side-effect trigger. |
| `ClubAccounts.BalanceDroppedBelowMinimum` | domain | Available balance crossed below policy threshold. | May trigger notification request. |
| `ClubAccounts.Suspended` | audit | Account suspended. | Requires actor and reason. |
| `ClubAccounts.Restored` | audit | Account restored from suspension. | Requires actor and reason. |
| `ClubAccounts.Closed` | audit | Account closed. | No silent reopen. |
| `ClubAccounts.ManualReviewRequested` | audit | Account, payment, amount or duplicate state is unsafe. | Blocks automatic side effects. |

Club Account event rules:

- every balance-changing event references one immutable `ClubAccountTransaction`;
- posted transactions are append-only;
- corrections use new compensating transactions;
- `ClubAccounts.TopUpCredited` is emitted only after Club Account accepts `Payments.Completed` for `purpose = club_account_top_up`;
- duplicate `Payments.Completed` delivery must not post duplicate credits;
- `ClubAccounts.BalanceChanged` must not be consumed as proof of payment, refund or purchase completion;
- low balance is a recommendation signal, not a spending block or discount rule.

Required balance event payload fields:

| Field | Rule |
|---|---|
| `club_account_id` | Required. |
| `customer_id` | Required. |
| `club_account_transaction_id` | Required for posted transaction facts. |
| `transaction_type` | Required for balance movement facts. |
| `amount` | Required for monetary movement. |
| `currency` | Required for monetary movement. |
| `available_delta` | Required for posted monetary movement. |
| `reserved_delta` | Required for posted monetary movement. |
| `available_balance_after` | Required for customer-safe projections. |
| `reserved_balance_after` | Required for customer-safe projections. |
| `payment_completed_id` | Required for top-up credit from Payment. |
| `payment_ledger_entry_id` | Required when money changes from Payment facts. |
| `ledger_entry_ids` | Required for Ledger-backed monetary facts. |
| `order_id` | Required for purchase reservation, capture, release or refund tied to order. |
| `reservation_id` | Required for reservation, capture and release. |
| `reason_code` | Required for failed, manual, refund or support facts. |
| `correlation_id` | Required. |
| `causation_id` | Required. |
| `idempotency_key` | Required. |

---

# 7. Order Events

Owner:

```text
Order Runtime
```

Order events describe accepted purchase lifecycle transitions and checkpoints. Older Order architecture documents use aliases such as `OrderCreated`, `PaymentConfirmed`, `OrderPaid` and `OrderCancelled`. New platform contracts use `Orders.Created`, `Orders.PaymentConfirmed` and `Orders.Cancelled`.

Canonical Order event catalog:

| Event | Category | Produced after | Legacy alias |
|---|---|---|---|
| `Orders.Created` | domain | none -> `Draft`. | `OrderCreated` |
| `Orders.Configured` | domain | `Draft -> Configured`. | `OrderConfigured` |
| `Orders.Validated` | domain | Order validation checkpoint accepted. | `OrderValidated` |
| `Orders.PriceCalculated` | domain | Pricing snapshot accepted. | `PriceCalculated` |
| `Orders.DiscountApplied` | domain | Discount and payable amount accepted. | `DiscountApplied` |
| `Orders.BonusReserved` | domain | Bonus reservation reference accepted. | `BonusReserved` |
| `Orders.PaymentStarted` | domain | Payment may start from accepted payable amount. | `PaymentStarted` |
| `Orders.PaymentConfirmed` | integration | `Payments.Completed` accepted for the order. | `PaymentConfirmed`, `OrderPaid` |
| `Orders.Queued` | integration | Machine fulfillment queue entry accepted. | `OrderQueued` |
| `Orders.PreparationStarted` | integration | Machine preparation fact accepted by Order. | `PreparationStarted` |
| `Orders.DispensingStarted` | integration | Machine dispensing fact accepted by Order. | `DispensingStarted` |
| `Orders.Completed` | integration | Product delivery or approved fulfillment closure accepted. | `OrderCompleted` |
| `Orders.Cancelled` | integration | Unpaid active order stopped. | `OrderCancelled` |
| `Orders.Expired` | integration | Unpaid active order expired. | `OrderExpired` |
| `Orders.RefundStarted` | integration | Paid order requires compensation. | `RefundStarted` |
| `Orders.RefundCompleted` | integration | Refund completion accepted and order closed as refunded. | `RefundCompleted` |

MVP Vertical Slice 003 runtime aliases:

| Runtime event | Canonical event | Produced after |
|---|---|---|
| `OrderCreated` | `Orders.Created` | Customer-owned Order is accepted and moved to `PAYMENT_PENDING`. |
| `OrderPaid` | `Orders.PaymentConfirmed` | Internal payment confirmation moves Order to `PAID`. |
| `OrderCancelled` | `Orders.Cancelled` | Unpaid active Order is cancelled. |

Order event rules:

- every accepted Order transition emits exactly one Order business event;
- rejected transitions are audited but do not emit lifecycle events;
- `Orders.PaymentConfirmed` requires an accepted Payment fact and Ledger-backed policy;
- only paid orders can enter fulfillment events;
- machine-originated facts do not mutate Order directly; Order emits its own events after accepting those facts;
- terminal states remain immutable;
- snapshots are historical truth and must be referenced instead of live catalog data.

Required common Order payload fields:

| Field | Rule |
|---|---|
| `order_id` | Required. |
| `order_number` | Required when assigned. |
| `customer_id` | Required when known and allowed. |
| `channel` | Required. |
| `from_state` | Required except for creation. |
| `to_state` | Required. |
| `state_version` | Required aggregate sequence. |
| `state_reason` | Required. |
| `configuration_snapshot_id` | Required after configuration. |
| `pricing_snapshot_id` | Required after pricing. |
| `discount_snapshot_id` | Required after discount. |
| `payment_intent_id` | Required after payment start when known. |
| `payment_completed_id` | Required for `Orders.PaymentConfirmed`. |
| `payment_ledger_entry_id` | Required for `Orders.PaymentConfirmed`. |
| `ledger_entry_ids` | Required for Ledger-backed paid/refund facts. |
| `machine_id` | Required when fulfillment is machine-based. |
| `machine_operation_id` | Required after machine operation is accepted. |
| `gross_amount` | Required after pricing. |
| `discount_amount` | Required after discount. |
| `payable_amount` | Required before payment and after payment/refund facts. |
| `currency` | Required for financial events. |
| `correlation_id` | Required. |
| `causation_id` | Required. |
| `idempotency_key` | Required. |

---

# 8. Machine Events

Owner:

```text
Machine Runtime
```

Machine events describe equipment facts, telemetry facts, command acceptance facts and physical outcomes. They do not decide payment, order paid state, refunds, bonuses or customer compensation.

Canonical Machine event families:

| Event family | Events |
|---|---|
| Lifecycle and readiness | `Machines.Registered`, `Machines.Activated`, `Machines.LocationAssigned`, `Machines.ConfigurationChanged`, `Machines.CapabilitiesChanged`, `Machines.MachineConnected`, `Machines.MachineDisconnected`, `Machines.MachineStarted`, `Machines.MachineReady`, `Machines.StatusChanged`, `Machines.MachineBusy`, `Machines.MachineError`, `Machines.MachineMaintenanceRequired` |
| Inventory and hardware | `Machines.InventoryChanged`, `Machines.InventoryLow`, `Machines.IngredientLow`, `Machines.CupMagazineLow`, `Machines.TemperatureWarning`, `Machines.ComponentFailure`, `Machines.CleaningRequired`, `Machines.TelemetryReported` |
| Command and operation | `Machines.CommandReceived`, `Machines.CommandAccepted`, `Machines.CommandRejected`, `Machines.OrderReceived`, `Machines.OrderAccepted`, `Machines.PreparationStarted`, `Machines.PreparationCompleted`, `Machines.PreparationFailed`, `Machines.ProductDispensed`, `Machines.ProductReady`, `Machines.ProductTaken`, `Machines.ProductNotTaken`, `Machines.OperationCompleted`, `Machines.OperationFailed`, `Machines.DispensingFailed`, `Machines.ErrorReported` |

Machine event rules:

- authenticated machine, adapter, operator or system source is required;
- every machine event includes `machine_id`;
- command-related events include `machine_operation_id` and `command_id`;
- order execution events reference paid dispatch context but do not prove payment by themselves;
- `Machines.MachineReady` does not mean an order is paid;
- `Machines.ProductDispensed` does not mark an Order complete until Order accepts the fact;
- replay must never resend machine commands or repeat preparation;
- stale telemetry cannot prove readiness.

Required Machine payload fields:

| Field | Rule |
|---|---|
| `event_type` | Machine-local PascalCase event type. |
| `machine_id` | Required. |
| `severity` | `info`, `warning`, `error` or `critical`. |
| `source` | Required source object. |
| `machine_operation_id` | Required for command and order execution facts. |
| `command_id` | Required for command-related facts. |
| `dispatch_id` | Required when order execution context exists. |
| `order_id` | Required when tied to an order. |
| `order_item_id` | Required when tied to an order item. |
| `recipe_id` | Required for preparation and dispensing facts. |
| `status` | Required for status and readiness facts. |
| `reason_code` | Required for warning, error, rejection, manual and support facts. |
| `error_code` | Required for error facts. |
| `telemetry_ref` | Required when event is derived from telemetry. |

---

# 9. Customer Events

Owner:

```text
Customer Runtime
```

Customer events describe identity, profile, consent, Club Timofey, trust, referral and activity facts. Customer events must minimize personal data and must never contain raw Telegram init data, raw phone, raw email, tokens or payment credentials.

Canonical Customer event catalog:

| Event | Category | Produced after |
|---|---|---|
| `Customers.Created` | domain | Customer aggregate created. |
| `Customers.ProfileUpdated` | domain | Safe profile update accepted. |
| `Customers.IdentityLinked` | domain | External alias linked to `customer_id`. |
| `Customers.TelegramIdentityLinked` | integration | Telegram user ID linked as external alias. |
| `Customers.ContactPointVerified` | domain | Phone, email or channel route verified. |
| `Customers.ConsentGranted` | integration | Consent status became granted. |
| `Customers.ConsentRevoked` | integration | Consent status became revoked. |
| `Customers.NotificationPreferenceChanged` | integration | Notification preference changed. |
| `Customers.ClubJoined` | integration | Club Timofey membership became active. |
| `Customers.ClubStatusChanged` | domain | Club membership status changed. |
| `Customers.TrustedStatusChanged` | domain | Trusted customer status changed. |
| `Customers.ReferralLinked` | domain | Referral relationship linked. |
| `Customers.ReferralQualified` | integration | Referral qualification accepted. |
| `Customers.ActivityRecorded` | domain | Activity projection appended. |
| `Customers.Merged` | audit | Duplicate customer merge accepted. |
| `Customers.Suspended` | audit | Customer suspended. |
| `Customers.Closed` | audit | Customer closed for new actions. |

Customer event rules:

- `customer_id` is the platform identity;
- Telegram ID, phone, email, provider customer ID and usernames are aliases only;
- consent facts must be versioned and auditable;
- marketing and transactional communication consent remain separate;
- referral qualification does not issue a reward by itself;
- Club membership does not equal bonus balance or Club Account balance;
- trusted status is not an authorization role.

Required Customer payload fields:

| Field | Rule |
|---|---|
| `customer_id` | Required for customer-linked facts. |
| `source_channel` | Required when source is customer channel. |
| `identity_link_id` | Required for identity-link facts. |
| `identity_provider` | Required for identity-link facts. |
| `contact_id` | Required for contact verification facts. |
| `consent_type` | Required for consent facts. |
| `consent_status` | Required for consent facts. |
| `policy_version` | Required for consent and club terms facts. |
| `club_membership_id` | Required for Club Timofey facts. |
| `referral_id` | Required for referral facts. |
| `from_state` | Required for state changes. |
| `to_state` | Required for state changes. |
| `reason_code` | Required for suspension, closure, merge and manual facts. |
| `correlation_id` | Required. |
| `causation_id` | Required. |
| `idempotency_key` | Required for side-effecting facts. |

---

# 10. Telegram Notification Triggers

Telegram notifications are produced through Notification Runtime. Telegram Bot is a channel adapter and must not consume domain events directly to mutate business state.

Approved flow:

```text
Source domain event
-> Notification Runtime evaluates consent, preference, template, throttling and dedupe policy
-> Notifications.Requested
-> Telegram channel adapter sends message
-> Notifications.Sent / Notifications.Failed / Notifications.Suppressed
```

Initial Telegram trigger map:

| Source event | Notification intent | Consent and policy |
|---|---|---|
| `Customers.TelegramIdentityLinked` | Welcome or Mini App launch prompt when needed. | Transactional or onboarding policy; no marketing copy unless marketing consent exists. |
| `Customers.ConsentRevoked` | Stop restricted notification streams and optionally confirm revocation. | Must respect the revoked purpose immediately after propagation policy. |
| `ClubAccounts.BalanceDroppedBelowMinimum` | Recommend top-up. | Account/service policy, preferences and throttling. |
| `ClubAccounts.TopUpCredited` | Confirm credited top-up. | Transactional. |
| `Payments.Completed` | Confirm payment when customer-visible and not superseded by top-up/order-specific message. | Transactional; dedupe with source-specific message. |
| `Payments.Failed` | Offer retry or help. | Transactional. |
| `Payments.Expired` | Offer a new payment session when policy allows. | Transactional. |
| `Orders.PaymentConfirmed` | Confirm order paid or show preparation status. | Transactional. |
| `Orders.Queued` | Show accepted fulfillment state when useful. | Transactional and throttled. |
| `Orders.PreparationStarted` | Show preparation started when product flow needs it. | Transactional and throttled. |
| `Machines.ProductReady` | Tell customer the product is ready for pickup when order context is resolved. | Transactional; requires safe order/customer correlation. |
| `Orders.Completed` | Confirm purchase completion, receipt/support path and bonus follow-up. | Transactional. |
| `Orders.Cancelled` or `Orders.Expired` | Explain recovery path. | Transactional. |
| `Orders.RefundCompleted` or `Payments.RefundCompleted` | Confirm refund completion when customer-visible. | Transactional. |
| `Bonus.Accrued` | Notify about bonus rights. | Loyalty/transactional policy; marketing if promotional copy is used. |
| `Promotions.RewardIssued` | Promotion reward notification. | Marketing or campaign-specific consent required unless legally transactional. |
| `Machines.ErrorReported` or `Machines.PreparationFailed` | Customer recovery or support message only when tied to the customer's paid order. | Transactional; avoid raw machine diagnostics. |

Telegram notification rules:

- Notification Runtime, not Telegram Bot, decides whether to send;
- source facts are not rolled back if Telegram delivery fails;
- duplicate source events must not create duplicate messages;
- replay mode suppresses customer messages unless explicitly running an approved dry-run;
- customer messages use safe references, not internal provider, Ledger or firmware data;
- marketing messages require marketing consent;
- transactional messages remain separate from marketing communication;
- all notification decisions produce `Notifications.Requested`, `Notifications.Sent`, `Notifications.Failed` or `Notifications.Suppressed` as appropriate.

Recommended notification idempotency key:

```text
telegram_notification:{customer_id}:{source_event_id}:{notification_intent}:{channel}
```

---

# 11. Idempotency Requirements

Domain events use at-least-once delivery with idempotent producers and consumers.

Producer idempotency rules:

- one accepted domain fact produces one canonical event;
- publication retries reuse the same `event_id`;
- transactional outbox or equivalent durable publish pattern is required before production event delivery;
- duplicate commands with the same idempotency key and same semantic payload return the existing result;
- duplicate commands with the same idempotency key and conflicting semantic payload are rejected and audited.

Consumer idempotency rules:

- deduplicate by `event_id`;
- deduplicate financial side effects by domain keys such as `payment_completed_id`, `payment_ledger_entry_id`, `club_account_transaction_id`, `order_id + state_version`, `machine_operation_id`, `refund_id` and source notification keys;
- store processed event references before or atomically with side effects where possible;
- unsupported event versions are rejected, skipped or transformed only by documented consumer policy;
- replay suppresses payments, refunds, Club Account credits/debits, machine commands and customer notifications.

Recommended idempotency key patterns:

| Scope | Pattern |
|---|---|
| Payment completion event | `payments.completed:{payment_intent_id}:{payment_ledger_entry_id}` |
| Club Account top-up credit | `club_top_up_credit:{club_account_id}:{payment_completed_id}` |
| Club Account purchase reservation | `club_purchase_reserve:{club_account_id}:{order_id}:{amount}:{currency}` |
| Order event | `orders.event:{order_id}:{state_version}:{event_name}` |
| Machine command fact | `machine_event:{machine_operation_id}:{command_id}:{event_type}` |
| Customer identity link | `customer_identity_link:{customer_id}:{provider}:{external_subject_hash}` |
| Consent change | `customer_consent:{customer_id}:{consent_type}:{policy_version}:{decision_id}` |
| Telegram notification | `telegram_notification:{customer_id}:{source_event_id}:{notification_intent}:{channel}` |

Idempotency records must not contain secrets, raw provider payloads, raw Telegram init data, raw phone, raw email or unmasked personal data.

---

# 12. Audit Requirements

Audit is mandatory for:

- payment completion, failure, refund, reconciliation and manual review;
- Club Account top-up credit, reservation, capture, release, refund credit, low-balance episode and manual adjustment;
- Order lifecycle transitions, rejected transitions, cancellation, expiration, refund and support closure;
- Machine command receipt, command acceptance, command rejection, preparation start, preparation failure, product dispense, maintenance and operator recovery;
- Customer identity link, consent change, Club membership, referral qualification, suspension, merge and closure;
- notification request, suppression, send failure, delivery confirmation and manual redrive;
- replay, dead-letter redrive and manual correction.

Required audit fields:

| Field | Rule |
|---|---|
| `audit_event_id` | Stable audit record ID. |
| `event_id` | Event reference when event-backed. |
| `event_name` | Required when event-backed. |
| `event_version` | Required when event-backed. |
| `source_runtime_id` | Producing Runtime. |
| `actor_type` | `customer`, `operator`, `system`, `provider`, `machine`, `adapter`, `support` or `migration`. |
| `actor_id` | Safe actor reference when available. |
| `action` | Accepted or rejected action. |
| `target_type` | Aggregate, transaction, operation, notification or policy target. |
| `target_id` | Stable target ID. |
| `from_state` | Required for state changes. |
| `to_state` | Required for state changes. |
| `amount` | Required for monetary facts. |
| `currency` | Required for monetary facts. |
| `reason_code` | Required for rejection, manual review, operator and support actions. |
| `correlation_id` | Required. |
| `causation_id` | Required. |
| `idempotency_key` | Required for side-effecting facts. |
| `occurred_at` | UTC time the fact occurred. |
| `recorded_at` | UTC audit record time. |

Audit rules:

- audit records are append-only;
- manual correction creates new explicit correction records and events where needed;
- audit logs must not contain provider secrets, raw card data, raw webhook signatures, raw Telegram init data, bot tokens, raw firmware credentials or unnecessary personal data;
- operator and support actions require actor, role and reason;
- dead-letter redrive and replay require authorization and audit;
- audit must reconstruct business timeline across Payment, Club Account, Order, Machine, Customer and Notification without relying on UI state.

---

# 13. Readiness Criteria

This contract is complete when:

- event naming rules are documented;
- event envelope structure is documented;
- domain event ownership is documented;
- Payment events are documented;
- Club Account events are documented;
- Order events are documented;
- Machine events are documented;
- Customer events are documented;
- Telegram notification triggers are documented;
- idempotency and audit requirements are documented;
- `ENGINEERING_JOURNAL.md` is updated;
- `docs/architecture/PROJECT_DECISIONS.md` is updated;
- `docs/tasks/TASK_INDEX.md` is updated;
- documentation remains documentation-only;
- `git diff --check` passes;
- no build is run because this task is documentation-only.

Future implementation readiness additionally requires:

- formal Event Registry entries for every active event name and version;
- JSON Schema or equivalent envelope and payload schemas;
- producer and consumer permission matrix;
- transactional outbox policy;
- dead-letter and redrive workflow;
- replay controls with side-effect suppression;
- contract tests for envelope validation, duplicate handling and unsupported versions;
- production review before real payment, Telegram and machine event delivery.

---

# 14. Documentation Scope

This document is documentation-only.

It does not introduce application code, frontend code, backend runtime code, Telegram bot code, provider calls, webhook handlers, database migrations, Prisma schema changes, environment variables, generated build output, event bus infrastructure, notification templates, payment handlers, Club Account transaction implementation, Order transition implementation or Machine dispatch behavior.
