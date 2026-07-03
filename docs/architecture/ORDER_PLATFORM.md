# Order Platform

Document code: ARCH-ORDER-001
Version: 0.7
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
- `docs/tasks/ORDER-004_ORDER_EVENTS.md`
- `docs/tasks/ORDER-005_FULFILLMENT.md`
- `docs/tasks/ORDER-006_CANCELLATION.md`
- `docs/tasks/ORDER-007_REFUND.md`
- `docs/tasks/ORDER-008_MACHINE_DISPATCH.md`

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
- `OrderValidated` is an accepted order validation checkpoint after configuration and before pricing; it does not introduce a separate canonical Order state in this version.
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
| none | `Draft` | Create one auditable order intent from checkout acceptance. | `OrderCreated` |
| `Draft` | `Configured` | Accept product configuration snapshot. | `OrderConfigured` |
| `Configured` | `Configured` | Accept order validation, availability and eligibility context before pricing. | `OrderValidated` |
| `Configured` | `Priced` | Accept gross price snapshot from Pricing Engine. | `PriceCalculated` |
| `Priced` | `Discounted` | Accept discount result and final payable amount. | `DiscountApplied` |
| `Discounted` | `BonusReserved` | Hold selected bonus rights before payment. | `BonusReserved` |
| `Discounted` | `PaymentPending` | Start payment when no bonus reservation is required. | `PaymentStarted` |
| `BonusReserved` | `PaymentPending` | Start payment after bonus reservation is accepted. | `PaymentStarted` |
| `PaymentPending` | `Paid` | Confirm payment completion under Payment and Ledger policy. | `PaymentConfirmed` |
| `Paid` | `Queued` | Request and accept machine fulfillment queue entry. | `OrderQueued` |
| `Queued` | `Preparing` | Machine confirms preparation has started. | `PreparationStarted` |
| `Preparing` | `Dispensing` | Machine confirms dispensing has started. | `DispensingStarted` |
| `Dispensing` | `Completed` | Machine or approved fulfillment policy confirms product delivery. | `OrderCompleted` |
| unpaid active state | `Cancelled` | Customer, system or operator stops order before captured payment. | `OrderCancelled` |
| unpaid active state | `Expired` | Checkout, reservation or payment window expires before captured payment. | `OrderExpired` |
| paid active state | `RefundPending` | Paid order cannot be fulfilled or must be compensated. | `RefundStarted` |
| `RefundPending` | `Refunded` | Refund completed and Ledger-backed compensation exists. | `RefundCompleted` |

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

Fulfillment starts only after Order accepts completed payment under Payment Engine and Ledger policy.

Core fulfillment rules:

- only `Paid` orders can request fulfillment;
- unpaid orders cannot enter queue, preparation, dispensing or completion;
- fulfillment never recalculates or changes financial data;
- fulfillment failures trigger retry, support or refund compensation through owning domains;
- every accepted fulfillment stage records audit data and publishes a domain event;
- Machine Platform owns queue execution, machine assignment, hardware commands, telemetry and operation outcome;
- Order owns business fulfillment state and customer purchase closure.

Fulfillment model:

```json
{
  "fulfillment_id": "fulfillment_01JZ0000000000000000000000",
  "fulfillment_type": "machine",
  "status": "not_started",
  "machine_id": "machine_01JZ0000000000000000000000",
  "queue_entry_id": null,
  "machine_operation_id": null,
  "recipe_id": "recipe_soft_ice_vanilla_strawberry_oreo",
  "requested_at": null,
  "queued_at": null,
  "assigned_at": null,
  "started_at": null,
  "dispensing_started_at": null,
  "completed_at": null,
  "failed_at": null,
  "failure_reason": null,
  "attempt_count": 0
}
```

Fulfillment lifecycle:

```text
not_started
->
requested
->
queued
->
assigned
->
preparing
->
dispensing
->
completed
```

Failure and recovery lifecycle:

```text
requested / queued / assigned / preparing / dispensing
->
retry_scheduled
->
requested / queued / assigned / preparing / dispensing

requested / queued / assigned / preparing / dispensing
->
compensation_required
->
RefundPending
->
Refunded
```

Rules:

- a paid order can request fulfillment when machine and business policy allow it;
- `Paid -> Queued` is accepted only after Machine Platform accepts a queue entry;
- `Queued -> Preparing` is accepted only after Machine Platform confirms preparation start;
- `Preparing -> Dispensing` is accepted only after Machine Platform confirms dispensing start;
- `Dispensing -> Completed` is accepted only after product delivery or approved fulfillment closure is confirmed;
- fulfillment status is part of Order, but hardware execution belongs to Machine Platform.
- order completion requires fulfillment success or an approved support closure policy.
- fulfillment failure must not edit payment history; it triggers recovery, retry, support review or refund workflow.
- fulfillment events must reference `order_id`, `order_item_id`, `machine_id` and correlation IDs when available.

Queue management:

- queue handoff is requested after `PaymentConfirmed` is accepted and the Order is `Paid`;
- queue entry is idempotent by `order_id`, `order_item_id`, `machine_id`, `recipe_id` and operation type;
- duplicate queue requests must resolve to the same queue entry or be rejected as conflicts;
- queue priority is policy-driven and must not be inferred by UI;
- queue timeout requires Machine Platform status reconciliation before retry;
- queue rejection after payment moves the order to retry, support review or `RefundPending` according to recovery policy.

Machine assignment:

- the machine can be known before checkout when the channel is tied to one vending machine;
- future policy can assign an eligible machine after payment when multiple machines are available;
- assignment must validate machine availability, recipe capability, ingredient availability and operational readiness through Machine Platform;
- assignment changes after payment must not change accepted configuration, pricing, discount or payment snapshots;
- alternate-machine fulfillment after payment requires explicit customer, operator or business policy support.

Preparation:

- preparation uses the accepted recipe reference from the immutable configuration snapshot;
- Order does not translate recipe data into hardware commands;
- Machine Platform confirms preparation start before Order enters `Preparing`;
- ingredient shortage, cup failure, syrup failure, topping failure, temperature fault or maintenance block must be reported as machine facts;
- preparation failure after payment triggers retry, support review or refund compensation.

Dispensing:

- dispensing starts only after preparation start is accepted;
- Machine Platform confirms dispensing start before Order enters `Dispensing`;
- dispensing telemetry is machine-owned and must be correlated with `machine_operation_id`;
- partial dispensing, nozzle failure, door failure, customer interruption or telemetry ambiguity must be reconciled before completion or refund;
- Order must not infer dispensing success from a timer.

Completion:

- completion requires product dispensed, product ready or taken, or another approved fulfillment closure policy;
- successful completion moves Order to `Completed`;
- `Completed` is terminal and immutable;
- post-completion goodwill refund or support correction is a new support or refund workflow referencing the completed order;
- completion does not create, edit or delete Ledger, Payment or Wallet records.

Failure handling:

| Failure | Handling |
|---|---|
| Queue rejected | Reconcile machine state, retry with same idempotency key when safe, or move to refund/support policy. |
| Machine assignment unavailable | Try approved alternate machine before preparation or move to compensation policy. |
| Preparation cannot start | Reconcile machine readiness, retry if transient, otherwise request refund compensation. |
| Preparation fails after start | Stop or reconcile machine operation, record failure reason, then retry or compensate. |
| Dispensing fails or is ambiguous | Reconcile telemetry and physical outcome before completion or refund decision. |
| Event publication fails | Retry the same event ID through Event Platform policy. |
| Support closes fulfillment manually | Require operator actor, reason, audit entry and approved closure policy. |

Retry policy:

