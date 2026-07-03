# Order Platform

Document code: ARCH-ORDER-001
Version: 0.2
Status: Draft
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-02
Last updated: 2026-07-03

Related documents:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `docs/architecture/ARCHITECTURE_BASELINE_1_0.md`
- `docs/architecture/CONFIGURATION_ENGINE.md`
- `docs/architecture/PRICING_ENGINE.md`
- `docs/architecture/DISCOUNT_ENGINE.md`
- `docs/architecture/BONUS_ENGINE.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/LEDGER.md`
- `docs/architecture/WALLET.md`
- `docs/architecture/EVENT_PLATFORM.md`
- `docs/architecture/CHECKOUT.md`
- `docs/tasks/EPIC-230_ORDER_PLATFORM.md`
- `docs/tasks/ORDER-001_ORDER_DOMAIN.md`
- `docs/tasks/ORDER-003_ORDER_STATE_MACHINE.md`

---

# 1. Purpose

Order Platform defines the business aggregate that represents a customer's accepted purchase intent and the complete historical truth needed to fulfill, audit, support and analyze that purchase.

Core rules:

- Order is the business aggregate.
- Order owns snapshots.
- Order never recalculates historical prices.
- Order never references mutable catalog data as historical truth.
- Order publishes business events after accepted lifecycle changes.

The Order aggregate connects Product, Configuration, Pricing, Discount, Bonus, Payment, Machine, Ledger, CRM, Notification and Analytics without making any one of those engines own the whole purchase flow.

---

# 2. Architecture Role

Order Platform sits between checkout orchestration and fulfillment.

Architecture position:

```text
Product selection
->
Configuration Engine
->
Pricing Engine
->
Discount Engine
->
Bonus reservation when used
->
Checkout acceptance
->
Order aggregate with snapshots
->
Payment Engine
->
Fulfillment and Machine Platform
->
Completion, cancellation or support recovery
```

Order owns:

- order identity;
- order lifecycle;
- order items;
- immutable configuration snapshots;
- immutable pricing snapshots;
- immutable discount snapshots;
- bonus reservation references;
- payment binding references;
- fulfillment state;
- machine interaction references;
- audit metadata;
- order events.

Order does not own:

- mutable product catalog;
- configuration validation rules;
- price calculation rules;
- discount eligibility and stacking;
- bonus balance or bonus lifecycle;
- wallet balance;
- payment provider integration;
- Ledger financial truth;
- machine hardware commands;
- notification delivery;
- CRM screens.

Order consumes accepted results from engines and records them as snapshots. It does not import engine internals.

---

# 3. Order State Machine

The canonical Order lifecycle is documented in detail in `docs/tasks/ORDER-003_ORDER_STATE_MACHINE.md`.

Canonical successful flow:

```text
Draft
->
Configured
->
Priced
->
Discounted
->
BonusReserved
->
PaymentPending
->
Paid
->
Queued
->
Preparing
->
Dispensing
->
Completed
```

If no bonuses are used, `Discounted` can move directly to `PaymentPending`.

Failure and compensation flow:

```text
Draft / Configured / Priced / Discounted / BonusReserved / PaymentPending
->
Cancelled or Expired

Paid / Queued / Preparing / Dispensing
->
RefundPending
->
Refunded
```

Lifecycle rules:

- `Draft` is the initial state for an accepted checkout intent inside the Order aggregate.
- `Configured` means the product configuration snapshot is accepted.
- `Priced` means the Pricing Engine result is accepted as a pricing snapshot.
- `Discounted` means the Discount Engine result is accepted, including zero-discount decisions.
- `BonusReserved` means Bonus Engine reserved bonus rights for this order.
- `PaymentPending` means settlement may start from the accepted payable amount.
- `Paid` means Payment completed according to Payment Engine and Ledger policy.
- `Queued` means Machine Platform accepted the fulfillment queue request.
- `Preparing` means Machine Platform started preparation.
- `Dispensing` means the machine started dispensing the purchased product.
- `Completed` means the product was dispensed or otherwise fulfilled by approved business policy.
- `Cancelled` means the unpaid order was intentionally stopped and temporary reservations were released.
- `RefundPending` means captured money must be compensated before the order can close.
- `Refunded` means the captured payment was fully compensated through Payment, Wallet and Ledger policy.
- `Expired` means an unpaid order exceeded its allowed checkout, reservation or payment window.
- terminal states are immutable.