- retry only idempotent fulfillment operations automatically;
- retry must read current Order and Machine state before issuing another side-effect command;
- retry must preserve original correlation and causation IDs;
- retry must not create duplicate queue entries, duplicate machine operations or duplicate products;
- repeated failures move to support review, dead-letter handling or refund compensation;
- successful retry does not duplicate already published lifecycle events.

Compensation strategy:

- fulfillment compensation never edits original payment, wallet, bonus or Ledger facts;
- paid fulfillment failure moves Order to `RefundPending` when retry or approved alternate fulfillment is exhausted;
- Payment Engine owns refund execution;
- Ledger records refund facts;
- Wallet and Bonus owners handle release, capture, refund, redemption or reversal through their own policies;
- Machine Platform owns safe stop, operation reconciliation and hardware recovery;
- Order records compensation intent, references and final business closure.

Fulfillment event publication:

| Stage | Order state effect | Required event behavior |
|---|---|---|
| Payment accepted for fulfillment | `PaymentPending -> Paid` | Order publishes `PaymentConfirmed`. |
| Queue accepted | `Paid -> Queued` | Order publishes `OrderQueued`; Machine Platform records queue acceptance. |
| Machine assignment accepted | Fulfillment assignment context updated | Machine Platform publishes an assignment or operation event; Order records reference when accepted. |
| Preparation started | `Queued -> Preparing` | Order publishes `PreparationStarted`. |
| Dispensing started | `Preparing -> Dispensing` | Order publishes `DispensingStarted`. |
| Fulfillment completed | `Dispensing -> Completed` | Order publishes `OrderCompleted`. |
| Fulfillment cannot complete | paid active state -> `RefundPending` | Order publishes `RefundStarted` after compensation decision is accepted. |

Audit and monitoring:

- every fulfillment stage records actor, machine identity, operation ID, reason, timestamp, correlation ID and idempotency key;
- machine-originated facts require trusted machine or adapter identity;
- operator recovery requires operator ID and support reason;
- monitoring must track queue latency, assignment failures, preparation latency, dispensing latency, completion rate, retry count, compensation rate and event publication failures;
- customer-visible state must be derived from Order and Machine facts, not local UI timers.

---

# 13. Machine Interaction

Machine Platform owns machine state, readiness, commands, telemetry and preparation outcome.

Order interaction:

```text
PaymentConfirmed
->
OrderQueued
->
PreparationStarted
->
DispensingStarted
->
OrderCompleted
```

Rules:

- Order does not send low-level hardware commands directly.
- Order requests fulfillment through an approved Machine contract.
- Machine queue acceptance moves Order to `Queued`.
- Machine assignment is accepted only from Machine Platform state and does not change financial facts.
- Machine confirms accepted preparation intent before Order enters `Preparing`.
- Machine dispensing confirmation moves Order to `Dispensing`.
- Machine completion or approved fulfillment closure moves Order to `Completed`.
- machine timeout, ingredient shortage, hardware error or customer no-pickup must trigger retry, `RefundPending` or a future support workflow.
- UI must reflect Order and Machine events, not assumed timers.
- Machine Platform must publish machine domain events for queue, assignment, operation, telemetry, error and completion facts.
- Order publishes Order domain events only after accepted Order state changes or approved checkpoints.

---

# 14. Machine Dispatch

Machine Dispatch is the technical and operational handoff from a confirmed paid Order to a selected vending machine operation.

Dispatch is narrower than fulfillment. Fulfillment is the business delivery process owned by Order Platform. Dispatch is the Machine Platform execution boundary that selects an eligible machine, queues a machine operation, sends delivery protocol commands, receives acknowledgement and publishes technical facts for Order, CRM, Notification, Analytics and support.

Core dispatch rules:

- machine receives only confirmed paid orders;
- dispatch never changes financial data;
- dispatch never changes Order state directly;
- dispatch publishes technical and business events;
- dispatch commands are idempotent and auditable;
- dispatch retries reconcile machine and queue state before repeating physical side effects.

## 14.1 Machine Dispatch Architecture

Machine Dispatch sits after payment confirmation and before physical preparation.

Architecture position:

```text
PaymentConfirmed
->
Order state = Paid
->
Fulfillment request accepted
->
Machine Dispatch selects machine
->
Dispatch queue entry created
->
Machine command delivered
->
Machine acknowledgement received
->
Machine operation events published
->
Order handles accepted machine facts through Order commands/events
```

Dispatch owns:

- machine selection policy execution;
- queue entry creation and ordering;
- machine command model;
- delivery protocol interaction;
- command acknowledgement tracking;
- timeout detection;
- retry scheduling;
- machine-operation correlation;
- technical dispatch events;
- operational monitoring and audit records.

Dispatch does not own:

- Order business state transitions;
- payment completion or refund execution;
- Wallet balance or reservations;
- Ledger financial facts;
- product price, discount or bonus rules;
- low-level firmware internals outside approved machine adapter contracts;
- UI progress state.

Order Platform may request dispatch after it accepts a paid state. Machine Dispatch may publish accepted technical facts. Order changes `Paid -> Queued`, `Queued -> Preparing`, `Preparing -> Dispensing` or `Dispensing -> Completed` only through approved Order transition commands that consume validated facts.

## 14.2 Dispatch Lifecycle

Dispatch lifecycle:

```text
not_requested
->
dispatch_requested
->
machine_selected
->
queue_entry_created
->
command_prepared
->
command_sent
->
acknowledged
->
operation_started
->
operation_completed
```

Failure and recovery lifecycle:

```text
dispatch_requested / machine_selected / queue_entry_created / command_prepared / command_sent
->
timeout_detected
->
status_reconciled
->
retry_scheduled
->
command_sent

dispatch_requested / machine_selected / queue_entry_created / command_sent / operation_started
->
dispatch_failed
->
recovery_required
->
retry, alternate machine, support review or refund compensation
```

Lifecycle rules:

- dispatch starts only from an Order that has accepted `PaymentConfirmed` and is currently `Paid` or otherwise eligible for fulfillment by approved policy;
- dispatch request must reference immutable Order snapshots and accepted `recipe_id`;
- dispatch may create a queue entry before sending a machine command;
- dispatch completion is not the same as Order completion;
- operation completion must be reconciled before Order closes as `Completed`;
- dispatch terminal failure after payment cannot move Order to `Cancelled` or `Expired`;
- dispatch failure may cause Order refund compensation only through approved Order and Payment flows.

## 14.3 Machine Selection

Machine selection chooses the vending machine that can safely prepare the paid order.

Selection inputs:

- `order_id`;
- `order_item_id`;
- `fulfillment_id`;
- customer channel and machine context;
- accepted `recipe_id`;
- product and option semantic IDs from snapshots;
- requested quantity;
- machine availability policy;
- maintenance, safety and cleaning state;
- inventory and consumable availability;
- queue capacity;
- operator override when approved.

Selection modes:

| Mode | Meaning |
|---|---|
| Direct | Customer starts checkout from a known vending machine. |
| Policy | Platform selects the best eligible machine after payment. |
| Alternate | Platform selects a replacement machine before physical preparation starts. |
| Operator | Authorized operator assigns or reassigns a machine with reason. |

Selection rules:

- machine selection is allowed only for confirmed paid orders;
- selected machine must support the accepted recipe and required ingredients;
- selected machine must pass readiness, safety, maintenance and queue-capacity checks;
- selection must not change configuration, pricing, discount, bonus, payment or Ledger facts;
- alternate-machine selection after payment requires approved policy and customer/support handling when the physical pickup point changes;
- selection ambiguity blocks command dispatch until reconciled.

## 14.4 Queue Handling

Dispatch queue controls the order in which paid machine operations are sent to machines.

Queue entry model:

```json
{
  "queue_entry_id": "machine_queue_01JZ0000000000000000000000",
  "dispatch_id": "dispatch_01JZ0000000000000000000000",
  "order_id": "order_01JZ0000000000000000000000",
  "order_item_id": "order_item_01JZ0000000000000000000000",
  "machine_id": "machine_01JZ0000000000000000000000",
  "recipe_id": "recipe_soft_ice_vanilla_strawberry_oreo",
  "status": "queued",
  "priority": "normal",
  "attempt_count": 0,
  "idempotency_key": "order_01JZ_item_01JZ_machine_01JZ_recipe_01JZ_prepare",
  "created_at": "2026-07-03T00:00:00Z"
}
```

Queue rules:

- only paid orders can enter the dispatch queue;
- one order item must have at most one active queue entry for one fulfillment operation;
- queue entries are idempotent by order item, machine, recipe and operation type;
- duplicate queue requests with matching payload return the existing queue entry;
- duplicate queue requests with conflicting payload are rejected and audited;
- queue priority is policy-driven and cannot be inferred by frontend or channel UI;
- queue timeout triggers machine/queue status reconciliation before retry;
- queue cancellation, pause or safe stop is owned by Machine Platform and must publish technical events.

## 14.5 Delivery Protocol

Delivery protocol defines the machine-facing command contract used by Dispatch.

Delivery protocol command envelope:

```json
{
  "command_id": "machine_command_01JZ0000000000000000000000",
  "command_type": "PrepareProduct",
  "dispatch_id": "dispatch_01JZ0000000000000000000000",
  "queue_entry_id": "machine_queue_01JZ0000000000000000000000",
  "machine_operation_id": "machine_operation_01JZ0000000000000000000000",
  "order_id": "order_01JZ0000000000000000000000",
  "order_item_id": "order_item_01JZ0000000000000000000000",
  "machine_id": "machine_01JZ0000000000000000000000",
  "recipe_id": "recipe_soft_ice_vanilla_strawberry_oreo",
  "payload_version": 1,
  "recipe_snapshot_ref": "configuration_snapshot_01JZ0000000000000000000000",
  "idempotency_key": "machine_operation_01JZ_prepare_v1",
  "correlation_id": "order_01JZ0000000000000000000000",
  "causation_id": "evt_01JZ0000000000000000000000",
  "issued_at": "2026-07-03T00:00:00Z"
}
```

Protocol rules:

- command payloads contain recipe and operation references, not financial data;
- command payloads must not contain payment credentials, provider secrets, personal data beyond approved correlation fields or UI state;
- command type and payload version are stable contracts;
- machine adapters translate platform commands into hardware-specific instructions;
- firmware-specific status codes are mapped into platform machine result codes before other domains consume them;
- dispatch must support at-least-once command delivery with idempotent machine operation handling;
- command replay must not create duplicate products.

## 14.6 Command Acknowledgement

Command acknowledgement is the machine or adapter response that a command was received, accepted, rejected or could not be safely processed.

Acknowledgement states:

| State | Meaning |
|---|---|
| `sent` | Dispatch handed the command to the delivery adapter. |
| `received` | Adapter or machine received the command envelope. |
| `accepted` | Machine accepted the operation for execution. |
| `rejected` | Machine rejected the operation before execution. |
| `duplicate` | Machine recognized an already accepted idempotent command. |
| `unknown` | Dispatch cannot determine whether the machine accepted the command. |

Acknowledgement rules:

- acknowledgement is not payment confirmation;
- acknowledgement is not Order completion;
- accepted acknowledgement may allow Order to accept `Paid -> Queued` or later transition only through approved Order handling;
- rejected acknowledgement must include machine, operation and reason references;
- duplicate acknowledgement must resolve to the original operation when payload matches;
- unknown acknowledgement requires status reconciliation before retry;
- acknowledgement records must be auditable and correlated with command ID, queue entry ID and machine operation ID.

## 14.7 Timeout Handling

Dispatch timeout handling protects customers from stuck paid orders and protects machines from duplicate physical actions.

Timeout categories:

| Timeout | Meaning | Required handling |
|---|---|---|
| Selection timeout | No eligible machine selected within policy window. | Recalculate eligibility, use approved alternate machine or move to support/recovery. |
| Queue timeout | Queue entry did not advance within policy window. | Read queue and machine operation state before retry. |
| Command delivery timeout | Command delivery result is unknown. | Reconcile by command ID and idempotency key before sending again. |
| Acknowledgement timeout | Machine did not acknowledge within policy window. | Read machine operation status before retry or failure. |
| Operation start timeout | Acknowledged command did not start. | Reconcile machine status, retry if safe or recover. |
| Operation completion timeout | Started operation did not complete within policy window. | Reconcile telemetry and physical outcome before completion or refund. |

Timeout rules:

- timeout is an operational fact, not proof of machine failure by itself;
- dispatch must not send a second physical command until current operation status is reconciled;
- repeated timeout after bounded retries moves to support review, dead-letter handling or refund recovery;
- customer-facing progress must be derived from Order and Machine facts, not local countdowns;
- timeout events must include correlation IDs and idempotency keys.

## 14.8 Retry Policy

Dispatch retries are conservative because duplicate machine commands can create duplicate products.

Retry rules:

- retry only idempotent operations automatically;
- retry status reads before retrying physical side effects;
- reuse the same idempotency key for the same command;
- preserve original correlation and causation IDs;
- use bounded exponential backoff for transient network, adapter or machine-busy failures;
- do not retry rejected business or safety conditions automatically;
- do not create a second machine operation while the first operation is unknown or active;
- route repeated failures to support review or recovery workflow;
- event publication retry uses the same event ID.

Retry examples:

| Failure | Retry behavior |
|---|---|
| Machine status read timeout | Retry status read first. |
| Command delivery timeout | Reconcile command ID and operation ID before resending. |
| Duplicate acknowledgement | Return original accepted operation. |
| Machine busy | Retry only within queue policy and without changing priority silently. |
| Safety block | Do not retry automatically until Machine Platform reports safe readiness. |
| Event bus failure | Retry same event ID through Event Platform policy. |

## 14.9 Failure Recovery

Failure recovery decides how a paid order continues after dispatch cannot safely complete.

Recovery options:

| Scenario | Recovery |
|---|---|
| No machine selected | Try approved alternate machine or route to support/refund policy. |
| Queue rejected | Reconcile queue reason, retry if transient or select alternate machine. |
| Command rejected before execution | Correct recoverable readiness issue, retry or compensate. |
| Command accepted but operation unknown | Reconcile machine operation before retry or refund. |
| Operation failed before product creation | Retry on same or alternate machine if policy allows. |
| Operation failed after partial preparation | Stop safely, reconcile physical outcome and route to support/refund policy. |
| Machine offline after payment | Reconcile whether command was accepted; use alternate machine or compensation. |
| Duplicate command conflict | Keep canonical operation and audit rejected duplicate. |

Recovery rules:

- dispatch recovery never edits payment, wallet, bonus or Ledger facts;
- paid orders that cannot be dispatched or fulfilled move toward refund compensation only through Order and Payment flows;
- Machine Platform owns safe stop, cleanup, operation reconciliation and hardware recovery;
- Order records recovery references and accepts state changes only through its own lifecycle rules;
- support recovery requires actor, role, reason and audit metadata;
- partial preparation, partial dispensing and product-not-taken policies require Product Owner approval before automation.

## 14.10 Event Publication

Machine Dispatch publishes technical and business events after accepted dispatch facts.

Event categories:

| Category | Examples | Purpose |
|---|---|---|
| Business-facing dispatch facts | `MachineDispatchRequested`, `MachineSelected`, `MachineDispatchAccepted`, `MachineDispatchFailed` | Allow Order, CRM, Notification and Analytics to react to fulfillment progress and failures. |
| Technical machine facts | `MachineCommandSent`, `MachineCommandAcknowledged`, `MachineCommandRejected`, `MachineCommandTimedOut`, `MachineOperationStatusChanged` | Allow operations, monitoring and support to trace machine execution. |
| Recovery facts | `MachineDispatchRetryScheduled`, `MachineDispatchRecoveryRequired`, `MachineOperationReconciled` | Allow support, refund and incident workflows to coordinate safely. |

Event rules:

- dispatch events follow `docs/architecture/EVENT_PLATFORM.md`;
- events are facts, not commands;
- dispatch publishes technical events for machine communication and business events for accepted dispatch outcomes;
- Order events are still published only by Order Platform after accepted Order transitions;
- dispatch event payloads include `dispatch_id`, `order_id`, `order_item_id`, `machine_id`, `queue_entry_id`, `machine_operation_id`, command ID, state, reason, correlation ID, causation ID and idempotency key when available;
- dispatch event payloads must not include payment credentials, provider secrets, raw card data, unnecessary personal data or UI component state;
- event replay can rebuild projections and monitoring but must not resend machine commands or repeat refunds.

## 14.11 Monitoring

Dispatch monitoring must detect stuck paid orders and unreliable machine communication.

Required metrics:

- paid-to-dispatch-request latency;
- machine selection latency;
- machine selection failure rate;
- queue depth by machine;
- queue wait time;
- command delivery latency;
- command acknowledgement latency;
- acknowledgement timeout rate;
- command rejection rate by reason;
- retry count by machine and command type;
- duplicate command conflict count;
- operation start latency;
- operation completion latency;
- dispatch failure rate;
- recovery-required count;
- machine and Order state divergence count;
- event publication failure rate;
- dead-letter count.

Required alerts:

- paid orders stuck before dispatch;
- dispatch queue not advancing;
- high acknowledgement timeout rate;
- repeated command rejection for one machine;
- high duplicate command conflict rate;
- machine operation unknown after command delivery;
- high recovery or refund rate after dispatch;
- dispatch event delivery failure;
- Order, Machine and queue state divergence.

Monitoring rules:

- dashboards use Order, Machine, Payment and Event facts;
- dashboards must not infer product delivery from timers alone;
- alerts include machine ID, dispatch ID, order ID and correlation ID;
- replay must rebuild metrics without repeating machine side effects.

## 14.12 Audit

Dispatch audit must reconstruct the complete machine communication timeline for every paid order sent to a machine.

Required audit fields:

- `dispatch_id`;
- `order_id`;
- `order_item_id`;
- `fulfillment_id`;
- `machine_id`;
- `queue_entry_id`;
- `machine_operation_id`;
- `command_id`;
- `command_type`;
- `command_payload_version`;
- `acknowledgement_status`;
- `acknowledgement_reason`;
- `from_dispatch_state`;
- `to_dispatch_state`;
- `retry_count`;
- `timeout_type` when applicable;
- `failure_reason` when applicable;
- `recovery_action` when applicable;
- actor, operator ID or machine identity;
- machine adapter, controller or firmware version when available;
- event IDs;
- correlation ID;
- causation ID;
- idempotency key;
- `issued_at`;
- `acknowledged_at`;
- `occurred_at`;
- `recorded_at`.

Audit rules:

- every command, acknowledgement, timeout, retry, rejection and recovery action is auditable;
- machine-originated facts require trusted machine or adapter identity;
- operator recovery requires role, actor ID and reason;
- rejected duplicate commands are audited;
- audit records must not contain payment credentials, provider secrets, raw card data or unnecessary personal data;
- audit supports support investigation, incident review, reconciliation and future compliance reporting.

## 14.13 Architecture Principles

Machine Dispatch follows these principles:

1. Machine receives only confirmed paid orders.
2. Dispatch never changes financial data.
3. Dispatch never changes Order state directly.
4. Dispatch publishes technical and business events after accepted dispatch facts.
5. Order Platform remains the owner of Order lifecycle transitions.
6. Machine Platform owns machine selection, queue execution, commands, acknowledgements, telemetry and physical outcome.
7. Dispatch uses immutable Order snapshots and accepted recipe references.
8. Dispatch command payloads contain machine-operation data, not payment or UI state.
9. Every dispatch command is idempotent.
10. Command acknowledgement is explicit and auditable.
11. Timeout handling reconciles before retry.
12. Retries must not create duplicate queue entries, machine operations or products.
13. Failure recovery uses retry, alternate machine, support review or refund compensation through owning domains.
14. Dispatch events follow Event Platform contracts and do not replace Order events.
15. Monitoring must detect stuck paid orders before they become support incidents.
16. Audit must reconstruct the full command, acknowledgement, retry and recovery timeline.

---

# 15. Cancellation

Cancellation is a business process that intentionally stops an order flow and coordinates all required release, cancellation, refund, machine and audit actions.

Cancellation is not a UI state, not a payment provider status and not a silent data correction.

Core cancellation distinction:

| Situation | Order result | Financial result |
|---|---|---|
| No captured payment exists | `Cancelled` | Temporary reservations and unfinished payment attempts are released or cancelled. |
| Captured payment exists | `RefundPending` then `Refunded` | Refund compensation is executed through the finance refund flow. |
| Order is `Completed` | Cancellation forbidden | Future goodwill refund or support correction references the completed order without reopening it. |

## 15.1 Cancellation Architecture

Cancellation starts from an explicit command, timeout policy, provider fact, operator action or support action.

Canonical coordination:

```text
Cancellation requested
->
Order loads current state, snapshots and payment binding
->
Payment reconciliation confirms whether captured funds exist
->
Machine reconciliation confirms whether physical preparation may have started
->
Order accepts cancellation, refund compensation or rejection
->
Owning domains perform release, refund, machine stop or support actions
->
Order publishes the accepted business event
```

Architecture ownership:

| Area | Owner |
|---|---|
| Business cancellation decision | Order Platform |
| Payment attempt cancellation before capture | Payment Engine |
| Refund execution for captured funds | Refund Engine or Payment Engine refund flow |
| Financial history | Ledger |
| Wallet release, capture or refund | Wallet and Ledger |
| Bonus reservation release or reversal | Bonus Engine |
| Coupon or promotion release | Discount or Promotion owner |
| Machine queue stop, safe stop and operation reconciliation | Machine Platform |
| Customer or operator communication | Notification and CRM consumers |

Cancellation never edits historical transactions, never deletes Ledger entries and never edits immutable Order snapshots. Every correction after an accepted financial or machine fact is represented by a new compensating operation.

Until a separate Refund Engine is introduced, Payment Engine owns the refund operation described here. The architecture keeps the refund boundary explicit so a future Refund Engine can be added without changing Order snapshots or cancellation semantics.

## 15.2 Cancellation Lifecycle

Cancellation lifecycle:

```text
requested
->
eligibility_checked
->
reconciliation_required when payment or machine state is ambiguous
->
side_effects_requested
->
accepted_as_cancelled or accepted_as_refund_pending or rejected
->
events_published
->
closed or compensation_continues
```

Unpaid cancellation flow:

```text
Draft / Configured / Priced / Discounted / BonusReserved / PaymentPending
->
payment reconciliation confirms no captured funds
->
release temporary reservations and cancel unfinished attempts
->
Cancelled
->
OrderCancelled
```

Paid cancellation or stop flow:

```text
Paid / Queued / Preparing / Dispensing
->
payment reconciliation confirms captured funds
->
machine reconciliation confirms physical outcome
->
RefundPending
->
RefundStarted
->
RefundCompleted
->
Refunded
```