---

# 4. Order States

| State | Meaning | Terminal |
|---|---|---|
| `Draft` | Order aggregate exists as an accepted checkout/order intent, but no final configuration snapshot is accepted yet. | No |
| `Configured` | Product and option configuration snapshot is accepted. | No |
| `Priced` | Gross pricing snapshot is accepted. | No |
| `Discounted` | Discount snapshot and final payable amount are accepted. | No |
| `BonusReserved` | Bonus reservation reference is accepted when the customer uses bonuses. | No |
| `PaymentPending` | Payment Engine can create or continue settlement from the accepted payable amount. | No |
| `Paid` | Payment completed and is correlated with Ledger-backed financial facts. | No |
| `Queued` | Machine Platform accepted the fulfillment queue request. | No |
| `Preparing` | Machine preparation started. | No |
| `Dispensing` | Machine dispensing started. | No |
| `Completed` | Order was successfully fulfilled and closed. | Yes |
| `Cancelled` | Order was cancelled before captured payment existed. | Yes |
| `RefundPending` | Refund compensation is required for a captured payment. | No |
| `Refunded` | Captured payment was compensated and the order is closed. | Yes |
| `Expired` | Order expired before captured payment existed. | Yes |

Order state is not payment state, wallet state, bonus state, machine state or ledger state. It is the business purchase lifecycle state.

Canonical state labels use PascalCase in architecture documentation. Future persisted enum names may use snake_case equivalents, but the meaning and transition rules must remain identical.

Allowed transitions are strict:

| From | To | Business reason | Event |
|---|---|---|---|
| none | `Draft` | Create one auditable order intent from checkout acceptance. | `OrderDraftCreated` |
| `Draft` | `Configured` | Accept validated product configuration snapshot. | `OrderConfigured` |
| `Configured` | `Priced` | Accept gross price snapshot from Pricing Engine. | `OrderPriced` |
| `Priced` | `Discounted` | Accept discount result and final payable amount. | `OrderDiscounted` |
| `Discounted` | `BonusReserved` | Hold selected bonus rights before payment. | `OrderBonusReserved` |
| `Discounted` | `PaymentPending` | Start payment when no bonus reservation is required. | `OrderPaymentPending` |
| `BonusReserved` | `PaymentPending` | Start payment after bonus reservation is accepted. | `OrderPaymentPending` |
| `PaymentPending` | `Paid` | Confirm payment completion under Payment and Ledger policy. | `OrderPaid` |
| `Paid` | `Queued` | Request and accept machine fulfillment queue entry. | `OrderQueued` |
| `Queued` | `Preparing` | Machine confirms preparation has started. | `OrderPreparing` |
| `Preparing` | `Dispensing` | Machine confirms dispensing has started. | `OrderDispensing` |
| `Dispensing` | `Completed` | Machine or approved fulfillment policy confirms product delivery. | `OrderCompleted` |
| unpaid active state | `Cancelled` | Customer, system or operator stops order before captured payment. | `OrderCancelled` |
| unpaid active state | `Expired` | Checkout, reservation or payment window expires before captured payment. | `OrderExpired` |
| paid active state | `RefundPending` | Paid order cannot be fulfilled or must be compensated. | `OrderRefundPending` |
| `RefundPending` | `Refunded` | Refund completed and Ledger-backed compensation exists. | `OrderRefunded` |

Unpaid active states are `Draft`, `Configured`, `Priced`, `Discounted`, `BonusReserved` and `PaymentPending` when payment reconciliation confirms no captured payment exists.

Paid active states are `Paid`, `Queued`, `Preparing` and `Dispensing`.

Invalid transitions are rejected by the Order domain, audited as rejected commands when needed, and must not publish lifecycle events. Terminal states `Completed`, `Cancelled`, `Refunded` and `Expired` never transition to another Order state. Post-completion goodwill or support refund is a new compensating Refund or Support workflow that references the immutable completed order; it does not mutate `Completed` to `RefundPending`.

---

# 5. Order Aggregate

Minimal aggregate model:

```json
{
  "order_id": "order_01JZ0000000000000000000000",
  "order_number": "UTM-20260702-000001",
  "customer_id": "customer_01JZ0000000000000000000000",
  "channel": "miniapp",
  "machine_id": "machine_01JZ0000000000000000000000",
  "status": "PaymentPending",
  "currency": "RUB",
  "items": [],
  "configuration_snapshot": {},
  "pricing_snapshot": {},
  "discount_snapshot": {},
  "bonus_reservation": {},
  "payment_binding": {},
  "fulfillment": {},
  "audit": {},
  "created_at": "2026-07-02T00:00:00Z",
  "updated_at": "2026-07-02T00:00:00Z"
}
```

Aggregate invariants:

- one order has one stable `order_id`;
- every order has at least one item before payment;
- every paid order has accepted configuration, pricing and payment references;
- every historical order reads from snapshots, not live catalog data;
- order amount is derived from accepted pricing and discount snapshots, not recalculated;
- order lifecycle transitions must be validated by the Order domain;
- external domains can only influence Order through approved commands or events;
- corrections are new operations and never silent edits to historical snapshots.

---

# 6. Order Item

Order Item is the ordered unit inside the aggregate.

Minimal model:

```json
{
  "order_item_id": "order_item_01JZ0000000000000000000000",
  "line_number": 1,
  "product_id": "product_soft_ice_vanilla_cup",
  "product_snapshot": {
    "product_id": "product_soft_ice_vanilla_cup",
    "product_type": "soft_ice",
    "display_name": "Vanilla soft ice cream in a cup",
    "recipe_reference_id": "recipe_soft_ice_vanilla_cup",
    "media_reference_id": "media_soft_ice_vanilla_base"
  },
  "quantity": 1,
  "configuration_snapshot_id": "configuration_snapshot_01JZ0000000000000000000000",
  "pricing_snapshot_id": "pricing_snapshot_01JZ0000000000000000000000",
  "fulfillment_status": "not_started"
}
```

Rules:

- `product_id` is a semantic reference used for correlation, not the historical source of mutable product data.
- `product_snapshot` stores the product facts accepted at order time.
- item quantity is explicit even when MVP supports one item.
- item-level fulfillment status may differ from order status in future multi-item flows.
- item data must not include payment credentials, provider secrets or UI component state.

---

# 7. Configuration Snapshot

Configuration snapshot records the accepted product configuration at order time.

Example:

```json
{
  "configuration_snapshot_id": "configuration_snapshot_01JZ0000000000000000000000",
  "configuration_result_id": "configuration_result_01JZ0000000000000000000000",
  "product_id": "product_soft_ice_vanilla_cup",
  "flavor_id": "flavor_vanilla",
  "size_id": "size_default_cup",
  "syrup_id": "syrup_strawberry",
  "topping_id": "topping_oreo",
  "extras": [],
  "recipe_id": "recipe_soft_ice_vanilla_strawberry_oreo",
  "media_id": "media_soft_ice_vanilla_strawberry_oreo",
  "configuration_version": 1,
  "captured_at": "2026-07-02T00:00:00Z"
}
```

Rules:

- Order stores the accepted configuration result as a snapshot.
- Order must not ask Configuration Engine to reinterpret a historical order.
- Configuration snapshot stores semantic IDs and resolved facts needed for fulfillment and support.
- If catalog, recipe or media records change later, historical order snapshots remain unchanged.
- invalid or incomplete configuration cannot enter `Priced` or `PaymentPending`.

---

# 8. Pricing Snapshot

Pricing snapshot records the accepted financial calculation before discounts and payment.

Example:

```json
{
  "pricing_snapshot_id": "pricing_snapshot_01JZ0000000000000000000000",
  "pricing_result_id": "pricing_result_01JZ0000000000000000000000",
  "pricing_version": 1,
  "currency": "RUB",
  "gross_amount": 130,
  "line_items": [
    {
      "order_item_id": "order_item_01JZ0000000000000000000000",
      "base_amount": 130,
      "option_amount": 0,
      "gross_amount": 130
    }
  ],
  "bonus_allowed": true,
  "bonus_redemption_limit": 104,
  "bonus_nominal_rate": 1,
  "captured_at": "2026-07-02T00:00:00Z"
}
```

Rules:

- Pricing Engine calculates price; Order stores the pricing snapshot.
- Order never recalculates historical prices.
- Pricing snapshot must include currency, gross amount, rule version and line details required for audit.
- If pricing rules change later, historical pricing snapshots remain unchanged.
- Payment uses accepted payable amount from discount or pricing result, not live recalculation.

---

# 9. Discount Snapshot

Discount snapshot records accepted price reductions and final payable amount.

Example:

```json
{
  "discount_snapshot_id": "discount_snapshot_01JZ0000000000000000000000",
  "discount_result_id": "discount_result_01JZ0000000000000000000000",
  "gross_amount": 130,
  "currency": "RUB",
  "discount_lines": [
    {
      "discount_rule_id": "discount_rule_member_10",
      "discount_type": "membership",
      "rule_version": 1,
      "discount_amount": 13
    }
  ],
  "bonus_discount_amount": 20,
  "total_discount_amount": 33,
  "payable_amount": 97,
  "captured_at": "2026-07-02T00:00:00Z"
}
```

Rules:

- Discount Engine calculates discount effect; Order stores the accepted result.
- Discount snapshot is not Wallet balance and not received money.
- Bonus redemption is represented as a discount effect and references Bonus reservation or redemption IDs.
- final payable amount must be non-negative.
- payment amount must match the accepted payable amount and method split.
- discount corrections after payment require explicit refund, cancellation or support workflow.

---

# 10. Bonus Reservation

Bonus reservation records the correlation between Order and Bonus Engine when bonuses are used.

Example:

```json
{
  "bonus_reservation_id": "bonus_reservation_01JZ0000000000000000000000",
  "customer_id": "customer_01JZ0000000000000000000000",
  "reserved_bonus_amount": 20,
  "discount_amount": 20,
  "status": "reserved",
  "expires_at": "2026-07-02T00:15:00Z"
}
```

Rules:

- Bonus Engine owns bonus reservation lifecycle.
- Order stores reservation references and snapshot values needed for audit.
- bonuses are discount rights, not money.
- payment success can lead to bonus redemption through approved checkout/order flow.
- payment failure, order cancellation or expiration must release the reservation through Bonus Engine.
- Order must not mutate customer bonus projection directly.

---

# 11. Payment Binding

Payment binding connects Order to Payment Engine settlement.

Example:

```json
{
  "payment_id": "payment_01JZ0000000000000000000000",
  "payment_status": "created",
  "payable_amount": 97,
  "currency": "RUB",
  "method_lines": [
    {
      "method": "card",
      "amount": 97,
      "currency": "RUB",
      "provider": "yookassa"
    }
  ],
  "ledger_entry_ids": []
}
```

Rules:

- Payment Engine owns payment lifecycle and provider interaction.
- Order binds to payment by stable platform payment ID.
- payment amount must match accepted discount snapshot payable amount.
- Order does not store card data, payment credentials, provider secrets or raw webhook payloads.
- Order may react to `PaymentCompleted`, `PaymentFailed`, `PaymentCancelled` and refund events.
- paid state requires accepted payment completion according to Payment and Ledger policy.

---

# 12. Fulfillment

Fulfillment represents business delivery of the purchased product.

Fulfillment model:

```json
{
  "fulfillment_id": "fulfillment_01JZ0000000000000000000000",
  "fulfillment_type": "machine",
  "status": "not_started",
  "machine_id": "machine_01JZ0000000000000000000000",
  "recipe_id": "recipe_soft_ice_vanilla_strawberry_oreo",
  "requested_at": null,
  "started_at": null,
  "ready_at": null,
  "completed_at": null
}
```

Rules:

- paid order can request fulfillment when machine and business policy allow it.
- fulfillment status is part of Order, but hardware execution belongs to Machine Platform.
- order completion requires fulfillment success or an approved support closure policy.
- fulfillment failure must not edit payment history; it triggers recovery, retry, cancellation or refund workflow.
- fulfillment events must reference `order_id`, `order_item_id`, `machine_id` and correlation IDs when available.

---

# 13. Machine Interaction

Machine Platform owns machine state, readiness, commands, telemetry and preparation outcome.

Order interaction:

```text
OrderPaid
->
OrderQueued
->
MachinePreparationRequested
->
MachinePreparationStarted
->
MachineDispensingStarted
->
OrderCompleted
```

Rules:

- Order does not send low-level hardware commands directly.
- Order requests fulfillment through an approved Machine contract.
- Machine queue acceptance moves Order to `Queued`.
- Machine confirms accepted preparation intent before Order enters `Preparing`.
- Machine dispensing confirmation moves Order to `Dispensing`.
- Machine completion or approved fulfillment closure moves Order to `Completed`.
- machine timeout, ingredient shortage, hardware error or customer no-pickup must trigger retry, `RefundPending` or a future support workflow.
- UI must reflect Order and Machine events, not assumed timers.