Cancellation cannot move a paid order to `Cancelled`. Captured payment changes the business process from cancellation closure to refund compensation.

## 15.3 Business Cancellation Rules

Allowed cancellation actors:

- customer;
- system timeout controller;
- Payment Engine or provider-adapter fact before capture;
- operator;
- support;
- fraud or risk process through approved policy.

Business rules:

- cancellation requires actor, reason, command ID and idempotency key;
- customer cancellation is allowed only before captured payment or machine preparation policy forbids it;
- system cancellation must be based on explicit timeout, availability, risk or reconciliation policy;
- operator cancellation requires role permission and reason;
- cancellation in `PaymentPending` requires Payment Engine reconciliation before terminal closure;
- cancellation after payment capture becomes refund compensation;
- cancellation after machine preparation may require machine safe stop or physical outcome reconciliation before refund;
- terminal states `Completed`, `Cancelled`, `Refunded` and `Expired` cannot be cancelled.

Cancellation reasons should be stable reason codes, such as:

- `customer_requested`;
- `payment_cancelled_before_capture`;
- `payment_declined_no_capture`;
- `checkout_replaced`;
- `machine_unavailable_before_capture`;
- `operator_cancelled`;
- `fraud_or_risk_rejected`;
- `duplicate_order_replaced`;
- `support_policy_cancelled`.

## 15.4 Financial Impact

Cancellation financial impact depends on whether captured funds exist.

No captured payment:

- unfinished provider payment is cancelled by Payment Engine when required;
- authorized but uncaptured payment is cancelled or allowed to expire by Payment policy;
- wallet reservation is released through Wallet and Ledger policy;
- bonus reservation is released by Bonus Engine;
- coupon or promotion reservation is released by its owning domain;
- no refund Ledger entry is created because no captured funds exist.

Captured payment:

- original payment remains immutable;
- original Ledger entries remain immutable;
- refund is a new financial operation;
- refund references original `order_id`, `payment_id`, method lines and Ledger entries;
- mixed payment refund preserves method-line attribution;
- wallet refunds and releases go through Wallet and Ledger contracts;
- bonus redemption reversal or compensation goes through Bonus Engine policy;
- Order stores refund references and closes only after accepted refund completion.

Financial invariants:

- cancellation never edits historical transactions;
- cancellation never recalculates payable amount;
- cancellation never changes pricing or discount snapshots;
- cancellation never treats bonuses as money;
- Ledger remains the source of truth for financial history.

## 15.5 Machine Interaction

Machine coordination depends on how far fulfillment progressed.

| Order state | Machine coordination |
|---|---|
| `Draft`, `Configured`, `Priced`, `Discounted`, `BonusReserved`, `PaymentPending` | No machine fulfillment should exist. If one exists, it is a serious reconciliation incident. |
| `Paid` | Cancel before queue when possible; no machine operation should have started. |
| `Queued` | Reconcile or cancel queue entry before refund compensation. |
| `Preparing` | Request safe stop when supported and reconcile physical outcome before refund decision. |
| `Dispensing` | Reconcile dispensed amount, telemetry and customer outcome before refund decision. |
| `Completed` | Cancellation is forbidden; use a separate support or goodwill refund workflow. |

Machine rules:

- Order does not send low-level hardware commands directly;
- Machine Platform owns queue cancellation, operation stop, telemetry, safe cleanup and hardware recovery;
- cancellation must not create a duplicate queue entry or duplicate product;
- if machine state is ambiguous, cancellation waits for reconciliation or enters support review;
- machine-originated cancellation facts require trusted machine or adapter identity;
- customer-visible state must be derived from Order, Payment and Machine facts.

## 15.6 Compensation Strategy

Cancellation compensation uses the owning domain for each side effect.

Compensation matrix:

| Condition | Compensation |
|---|---|
| Bonus reserved, no payment captured | Release reservation through Bonus Engine. |
| Wallet reserved, no payment captured | Release reservation through Wallet and Ledger policy. |
| External payment pending, no capture | Cancel or expire payment through Payment Engine. |
| External payment captured | Start refund through Refund Engine or Payment Engine refund flow. |
| Wallet captured | Create wallet refund or reversal through Wallet and Ledger policy. |
| Bonus redeemed after payment | Reverse or compensate according to Bonus Engine policy. |
| Machine queued but not prepared | Cancel or reconcile queue entry through Machine Platform. |
| Machine preparing or dispensing | Stop when safe, reconcile physical outcome, then refund or support-review by policy. |

Compensation rules:

- compensation is explicit and auditable;
- compensation never mutates original snapshots, payments or Ledger entries;
- retry uses idempotency keys and current-domain reconciliation;
- repeated compensation failures move to support review or dead-letter handling;
- partial refund, partial dispensing and post-completion goodwill require Product Owner-approved policy before implementation.

## 15.7 Event Publication

Cancellation always publishes business events after accepted business decisions.

Order event behavior:

| Accepted decision | Order state effect | Order event |
|---|---|---|
| Unpaid cancellation accepted | unpaid active state -> `Cancelled` | `OrderCancelled` |
| Paid stop or cancellation requires refund | paid active state -> `RefundPending` | `RefundStarted` |
| Refund completed | `RefundPending -> Refunded` | `RefundCompleted` |
| Cancellation command rejected | no state change | audit record; `OrderTransitionRejected` only if audit policy promotes it |

Related domain events may include:

- `PaymentCancelled`;
- `RefundRequested`;
- `RefundCompleted`;
- `WalletReservationReleased`;
- `WalletRefunded`;
- `BonusReservationReleased`;
- `BonusRedemptionReversed`;
- `MachineQueueCancelled`;
- `MachineOperationStopped`;
- `MachineOperationReconciled`;
- `NotificationRequested`;
- `SupportCaseCreated`.

Event rules:

- every accepted Order state transition emits exactly one Order business event;
- event payloads include `order_id`, `from_state`, `to_state`, `state_reason`, actor, correlation ID, causation ID and idempotency key;
- financial events reference payment, refund, wallet, transaction and Ledger IDs without exposing secrets;
- machine events reference machine and operation IDs without exposing hardware command internals;
- event publication retry uses the same `event_id`;
- Event Storage does not replace Order repository or Ledger.

## 15.8 Audit

Cancellation audit must reconstruct who stopped the order, why it was allowed, what side effects were requested and how the business process closed.

Required audit fields:

- `order_id`;
- `order_number`;
- `from_state`;
- `to_state`;
- `state_version`;
- `cancellation_reason`;
- `refund_reason` when applicable;
- `actor`;
- `operator_id` or support ID when applicable;
- `payment_id`;
- `refund_id` when applicable;
- `wallet_reservation_id` when applicable;
- `bonus_reservation_id` when applicable;
- `machine_id` when applicable;
- `queue_entry_id` or `machine_operation_id` when applicable;
- `command_id`;
- `event_id`;
- `correlation_id`;
- `causation_id`;
- `idempotency_key`;
- `occurred_at`;
- `recorded_at`;
- reconciliation status and references.

Audit rules:

- every accepted cancellation decision records actor and reason;
- rejected sensitive cancellation commands are audited;
- operator and support actions require actor ID and reason;
- machine-originated facts require trusted machine or adapter identity;
- payment-originated facts require verified Payment Engine facts;
- audit records must not contain provider secrets, raw card data, access tokens or unnecessary personal data;
- historical snapshots remain visible and immutable for support and reporting.

## 15.9 Monitoring

Cancellation monitoring detects customer-impacting failures, financial risk and machine-state divergence.

Required metrics:

- cancellation request count by actor and reason;
- cancellation acceptance rate;
- cancellation rejection rate;
- unpaid cancellation count;
- paid cancellation-to-refund count;
- cancellation latency from request to terminal or compensation state;
- payment cancellation failure rate;
- refund-start failure rate;
- refund-completion failure rate;
- wallet release failure rate;
- bonus release failure rate;
- machine queue cancellation failure rate;
- machine reconciliation latency;
- stuck `RefundPending` orders;
- event publication failure rate;
- support escalation count.

Required alerts:

- cancellation accepted but no `OrderCancelled`, `RefundStarted` or `RefundCompleted` event was published;
- unpaid cancellation with captured payment later detected;
- paid cancellation closed as `Cancelled`;
- wallet or bonus reservation not released after terminal unpaid cancellation;
- refund pending beyond policy;
- machine operation still active after cancellation or refund decision;
- duplicate cancellation command conflict spike;
- Order, Payment, Ledger or Machine state divergence.

Monitoring rules:

- dashboards use Order, Payment, Wallet, Bonus, Ledger and Machine facts;
- financial dashboards use Ledger facts for money;
- replay must rebuild cancellation projections without issuing refunds, releases or machine commands;
- support queues must include correlation IDs, actor, reason and current owning domain.

## 15.10 Architecture Principles

Cancellation architecture follows these principles:

1. Cancellation is a business process.
2. Cancellation is explicit, authorized, idempotent and auditable.
3. Cancellation never edits historical transactions.
4. Cancellation never edits immutable Order snapshots.
5. Unpaid cancellation closes as `Cancelled`.
6. Paid cancellation or stop becomes refund compensation.
7. Cancellation may trigger Refund Engine or Payment Engine refund flow.
8. Ledger remains the source of truth for financial history.
9. Wallet, Bonus, Discount, Payment and Machine side effects are owned by their domains.
10. Machine state is reconciled before refund when physical preparation may have started.
11. Cancellation always publishes business events after accepted business decisions.
12. Rejected cancellation commands are audited and do not silently change state.
13. Retries reconcile before repeating side effects.
14. Terminal states are not reopened by cancellation.
15. UI derives cancellation state from domain facts and does not decide financial or machine outcomes.

---

# 16. Refund

Refund is the explicit compensation process for an Order that has captured financial value and must return some or all of that value according to approved business policy.

Refund is not cancellation before capture, not a payment provider status, not a Ledger edit and not a UI correction.

Core refund rules:

```text
Refund never edits historical ledger records.
Refund is represented by new financial transactions.
Refund publishes domain events.
Refund is fully auditable.
```

Until a separate Refund Engine is introduced, Payment Engine owns refund execution. Order Platform owns the business decision that a paid order requires refund compensation, the `RefundPending` and `Refunded` Order states, refund references on the Order aggregate and the Order business events that describe accepted Order state changes.

## 16.1 Refund Architecture

Refund starts only from a paid or previously completed financial fact.

Canonical refund coordination:

```text
Refund requested
->
Order loads current state, immutable snapshots and payment binding
->
Order validates refund eligibility and business reason
->
Payment, Ledger, Wallet, Bonus and Machine facts are reconciled when needed
->
Refund amount and method-line allocation are accepted
->
Payment Engine or future Refund Engine executes provider and wallet refund operations
->
Ledger records new refund transactions and entries
->
Wallet projection updates from Ledger when internal balance is involved
->
Refund events are published
->
Order closes as Refunded when refund completion is accepted
```

Architecture ownership:

| Area | Owner |
|---|---|
| Refund business eligibility for an Order | Order Platform |
| Refund execution for external methods | Payment Engine or future Refund Engine |
| Provider refund API calls and provider status mapping | Payment Provider Adapter |
| Financial transaction identity | Transaction / Finance Platform |
| Immutable financial history | Ledger |
| Internal balance refund projection | Wallet over Ledger |
| Bonus redemption reversal or compensation | Bonus Engine |
| Machine outcome reconciliation | Machine Platform |
| Customer and operator communication | Notification and CRM consumers |
| Refund audit and support timeline | Order, Payment, Ledger, CRM and Event Platform |

Order does not call provider APIs, mutate Wallet balances, edit Ledger records, reverse bonuses directly or infer machine outcome from UI state. It records refund business state and references the owning domains' accepted facts.

## 16.2 Refund Lifecycle

Refund lifecycle from the Order perspective:

```text
eligible_for_refund
->
refund_requested
->
refund_validated
->
reconciliation_required when payment, wallet, provider or machine state is ambiguous
->
refund_processing
->
refund_completed or refund_failed or manual_review
```

Order state flow for failed paid fulfillment:

```text
Paid / Queued / Preparing / Dispensing
->
RefundPending
->
RefundStarted
->
RefundCompleted
->
Refunded
```

Post-completion support or goodwill refund flow:

```text
Completed
->
support refund workflow references completed order
->
RefundRequested / RefundCompleted from finance flow
->
Completed remains immutable
```

Rules:

- `RefundPending` is used when a non-terminal paid active order must be compensated before closure.
- `Refunded` is a terminal Order state for full compensation of a paid active order that did not complete fulfillment.
- `Completed` is not reopened by a refund; goodwill or support refunds reference the completed Order and remain separate support/finance workflows.
- partial refunds do not automatically close an Order as `Refunded` unless approved policy says the remaining obligation is closed.
- refund completion requires Ledger-backed refund facts or an approved Ledger correlation policy.
- refund failure keeps the order in `RefundPending` or support review; it must not silently mark the order unpaid.

## 16.3 Financial Coordination

Refund financial coordination preserves the original sale and creates compensating financial facts.

Financial coordination rules:

- refund amount is based on accepted Order snapshots, captured payment lines, previous refunds and approved refund policy;
- refund amount cannot exceed captured amount minus previous refunds for the same method line and currency;
- full refund compensates the full captured payable amount by method-line attribution;
- partial refund compensates only the approved amount and reason;
- mixed payment refund must preserve wallet, card, SBP and future method-line attribution;
- discounts remain historical price reductions and are not refunded as money;
- bonuses are not money and are reversed or compensated only through Bonus Engine policy;
- provider fees, fiscal receipts and accounting adjustments require explicit future policy before implementation;
- every financial correction is represented by a new transaction and Ledger entry.

Financial reconciliation inputs:

| Input | Purpose |
|---|---|
| Order snapshots | Confirm original product, pricing, discount, bonus and payable context. |
| Payment binding | Identify payment ID, method lines, provider references and captured amount. |
| Ledger entries | Confirm authoritative sale, capture, wallet and previous refund facts. |
| Wallet projection | Confirm current internal balance state for customer-visible support. |
| Provider status | Confirm external refund eligibility and outcome. |
| Machine outcome | Decide whether refund is full, partial, support-reviewed or forbidden. |

Order stores refund references for support and audit, but Ledger remains the financial source of truth.

## 16.4 Ledger Interaction

Ledger interaction is append-only.

Ledger rules:

- refund never edits historical Ledger records;
- refund never deletes sale, payment, wallet capture, bonus or adjustment records;
- refund is represented by new financial transactions and new Ledger entries;
- refund Ledger entries reference original `order_id`, `payment_id`, `transaction_id`, method line, customer ID and previous Ledger entry IDs where applicable;
- Ledger operation type `REFUND` is used or mapped through the approved Finance Platform operation catalog;
- Ledger entries include amount, currency, debit, credit, actor, reason, idempotency key and correlation IDs;
- if Payment, Wallet or provider state conflicts with Ledger financial history, Ledger wins until reconciliation proves a new correcting transaction is required;
- Ledger events such as `LedgerEntryRecorded` drive Wallet projection updates and finance reporting.

Refund Ledger flow:

```text
Refund operation accepted
->
Refund transaction created
->
Refund Ledger entry recorded
->
LedgerEntryRecorded
->
Wallet projection, finance reports, CRM and audit consumers update
```

Event Storage may record refund events, but it does not replace Ledger for financial truth.

## 16.5 Wallet Interaction

Wallet interaction depends on how the original payment was settled and where the refund value must be returned.

Wallet refund scenarios:

| Scenario | Wallet action |
|---|---|
| Original wallet payment captured | Create wallet refund or reversal through Wallet, Transaction and Ledger. |
| Original wallet reservation still active | Release reservation; this is not a refund. |
| External payment refunded to internal balance by approved policy | Deposit refund balance through Wallet and Ledger. |
| Mixed wallet + external payment | Refund wallet portion through Wallet/Ledger and external portion through provider. |
| Wallet is frozen | Refund and release may proceed when policy allows; outgoing spending stays blocked. |
| Wallet is closed | Reopen through approved command or create a new wallet according to future policy. |

Wallet rules:

- Order never mutates Wallet projection directly;
- Payment Engine or future Refund Engine never mutates Wallet projection directly;
- wallet refund must create or reference Transaction and Ledger records before projection changes become authoritative;
- Wallet projection changes are derived from Ledger events;
- wallet refund events include stable IDs and must not expose provider secrets;
- Wallet balances are not reconstructed from Order or Payment UI state.

## 16.6 Payment Provider Interaction

External refunds are executed through Payment Provider adapters, not directly by Order.

Provider interaction rules:

- refund to original external method is preferred when provider and business policy allow it;
- provider refund command must reference the platform `payment_id`, provider payment reference, method line, amount, currency and idempotency key;
- provider refund amount must equal the approved method-line refund amount;
- provider partial refund is allowed only when provider capability and product policy allow it;
- provider refund status is translated into platform refund states before other domains consume it;
- provider callbacks must be verified, deduplicated and correlated with platform refund IDs;
- provider failures, timeouts or ambiguous responses trigger reconciliation or manual review;
- provider secrets, raw card data, raw webhook payloads and access tokens are forbidden in Order records and events.

Provider refund flow:

```text
RefundRequested
->
Payment Engine validates payment and method line
->
Provider adapter sends refund command with idempotency key
->
Provider callback or status poll confirms outcome
->
Payment Engine maps provider result
->
Ledger records refund
->
RefundCompleted or RefundFailed
```

Provider status alone is not final platform financial truth until it is reconciled with Ledger policy.

## 16.7 Event Publication

Refund publishes domain and integration events after accepted state changes and financial facts.

Order refund events:

| Event | Produced after | Meaning |
|---|---|---|
| `RefundStarted` | paid active state -> `RefundPending` | Order accepted that refund compensation is required. |
| `RefundCompleted` | `RefundPending -> Refunded` | Order accepted refund completion and closed as refunded. |

Related finance events may include:

- `RefundRequested`;
- `RefundCompleted`;
- `RefundFailed`;
- `PaymentManualReviewRequested`;
- `LedgerEntryRecorded`;
- `WalletRefunded`;
- `WalletBalanceChanged`;
- `BonusRedemptionReversed`;
- `SupportCaseCreated`;
- `NotificationRequested`.

Event rules:

- refund events are facts, not commands;
- refund publishes domain events after accepted Order state changes;
- financial refund events are published only after the owning finance domain accepts the financial fact;
- event payloads include `order_id`, `payment_id`, `refund_id`, `transaction_id`, `ledger_entry_ids`, method lines, amount, currency, actor, reason, correlation ID, causation ID and idempotency key when available;
- refund event payloads must not expose provider secrets, payment credentials, raw card data, raw webhook payloads or unnecessary personal data;
- duplicate refund command retries must not duplicate `RefundStarted`, `RefundCompleted`, Ledger entries or provider refunds;
- replay rebuilds refund projections but must not reissue provider, wallet, bonus or machine side effects.

## 16.8 Audit

Refund audit must reconstruct why money or value was returned, who approved it, which original facts were compensated and whether the process completed.

Required audit fields:

- `refund_id`;
- `order_id`;
- `order_number`;
- `customer_id` when allowed;
- `from_state`;
- `to_state`;
- `refund_type`;
- `refund_reason`;
- `refund_amount`;
- `currency`;
- `refund_scope` such as `full`, `partial`, `method_line`, `goodwill` or `support`;
- `payment_id`;
- `payment_method_line_id`;
- `provider_refund_reference` when applicable and safe;
- `transaction_id`;
- `ledger_entry_ids`;
- `wallet_id` and wallet operation IDs when applicable;
- `bonus_redemption_id` or reversal references when applicable;
- `machine_id`, `queue_entry_id` or `machine_operation_id` when applicable;
- actor, operator ID or support ID;
- command ID;
- event IDs;
- correlation ID;
- causation ID;
- idempotency key;
- reconciliation status;
- failure reason when applicable;
- `occurred_at`;
- `recorded_at`.

Audit rules:

- every refund request, approval, rejection, provider result and completion is auditable;
- sensitive rejected refund commands are audited;
- operator and support refunds require actor ID, role authorization and reason;
- fraud or risk overrides require reason and policy reference;
- audit records never contain provider secrets, payment credentials, raw card data or unnecessary personal data;
- historical Order snapshots and Ledger entries remain visible and immutable for support and reporting.

## 16.9 Fraud Prevention

Refund is financially sensitive and requires explicit fraud prevention.

Required controls:

- idempotency keys for every refund command and provider side effect;
- maximum refundable amount check against captured amount minus previous refunds;
- method-line attribution checks for mixed payment refunds;
- duplicate refund detection by `order_id`, `payment_id`, method line, amount, currency and reason;
- refund velocity checks by customer, payment method, operator, device, machine and provider reference where legally allowed;
- operator role permissions and reason codes for manual refunds;
- support approval workflow for goodwill, post-completion and ambiguous machine-outcome refunds;
- provider webhook verification and deduplication;
- Ledger reconciliation before refund completion;
- monitoring for stuck `RefundPending`, repeated refund failures, refund spikes and provider/Ledger divergence;
- personal data minimization in events and audit records.

Fraud rules:

- fraud review may block, hold or route refund to manual review according to approved policy;
- fraud review must not rewrite original payment, Order snapshots or Ledger facts;
- confirmed correction uses new refund, adjustment or support workflow records;
- UI cannot approve or calculate refund eligibility by itself.

## 16.10 Refund Architecture Principles

Refund architecture follows these principles:

1. Refund is a compensating financial process.
2. Refund starts only after captured financial value exists.
3. Refund never edits historical ledger records.
4. Refund is represented by new financial transactions and Ledger entries.
5. Refund references original Order, Payment, method-line and Ledger facts.
6. Full refund and partial refund are explicit policy decisions.
7. Mixed payment refund preserves method-line attribution.
8. Wallet refund is handled through Wallet, Transaction and Ledger contracts.
9. External refund is handled through Payment Provider adapters.
10. Provider statuses are translated into platform facts before consumers use them.
11. Refund publishes domain and integration events after accepted facts.
12. Refund is fully auditable, including rejected and failed sensitive commands.
13. Refund commands and provider calls are idempotent.
14. Fraud prevention and manual review protect refund operations.
15. Terminal Order states remain immutable; post-completion refunds reference the completed order.
16. UI does not decide refund amount, eligibility, provider outcome or financial truth.

---

# 17. Event Interaction

Order publishes business events after accepted lifecycle changes and accepted order checkpoints.

Events follow `docs/architecture/EVENT_PLATFORM.md`. The canonical Order event catalog is documented in `docs/tasks/ORDER-004_ORDER_EVENTS.md`.