---

# 14. Event Interaction

Order publishes events after accepted lifecycle changes.

Events follow `docs/architecture/EVENT_PLATFORM.md`.

Published events:

| Event | Type | Meaning |
|---|---|---|
| `OrderCreated` | integration | Backward-compatible aggregate creation signal; canonical state transition event is `OrderDraftCreated`. |
| `OrderDraftCreated` | domain | Order aggregate entered initial Draft state from checkout acceptance. |
| `OrderConfigured` | domain | Configuration snapshot was accepted. |
| `OrderPriced` | domain | Pricing snapshot was accepted. |
| `OrderDiscounted` | domain | Discount snapshot was accepted. |
| `OrderBonusReserved` | domain/integration | Bonus reservation reference was accepted for the order. |
| `OrderPaymentPending` | integration | Order is ready for payment settlement. |
| `OrderPaymentBound` | domain | Payment ID was bound to the order. |
| `OrderPaid` | integration | Order payment completed according to payment and ledger policy. |
| `OrderQueued` | integration | Machine fulfillment queue entry was accepted. |
| `OrderPreparing` | integration | Preparation started for the order. |
| `OrderDispensing` | integration | Product dispensing started. |
| `OrderCompleted` | integration | Order was fulfilled and closed. |
| `OrderCancelled` | integration | Order was cancelled. |
| `OrderExpired` | integration | Order expired before completion. |
| `OrderRefundPending` | integration | Refund compensation is required. |
| `OrderRefunded` | integration | Refund completed and order was closed as refunded. |
| `OrderBonusReservationRetryScheduled` | domain | Bonus reservation retry or reconciliation was scheduled without changing Order state. |
| `OrderPaymentRetryScheduled` | domain | Payment retry or reconciliation was scheduled without changing Order state. |
| `OrderPaymentReconciliationRequested` | domain/integration | Ambiguous payment outcome requires reconciliation before Order changes state. |
| `OrderMachineRetryScheduled` | domain | Machine retry or reconciliation was scheduled without changing Order state. |
| `OrderRefundRetryScheduled` | domain | Refund retry or reconciliation was scheduled without changing Order state. |
| `OrderTransitionRejected` | domain | Invalid transition command was rejected and audit policy requires publication. |

Minimal event payload:

```json
{
  "order_id": "order_01JZ0000000000000000000000",
  "order_number": "UTM-20260702-000001",
  "customer_id": "customer_01JZ0000000000000000000000",
  "channel": "miniapp",
  "from_state": "PaymentPending",
  "to_state": "Paid",
  "state_version": 7,
  "state_reason": "payment_completed",
  "gross_amount": 130,
  "discount_amount": 33,
  "payable_amount": 97,
  "currency": "RUB",
  "payment_id": "payment_01JZ0000000000000000000000",
  "machine_id": "machine_01JZ0000000000000000000000",
  "correlation_id": "checkout_01JZ0000000000000000000000",
  "causation_id": "evt_01JZ0000000000000000000000",
  "idempotency_key": "order_01JZ_payment_completed_payment_01JZ"
}
```

Rules:

- events are facts, not commands;
- event names use English PascalCase;
- payload fields use snake_case;
- payloads include stable IDs;
- payloads must not expose payment credentials, provider secrets or unnecessary personal data;
- consumers must be idempotent;
- Event Storage does not replace Order repository or Finance Ledger.

---

# 15. Audit

Order audit must preserve who or what caused each meaningful state change.

Audit fields:

- `created_at`;
- `updated_at`;
- `created_by`;
- `actor`;
- `channel`;
- `machine_id`;
- `correlation_id`;
- `causation_id`;
- `idempotency_key`;
- `state_transition_reason`;
- `snapshot_version`;
- `support_reason`;
- `operator_id` when applicable.

Audit rules:

- every lifecycle transition records actor and reason when available;
- operator changes require actor ID and reason;
- support corrections are compensating operations, not silent edits;
- historical snapshots remain visible for support and reporting;
- audit logs must not contain payment secrets or raw personal data beyond approved policy.

---

# 16. Idempotency

Order operations must be idempotent.

Idempotent operations:

- order creation from checkout intent;
- pricing snapshot attachment;
- discount snapshot attachment;
- bonus reservation binding;
- payment binding;
- payment success and failure handling;
- fulfillment request;
- machine result handling;
- cancellation;
- expiration;
- event publishing.