Core event rule:

```text
one accepted Order transition or checkpoint
->
one persisted Order state/audit record
->
one Order business event
```

Every accepted Order state transition emits exactly one business event. Duplicate commands, retries, rejected commands and publication retries must not create additional business events for the same accepted transition.

Canonical Order event catalog:

| Event | Produced after | Meaning |
|---|---|---|
| `OrderCreated` | none -> `Draft` | Order aggregate was created from accepted checkout context. |
| `OrderConfigured` | `Draft -> Configured` | Configuration snapshot was accepted by Order. |
| `OrderValidated` | `Configured -> Configured` checkpoint | Order validation, availability and eligibility context was accepted before pricing. |
| `PriceCalculated` | `Configured -> Priced` | Pricing snapshot was accepted by Order. |
| `DiscountApplied` | `Priced -> Discounted` | Discount result and payable amount were accepted by Order. |
| `BonusReserved` | `Discounted -> BonusReserved` | Bonus reservation reference was accepted by Order. |
| `PaymentStarted` | `Discounted -> PaymentPending` or `BonusReserved -> PaymentPending` | Payment settlement may start from the accepted payable amount. |
| `PaymentConfirmed` | `PaymentPending -> Paid` | Payment completion was accepted under Payment and Ledger policy. |
| `OrderQueued` | `Paid -> Queued` | Machine fulfillment queue entry was accepted. |
| `PreparationStarted` | `Queued -> Preparing` | Machine preparation start was accepted. |
| `DispensingStarted` | `Preparing -> Dispensing` | Machine dispensing start was accepted. |
| `OrderCompleted` | `Dispensing -> Completed` | Order was fulfilled and closed. |
| `OrderCancelled` | unpaid active state -> `Cancelled` | Order was stopped before captured payment existed. |
| `RefundStarted` | paid active state -> `RefundPending` | Refund compensation was started for a paid order. |
| `RefundCompleted` | `RefundPending -> Refunded` | Refund compensation was completed and the order was closed as refunded. |
| `OrderExpired` | unpaid active state -> `Expired` | Order expired before captured payment existed. |

Order event payloads use the Event Platform envelope with:

- `event_id`;
- `event_name`;
- `event_version`;
- `event_type`;
- `source_domain`;
- `occurred_at`;
- `aggregate_type`;
- `aggregate_id`;
- `correlation_id`;
- `causation_id`;
- `actor`;
- `payload`;
- `metadata`.

Minimal Order event payload:

```json
{
  "order_id": "order_01JZ0000000000000000000000",
  "order_number": "UTM-20260702-000001",
  "customer_id": "customer_01JZ0000000000000000000000",
  "channel": "miniapp",
  "from_state": "PaymentPending",
  "to_state": "Paid",
  "state_version": 7,
  "state_reason": "payment_confirmed",
  "gross_amount": 130,
  "discount_amount": 33,
  "payable_amount": 97,
  "currency": "RUB",
  "payment_id": "payment_01JZ0000000000000000000000",
  "machine_id": "machine_01JZ0000000000000000000000",
  "correlation_id": "checkout_01JZ0000000000000000000000",
  "causation_id": "evt_01JZ0000000000000000000000",
  "idempotency_key": "order_01JZ_payment_confirmed_payment_01JZ"
}
```

Event rules:

- events are facts, not commands;
- event names use English PascalCase;
- payload fields use snake_case;
- payloads include stable semantic IDs and snapshot references;
- `source_domain` must identify Order Platform when the Order Platform publishes the event;
- `aggregate_type` is `order` and `aggregate_id` is the stable `order_id`;
- payloads must not expose payment credentials, provider secrets, raw webhook payloads or unnecessary personal data;
- event contract versions are immutable once consumers depend on them;
- consumers must be idempotent and tolerate at-least-once delivery;
- per-order ordering is based on `state_version` and event occurrence time;
- global ordering across orders or domains is not assumed;
- replay rebuilds projections and analytics, but must not repeat payments, refunds, bonus movements or machine commands;
- Event Storage does not replace Order repository or Finance Ledger.

---

# 18. Audit

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

# 19. Idempotency

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

# 20. Retry Strategy

Order retry strategy coordinates recoverable cross-domain operations without duplicating side effects.

Retry rules:

- retry only idempotent operations automatically;
- use bounded exponential backoff for transient failures;
- do not create duplicate payments, duplicate bonus reservations or duplicate machine commands;
- check current domain state before retrying an external command;
- move repeated failures to support review or dead-letter handling;
- preserve original correlation and causation IDs;
- publish the lifecycle business event only once for the accepted transition; retry attempts are audit or operational records unless a later task promotes them to a formal business event.

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

# 21. Error Handling

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
- invalid transition commands are audited but do not publish lifecycle business events;
- user-facing messages are handled by channel or Notification Engine, not hardcoded in Order domain.

---

# 22. Security

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

# 23. Architecture Principles

Order architecture follows these principles:

1. Order is the business aggregate.
2. Order owns snapshots.
3. Order never recalculates historical prices.
4. Order never references mutable catalog data as historical truth.
5. Order publishes business events after accepted transitions and checkpoints.
6. Configuration, Pricing and Discount engines calculate; Order records accepted results.
7. Bonus Engine owns bonus rights; Order stores reservation references.
8. Payment Engine owns payment lifecycle; Order stores payment binding.
9. Ledger remains the source of truth for financial history.
10. Machine Platform owns hardware execution; Order owns business fulfillment status.
11. Every state transition is explicit and auditable.
12. Every accepted Order transition emits exactly one business event.
13. Every side-effect operation is idempotent.
14. Retries reconcile before repeating side effects.
15. Corrections are compensating operations, not silent edits.
16. UI does not calculate order totals or infer fulfillment state.
17. Order events are stable contracts for CRM, Notification, Analytics, Machine and Finance consumers.
18. Historical support and reporting use order snapshots, not live Product Catalog.
19. Order Platform remains independent from frontend, provider APIs and hardware protocols.
20. Only paid orders can enter fulfillment.
21. Fulfillment never changes financial data.
22. Fulfillment stages are event-driven, auditable and idempotent.
23. Machine receives only confirmed paid orders.
24. Dispatch never changes financial data.
25. Dispatch never changes Order state directly.
26. Dispatch publishes technical and business events after accepted dispatch facts.
27. Dispatch commands, acknowledgements, timeouts, retries and recovery actions are auditable.
28. Dispatch retries reconcile before repeating machine side effects.
29. Cancellation is a business process, not a UI-only action.
30. Cancellation never edits historical transactions or immutable Order snapshots.
31. Unpaid cancellation closes as `Cancelled`; paid cancellation or stop moves through refund compensation.
32. Cancellation may trigger Refund Engine or Payment Engine refund flow.
33. Cancellation always publishes business events after accepted business decisions.
34. Machine, Payment, Wallet, Bonus and Ledger effects remain owned by their domains.
35. Refund is a compensating financial process, not a mutation of the original sale.
36. Refund never edits historical Ledger records.
37. Refund is represented by new financial transactions and Ledger entries.
38. Refund preserves payment method-line attribution, especially for mixed payments.
39. Wallet refund effects are projected from Ledger through Wallet contracts.
40. External provider refunds are isolated behind Payment Provider adapters.
41. Refund publishes domain and integration events after accepted facts.
42. Refund is fully auditable and protected by fraud controls.

---

# Documentation Scope

This document is architecture-only.

It does not introduce JavaScript implementation, frontend changes, routes, styles, package changes, database migrations, payment provider integration, machine integration, CRM screens, notification templates or cloud infrastructure.