Rules:

- every command must include `command_id` or idempotency key;
- duplicate commands with the same payload return the existing result;
- duplicate commands with conflicting payload under the same key are rejected;
- external events are deduplicated by event ID and correlation IDs;
- order creation should be unique by checkout intent, customer, channel and accepted payload hash;
- retries must read current Order state before issuing side effects.

Recommended idempotency scope:

```text
order_id + operation_type + accepted_snapshot_hash
```

---

# 17. Retry Strategy

Order retry strategy coordinates recoverable cross-domain operations without duplicating side effects.

Retry rules:

- retry only idempotent operations automatically;
- use bounded exponential backoff for transient failures;
- do not create duplicate payments, duplicate bonus reservations or duplicate machine commands;
- check current domain state before retrying an external command;
- move repeated failures to support review or dead-letter handling;
- preserve original correlation and causation IDs;
- publish retry-relevant events only once per accepted state transition.

Retry examples:

| Failure | Retry behavior |
|---|---|
| Event publish timeout | Retry same event ID through Event Platform policy. |
| Payment callback delayed | Reconcile payment status before changing Order state. |
| Bonus release timeout | Retry release command with same idempotency key. |
| Machine command timeout | Read machine operation status before sending another command. |
| Fulfillment event delivery failure | Retry event consumption idempotently. |

Retry policy must favor reconciliation over duplicate settlement or duplicate product preparation.

---

# 18. Error Handling

Order errors are business facts or rejected commands, not hidden UI failures.

Error categories:

- validation error;
- pricing snapshot mismatch;
- discount snapshot mismatch;
- bonus reservation failure;
- payment binding failure;
- payment failure;
- payment ambiguity;
- machine unavailable;
- fulfillment failure;
- timeout or expiration;
- duplicate command conflict;
- security or authorization failure;
- support-required exception.

Handling rules:

- validation errors keep the order out of payment states;
- failed payment keeps the order in `PaymentPending` for an allowed retry or moves it to `Cancelled` or `Expired` only after payment reconciliation confirms no captured payment exists;
- ambiguous payment result requires reconciliation before retry;
- machine failure after payment schedules retry or moves order to `RefundPending` according to recovery policy;
- cancellation and refund are explicit flows;
- errors must publish events when they change business state;
- user-facing messages are handled by channel or Notification Engine, not hardcoded in Order domain.

---

# 19. Security

Order contains commercially sensitive and customer-linked data.

Security rules:

- customer can access only their own orders unless another role is authorized;
- operator access requires role-based permission, actor ID and reason;
- service calls require authenticated service identity;
- payment credentials, provider secrets, raw cards and webhook secrets are forbidden in Order records;
- events minimize personal data;
- snapshots may include product and financial facts but not secrets;
- machine-originated state changes must identify trusted machine or adapter identity;
- support actions are audited;
- order cancellation, refund request and manual completion are sensitive commands;
- idempotency keys must not leak secrets.

Order security must align with Payment, Wallet, Bonus, Ledger and Event Platform security rules.

---

# 20. Architecture Principles

Order architecture follows these principles:

1. Order is the business aggregate.
2. Order owns snapshots.
3. Order never recalculates historical prices.
4. Order never references mutable catalog data as historical truth.
5. Order publishes business events.
6. Configuration, Pricing and Discount engines calculate; Order records accepted results.
7. Bonus Engine owns bonus rights; Order stores reservation references.
8. Payment Engine owns payment lifecycle; Order stores payment binding.
9. Ledger remains the source of truth for financial history.
10. Machine Platform owns hardware execution; Order owns business fulfillment status.
11. Every state transition is explicit and auditable.
12. Every side-effect operation is idempotent.
13. Retries reconcile before repeating side effects.
14. Corrections are compensating operations, not silent edits.
15. UI does not calculate order totals or infer fulfillment state.
16. Order events are stable contracts for CRM, Notification, Analytics, Machine and Finance consumers.
17. Historical support and reporting use order snapshots, not live Product Catalog.
18. Order Platform remains independent from frontend, provider APIs and hardware protocols.

---

# Documentation Scope

This document is architecture-only.

It does not introduce JavaScript implementation, frontend changes, routes, styles, package changes, database migrations, payment provider integration, machine integration, CRM screens, notification templates or cloud infrastructure.
