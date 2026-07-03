# ORDER-003 Order State Machine

Status: Architecture documented
Version: 0.1
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-03
Last updated: 2026-07-03

Related documents:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/architecture/CHECKOUT.md`
- `docs/architecture/EVENT_PLATFORM.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/WALLET.md`
- `docs/architecture/LEDGER.md`
- `docs/tasks/EPIC-230_ORDER_PLATFORM.md`
- `docs/tasks/ORDER-001_ORDER_DOMAIN.md`
- `docs/tasks/ORDER-002_CHECKOUT_PIPELINE.md`

---

# Goal

Document the complete Order State Machine for the first purchase flow.

ORDER-003 is documentation only. It defines allowed Order lifecycle states, transition rules, invalid transitions, event publication, compensation actions, idempotency and audit requirements before any implementation work starts.

The state machine protects the MVP goal:

```text
A customer can select a dessert, pay for it and receive it from a vending machine.
```

---

# 1. State Model

The Order state is the business purchase lifecycle state.

It is not:

- payment provider status;
- wallet reservation status;
- bonus reservation status;
- Ledger entry status;
- machine hardware status;
- UI progress state.

Canonical state list:

| State | Meaning | Terminal |
|---|---|---|
| `Draft` | Order aggregate exists from accepted checkout intent, but product configuration snapshot is not accepted yet. | No |
| `Configured` | Configuration snapshot is accepted. | No |
| `Priced` | Gross pricing snapshot is accepted. | No |
| `Discounted` | Discount snapshot and final payable amount are accepted. | No |
| `BonusReserved` | Bonus reservation reference is accepted when bonuses are used. | No |
| `PaymentPending` | Payment may be created or continued from the accepted payable amount. | No |
| `Paid` | Payment completed under Payment Engine and Ledger policy. | No |
| `Queued` | Machine Platform accepted the fulfillment queue entry. | No |
| `Preparing` | Machine preparation started. | No |
| `Dispensing` | Machine dispensing started. | No |
| `Completed` | Product was dispensed or fulfilled by approved policy. | Yes |
| `Cancelled` | Unpaid order was stopped intentionally before captured payment existed. | Yes |
| `RefundPending` | Captured payment must be compensated before closing. | No |
| `Refunded` | Captured payment was fully compensated. | Yes |
| `Expired` | Unpaid order exceeded its allowed checkout, reservation or payment window. | Yes |

State model fields:

| Field | Purpose |
|---|---|
| `order_id` | Stable Order aggregate identity. |
| `state` | Current canonical Order state. |
| `state_version` | Monotonic version incremented by accepted lifecycle transitions. |
| `previous_state` | Previous state for audit and transition validation. |
| `state_reason` | Business reason code for the accepted transition. |
| `state_changed_at` | UTC timestamp for the accepted transition. |
| `correlation_id` | Business flow correlation ID, usually checkout or order flow ID. |
| `causation_id` | Command ID, event ID or operation that caused the transition. |
| `idempotency_key` | Stable key for deduplicating commands and retries. |
| `actor` | Customer, system, machine, payment provider, operator or support actor. |

State labels use PascalCase in architecture documentation. A future persisted enum may use snake_case equivalents, but the state meaning and allowed transitions must remain identical.

---

# 2. Initial State

Initial state:

```text
Draft
```

Business rule:

- an Order enters `Draft` only after Checkout accepts a checkout intent and creates one Order aggregate identity;
- `Draft` is already auditable Order state, not a hidden UI-only selection state;
- product selection before accepted checkout intent remains Checkout/channel state and is not part of the Order State Machine;
- entering `Draft` publishes `OrderDraftCreated`.

Initial transition:

| From | To | Business reason | Event |
|---|---|---|---|
| none | `Draft` | Create one auditable order intent from accepted checkout context. | `OrderDraftCreated` |

---

# 3. Terminal States

Terminal states:

- `Completed`;
- `Cancelled`;
- `Refunded`;
- `Expired`.

Terminal state rules:

- terminal states are immutable;
- terminal states cannot transition to any other Order state;
- terminal states cannot retry side effects inside the Order State Machine;
- support corrections after terminal closure are new compensating operations, not edits to the Order state;
- post-completion goodwill refunds use a separate Refund or Support workflow that references the immutable `Completed` order.

Terminal meaning:

| State | Closure reason | Financial meaning |
|---|---|---|
| `Completed` | Customer received the product or fulfillment was closed by approved policy. | Captured payment remains valid. |
| `Cancelled` | Order stopped before captured payment existed. | No refund is needed; temporary reservations must be released. |
| `Refunded` | Paid order was compensated. | Refund is complete and Ledger-backed. |
| `Expired` | Time window expired before captured payment existed. | No refund is needed; temporary reservations must be released. |

---

# 4. Allowed Transitions

Every accepted transition has:

- one business reason;
- one resulting state;
- one state version increment;
- one audit entry;
- one domain event.

## 4.1 Main Purchase Flow

| From | To | Business reason | Event |
|---|---|---|---|
| none | `Draft` | Create a durable Order identity from accepted checkout intent. | `OrderDraftCreated` |
| `Draft` | `Configured` | Configuration Engine accepted product, flavor, size, syrup, topping and recipe/media references. | `OrderConfigured` |
| `Configured` | `Priced` | Pricing Engine accepted gross amount, currency, pricing version and line details. | `OrderPriced` |
| `Priced` | `Discounted` | Discount Engine accepted discount lines, zero-discount decision when applicable and payable amount. | `OrderDiscounted` |
| `Discounted` | `BonusReserved` | Bonus Engine reserved selected bonus rights before settlement. | `OrderBonusReserved` |
| `Discounted` | `PaymentPending` | No bonus reservation is required and payment can start from accepted payable amount. | `OrderPaymentPending` |
| `BonusReserved` | `PaymentPending` | Bonus reservation is accepted and payment can start from accepted payable amount. | `OrderPaymentPending` |
| `PaymentPending` | `Paid` | Payment Engine published completed settlement and Ledger policy is satisfied. | `OrderPaid` |
| `Paid` | `Queued` | Machine Platform accepted one fulfillment queue entry for the paid order item. | `OrderQueued` |
| `Queued` | `Preparing` | Machine Platform confirmed preparation started. | `OrderPreparing` |
| `Preparing` | `Dispensing` | Machine Platform confirmed dispensing started. | `OrderDispensing` |
| `Dispensing` | `Completed` | Machine Platform or approved fulfillment policy confirmed product delivery. | `OrderCompleted` |

## 4.2 Cancellation Transitions

Cancellation is allowed only before captured payment exists.

| From | To | Business reason | Event |
|---|---|---|---|
| `Draft` | `Cancelled` | Customer or system stops the order before accepted configuration. | `OrderCancelled` |
| `Configured` | `Cancelled` | Customer or system stops the order after configuration but before pricing commitment. | `OrderCancelled` |
| `Priced` | `Cancelled` | Customer or system stops the order after pricing but before final payable amount or settlement. | `OrderCancelled` |
| `Discounted` | `Cancelled` | Customer or system stops the order after payable amount acceptance but before payment start. | `OrderCancelled` |
| `BonusReserved` | `Cancelled` | Customer or system stops the order and reserved bonus rights must be released. | `OrderCancelled` |
| `PaymentPending` | `Cancelled` | Payment is cancelled or declined and reconciliation confirms no captured payment exists. | `OrderCancelled` |

Cancellation from `Paid`, `Queued`, `Preparing` or `Dispensing` is invalid. A paid order that must be stopped moves to `RefundPending`.

## 4.3 Timeout Transitions

Timeout can close only unpaid orders.

| From | To | Business reason | Event |
|---|---|---|---|
| `Draft` | `Expired` | Checkout intent exceeded its allowed assembly window. | `OrderExpired` |
| `Configured` | `Expired` | Configuration acceptance expired before pricing/payment continuation. | `OrderExpired` |
| `Priced` | `Expired` | Pricing snapshot exceeded its validity window before discount/payment continuation. | `OrderExpired` |
| `Discounted` | `Expired` | Payable amount exceeded its validity window before payment continuation. | `OrderExpired` |
| `BonusReserved` | `Expired` | Bonus reservation or checkout window expired before payment continuation. | `OrderExpired` |
| `PaymentPending` | `Expired` | Payment confirmation window expired and reconciliation confirms no captured payment exists. | `OrderExpired` |

Timeout from `Paid`, `Queued`, `Preparing` or `Dispensing` is invalid. Paid timeout scenarios schedule retry, request support or move to `RefundPending`.

## 4.4 Refund Transitions

Refund transitions are compensation for captured payment.

| From | To | Business reason | Event |
|---|---|---|---|
| `Paid` | `RefundPending` | Paid order cannot enter fulfillment or must be compensated before machine work starts. | `OrderRefundPending` |
| `Queued` | `RefundPending` | Machine queue cannot be fulfilled after retry/reconciliation policy is exhausted. | `OrderRefundPending` |
| `Preparing` | `RefundPending` | Machine preparation cannot complete and compensation is required. | `OrderRefundPending` |
| `Dispensing` | `RefundPending` | Dispensing failed or cannot be verified and compensation is required. | `OrderRefundPending` |
| `RefundPending` | `Refunded` | Payment Engine confirms full refund and Ledger-backed compensation exists. | `OrderRefunded` |

`Completed -> RefundPending` is invalid because `Completed` is terminal. A refund after completion is represented by a separate refund/support case referencing the completed order.

---

# 5. Invalid Transitions

Invalid transition attempts are rejected commands, not accepted lifecycle transitions.

Rules:

- rejected transitions do not change `state`;
- rejected transitions do not increment `state_version`;
- rejected transitions do not publish normal lifecycle events;
- security-sensitive or support-relevant rejected attempts may publish `OrderTransitionRejected` as an audit event;
- rejected attempts must be auditable with actor, reason and requested transition.

Invalid transition examples:

| Invalid transition | Business reason |
|---|---|
| `Draft -> Priced` | Configuration snapshot must be accepted before pricing. |
| `Draft -> PaymentPending` | Configuration, pricing and discount results are missing. |
| `Configured -> Discounted` | Gross pricing snapshot is missing. |
| `Priced -> PaymentPending` | Discount decision and payable amount are missing. |
| `Discounted -> Paid` | Payment settlement has not completed. |
| `BonusReserved -> Paid` | Payment settlement has not started or completed. |
| `PaymentPending -> Queued` | Machine queue can start only after `Paid`. |
| `Paid -> Preparing` | Queue acceptance must exist before preparation. |
| `Queued -> Dispensing` | Preparation start must be confirmed before dispensing. |
| `Preparing -> Completed` | Dispensing or approved fulfillment closure is missing. |
| unpaid active state -> `RefundPending` | There is no captured payment to refund. |
| paid active state -> `Cancelled` | Captured payment requires refund compensation instead of cancellation. |
| paid active state -> `Expired` | Expiry cannot close a captured-payment order. |
| `Completed -> RefundPending` | Completed is terminal; use separate support/refund workflow. |
| `Cancelled -> PaymentPending` | Cancelled is terminal; create a new checkout/order. |
| `Refunded -> Paid` | Refunded is terminal and cannot be reopened. |
| `Expired -> PaymentPending` | Expired is terminal; create a new checkout/order. |

---

# 6. Payment Transitions

Order reacts to Payment Engine facts, but Payment Engine owns payment lifecycle.

Payment-related Order transitions:

| Payment fact or command | Allowed Order transition | Business reason | Event |
|---|---|---|---|
| Settlement can start without bonus reservation | `Discounted -> PaymentPending` | Accepted payable amount is ready for payment. | `OrderPaymentPending` |
| Settlement can start after bonus reservation | `BonusReserved -> PaymentPending` | Bonus rights are held and payable amount is ready. | `OrderPaymentPending` |
| `PaymentCompleted` and Ledger policy satisfied | `PaymentPending -> Paid` | Captured or settled financial fact is accepted. | `OrderPaid` |
| `PaymentFailed` with retry allowed | `PaymentPending -> PaymentPending` | Order remains payable for a new payment attempt. | `OrderPaymentRetryScheduled` |
| `PaymentCancelled` before capture | `PaymentPending -> Cancelled` | Settlement stopped and no captured payment exists. | `OrderCancelled` |
| `PaymentExpired` before capture | `PaymentPending -> Expired` | Payment window closed and no captured payment exists. | `OrderExpired` |
| Payment ambiguity | no state change until reconciled | Avoid duplicate settlement or false cancellation. | `OrderPaymentReconciliationRequested` |

Payment rules:

- Order must not recalculate payable amount after payment starts;
- payment amount must match accepted discount snapshot payable amount;
- provider success alone is not enough when Ledger policy requires financial recording;
- payment failure does not mutate pricing, discount or bonus rules;
- payment callbacks are deduplicated by Payment Engine and Order idempotency keys;
- captured payment prevents `Cancelled` and `Expired` closure.

---

# 7. Machine Transitions

Order owns business fulfillment status. Machine Platform owns queue, hardware commands, telemetry and preparation outcome.

Machine-related Order transitions:

| Machine fact or command | Allowed Order transition | Business reason | Event |
|---|---|---|---|
| Queue entry accepted | `Paid -> Queued` | Paid order has one accepted machine operation. | `OrderQueued` |
| Preparation started | `Queued -> Preparing` | Machine began recipe preparation. | `OrderPreparing` |
| Dispensing started | `Preparing -> Dispensing` | Machine began product dispensing. | `OrderDispensing` |
| Product dispensed or fulfilled | `Dispensing -> Completed` | Customer product delivery is confirmed. | `OrderCompleted` |
| Queue timeout with retry allowed | `Paid -> Paid` or `Queued -> Queued` | Machine state must be reconciled before repeating side effect. | `OrderMachineRetryScheduled` |
| Machine failure after payment | paid active state -> `RefundPending` | Product cannot be fulfilled and captured payment needs compensation. | `OrderRefundPending` |

Machine rules:

- Order does not send low-level hardware commands directly;
- queue entry must be idempotent by `order_id`, `order_item_id`, `machine_id` and recipe snapshot;
- duplicate machine events must not duplicate transitions;
- machine timeout does not prove failure until Machine Platform state is reconciled;
- machine failure must not edit payment history.

---

# 8. Cancellation Transitions

Cancellation closes unpaid orders and releases temporary obligations.

Allowed cancellation sources:

- `Draft`;
- `Configured`;
- `Priced`;
- `Discounted`;
- `BonusReserved`;
- `PaymentPending` when payment reconciliation confirms no captured payment exists.

Cancellation actors:

- customer;
- system;
- operator;
- payment provider through Payment Engine fact;
- checkout timeout controller after reconciliation.

Cancellation compensation:

- release bonus reservation through Bonus Engine;
- release coupon or promotion reservation through Discount/Promotion owner when applicable;
- cancel unfinished payment through Payment Engine;
- release wallet reservation through Wallet/Ledger policy;
- publish `OrderCancelled`;
- keep audit reason and actor.

Cancellation is not refund. If captured payment exists, the Order must move to `RefundPending`.

---

# 9. Refund Transitions

Refund handles captured payment compensation for orders that cannot or should not complete.

Refund rules:

- refund never edits the original payment;
- refund never deletes Ledger entries;
- refund references original `order_id`, `payment_id`, method lines and Ledger entries;
- refund amount cannot exceed captured amount minus previous refunds;
- refund completion requires Payment Engine and Ledger-backed facts;
- full compensation closes the Order as `Refunded`;
- partial refund policy is future work and must not silently close the Order as `Refunded`.

Refund transition details:

| From | To | Compensation action | Event |
|---|---|---|---|
| `Paid` | `RefundPending` | Request refund before fulfillment starts. | `OrderRefundPending` |
| `Queued` | `RefundPending` | Cancel/reconcile machine operation, then request refund. | `OrderRefundPending` |
| `Preparing` | `RefundPending` | Stop or reconcile machine operation when safe, then request refund. | `OrderRefundPending` |
| `Dispensing` | `RefundPending` | Reconcile dispensed amount and request refund by policy. | `OrderRefundPending` |
| `RefundPending` | `Refunded` | Payment refund completed and Ledger entry recorded. | `OrderRefunded` |

---

# 10. Timeout Transitions

Timeouts are explicit business events.

Timeout rules:

- timeout does not automatically mean external side effects failed;
- Payment and Machine outcomes must be reconciled before closing or retrying;
- unpaid timeout may close as `Expired`;
- paid timeout cannot close as `Expired`;
- temporary reservations are released only by their owning domains.

Timeout matrix:

| Timeout | Allowed transition | Business reason | Compensation |
|---|---|---|---|
| Checkout assembly timeout | `Draft -> Expired` | Customer did not complete configuration in time. | None unless reservation exists. |
| Configuration validity timeout | `Configured -> Expired` | Accepted configuration became stale before pricing. | None unless reservation exists. |
| Pricing validity timeout | `Priced -> Expired` | Price snapshot became stale before payable amount acceptance. | None unless reservation exists. |
| Discount validity timeout | `Discounted -> Expired` | Payable amount became stale before settlement. | Release coupon/promotion reservation when applicable. |
| Bonus reservation timeout | `BonusReserved -> Expired` | Bonus reservation expired before settlement. | Release or expire bonus reservation through Bonus Engine. |
| Payment confirmation timeout | `PaymentPending -> Expired` | No captured payment exists after reconciliation. | Cancel payment attempt, release bonus/wallet/coupon reservations. |
| Machine queue timeout | same-state retry or paid active state -> `RefundPending` | Machine outcome is missing after payment. | Reconcile machine operation before retry or refund. |
| Fulfillment timeout | same-state retry or paid active state -> `RefundPending` | Fulfillment cannot complete within policy. | Stop/reconcile machine, then refund if required. |

---

# 11. Retry Transitions

Retry transitions are accepted same-state lifecycle events when the business state remains valid but an external side effect needs safe repetition or reconciliation.

Retry rules:

- retry only idempotent operations automatically;
- retry must preserve original correlation and causation IDs;
- retry must read current Order, Payment, Bonus, Wallet, Ledger or Machine state before repeating side effects;
- retry must not create duplicate payments, duplicate bonus reservations or duplicate machine operations;
- retry attempts publish retry events but do not publish the original lifecycle event again;
- terminal states do not retry.

Allowed retry transitions:

| From | To | Business reason | Event |
|---|---|---|---|
| `BonusReserved` | `BonusReserved` | Confirm or retry bonus reservation status without creating a second reservation. | `OrderBonusReservationRetryScheduled` |
| `PaymentPending` | `PaymentPending` | Start a new allowed payment attempt or reconcile ambiguous payment state. | `OrderPaymentRetryScheduled` |
| `Paid` | `Paid` | Retry fulfillment request after confirming no queue entry exists. | `OrderMachineRetryScheduled` |
| `Queued` | `Queued` | Reconcile or retry queue status without duplicate machine operation. | `OrderMachineRetryScheduled` |
| `Preparing` | `Preparing` | Reconcile machine preparation telemetry or retry status read. | `OrderMachineRetryScheduled` |
| `Dispensing` | `Dispensing` | Reconcile dispensing completion or retry status read. | `OrderMachineRetryScheduled` |
| `RefundPending` | `RefundPending` | Retry refund operation or refund status reconciliation. | `OrderRefundRetryScheduled` |

Retry events are domain events because they are accepted operational facts, but they do not change the canonical Order state.

---

# 12. Event Publication

Every accepted lifecycle transition publishes exactly one Order domain event.

Event rules:

- events are facts, not commands;
- event names use English PascalCase;
- payload fields use snake_case;
- payloads include stable IDs;
- payloads include `from_state`, `to_state`, `state_version`, `state_reason`, `correlation_id`, `causation_id` and `idempotency_key`;
- payloads must not include payment credentials, provider secrets, raw card data or unnecessary personal data;
- event publishing must be idempotent;
- event delivery follows at-least-once delivery with idempotent consumers;
- Event Storage does not replace Order repository or Finance Ledger.

Required Order events:

| Event | Produced by transition |
|---|---|
| `OrderDraftCreated` | none -> `Draft` |
| `OrderConfigured` | `Draft -> Configured` |
| `OrderPriced` | `Configured -> Priced` |
| `OrderDiscounted` | `Priced -> Discounted` |
| `OrderBonusReserved` | `Discounted -> BonusReserved` |
| `OrderPaymentPending` | `Discounted -> PaymentPending`, `BonusReserved -> PaymentPending` |
| `OrderPaid` | `PaymentPending -> Paid` |
| `OrderQueued` | `Paid -> Queued` |
| `OrderPreparing` | `Queued -> Preparing` |
| `OrderDispensing` | `Preparing -> Dispensing` |
| `OrderCompleted` | `Dispensing -> Completed` |
| `OrderCancelled` | unpaid active state -> `Cancelled` |
| `OrderExpired` | unpaid active state -> `Expired` |
| `OrderRefundPending` | paid active state -> `RefundPending` |
| `OrderRefunded` | `RefundPending -> Refunded` |
| `OrderPaymentRetryScheduled` | `PaymentPending -> PaymentPending` |
| `OrderMachineRetryScheduled` | paid machine retry self-transition |
| `OrderRefundRetryScheduled` | `RefundPending -> RefundPending` |
| `OrderTransitionRejected` | rejected command when audit policy requires publication |

Minimal event payload:

```json
{
  "order_id": "order_01JZ0000000000000000000000",
  "order_number": "UTM-20260703-000001",
  "from_state": "PaymentPending",
  "to_state": "Paid",
  "state_version": 7,
  "state_reason": "payment_completed",
  "customer_id": "customer_01JZ0000000000000000000000",
  "channel": "miniapp",
  "machine_id": "machine_01JZ0000000000000000000000",
  "payment_id": "payment_01JZ0000000000000000000000",
  "gross_amount": 130,
  "discount_amount": 20,
  "payable_amount": 110,
  "currency": "RUB",
  "correlation_id": "checkout_01JZ0000000000000000000000",
  "causation_id": "evt_01JZ0000000000000000000000",
  "idempotency_key": "order_01JZ_payment_completed_payment_01JZ"
}
```

---

# 13. Compensation Actions

Compensation actions are explicit operations in the owning domains. They are not silent edits to Order, Payment, Wallet, Bonus or Ledger history.

Compensation matrix:

| Order situation | Required compensation | Owning domain |
|---|---|---|
| `BonusReserved -> Cancelled` | Release bonus reservation. | Bonus Engine |
| `BonusReserved -> Expired` | Release or expire bonus reservation. | Bonus Engine |
| `PaymentPending -> Cancelled` | Cancel unfinished payment, release wallet and bonus reservations. | Payment, Wallet, Bonus |
| `PaymentPending -> Expired` | Reconcile payment, cancel unfinished attempt, release reservations. | Payment, Wallet, Bonus |
| `Paid -> RefundPending` | Request refund against captured payment. | Payment Engine |
| `Queued -> RefundPending` | Reconcile or cancel queue entry, then refund. | Machine, Payment |
| `Preparing -> RefundPending` | Stop or reconcile machine operation when safe, then refund. | Machine, Payment |
| `Dispensing -> RefundPending` | Reconcile actual dispensing result, then refund by policy. | Machine, Payment |
| `RefundPending -> Refunded` | Record refund Ledger facts and publish completion. | Payment, Ledger |

Compensation rules:

- Order records compensation intent and outcome references;
- Payment handles cancellation and refund settlement;
- Wallet releases or refunds internal balance through Ledger-backed operations;
- Bonus Engine releases, redeems or reverses bonus rights according to its policy;
- Ledger remains the source of truth for financial history;
- Machine Platform owns safe stop, operation reconciliation and hardware recovery.

---

# 14. Idempotency

Every command that can affect state or side effects must be idempotent.

Required idempotency scopes:

| Operation | Recommended scope |
|---|---|
| Order creation | `checkout_intent_id + accepted_payload_hash` |
| State transition | `order_id + from_state + to_state + causation_id` |
| Snapshot acceptance | `order_id + operation_type + accepted_snapshot_hash` |
| Bonus reservation binding | `order_id + bonus_reservation_id + amount` |
| Payment binding | `order_id + payment_id + payable_amount + currency` |
| Payment completion handling | `order_id + payment_id + payment_event_id` |
| Machine queue request | `order_id + order_item_id + machine_id + recipe_id` |
| Machine event handling | `order_id + machine_operation_id + machine_event_id` |
| Refund request | `order_id + payment_id + refund_amount + refund_reason` |
| Event publication | `order_id + state_version + event_name` |

Rules:

- duplicate command with the same idempotency key and same semantic payload returns the existing result;
- duplicate command with the same idempotency key and conflicting payload is rejected;
- event publishing retries reuse the same event ID for the same accepted transition;
- external event replay must be deduplicated by external event ID and platform correlation IDs;
- retries must read current state before issuing side effects.

---

# 15. Audit Requirements

Every accepted transition records an audit entry.

Required audit fields:

- `order_id`;
- `from_state`;
- `to_state`;
- `state_version`;
- `state_reason`;
- `actor`;
- `channel`;
- `machine_id` when applicable;
- `payment_id` when applicable;
- `bonus_reservation_id` when applicable;
- `refund_id` when applicable;
- `command_id`;
- `event_id`;
- `correlation_id`;
- `causation_id`;
- `idempotency_key`;
- `accepted_snapshot_hash` when applicable;
- `occurred_at`;
- `recorded_at`;
- `operator_id` and support reason for operator actions.

Audit rules:

- rejected sensitive commands are audited;
- operator transitions require actor ID and reason;
- machine-originated transitions require trusted machine or adapter identity;
- payment-originated transitions require verified Payment Engine facts;
- audit records must not contain provider secrets, raw card data or unnecessary personal data;
- terminal state closure must preserve the final reason and compensation references.

---

# 16. Architecture Principles

ORDER-003 follows these principles:

1. Order is the business aggregate.
2. Order state is explicit and finite.
3. `Draft` is the only initial state.
4. `Completed`, `Cancelled`, `Refunded` and `Expired` are immutable terminal states.
5. Every accepted transition has a business reason.
6. Every accepted transition publishes a domain event.
7. Invalid transitions are rejected and audited when required.
8. Payment state belongs to Payment Engine.
9. Wallet state belongs to Wallet and Ledger-backed projection.
10. Bonus reservation state belongs to Bonus Engine.
11. Machine hardware state belongs to Machine Platform.
12. Ledger remains the source of truth for financial history.
13. Paid orders cannot be cancelled or expired; they require refund compensation when they cannot complete.
14. Refunds and corrections are compensating operations, not edits to original facts.
15. Retries reconcile before repeating side effects.
16. Idempotency is mandatory at every side-effect boundary.
17. UI derives state from Order, Payment and Machine facts; UI does not infer payment or fulfillment success.
18. Historical reporting uses Order snapshots and Ledger facts, not live catalog recalculation.

---

# 17. Acceptance Criteria

ORDER-003 is complete when:

- state model is documented;
- initial state is documented;
- terminal states are documented as immutable;
- allowed transitions are documented;
- invalid transitions are documented;
- payment transitions are documented;
- machine transitions are documented;
- cancellation transitions are documented;
- refund transitions are documented;
- timeout transitions are documented;
- retry transitions are documented;
- event publication is documented;
- compensation actions are documented;
- idempotency is documented;
- audit requirements are documented;
- architecture principles are documented;
- every accepted transition has a business reason;
- every accepted transition publishes a domain event;
- no application code is modified.

---

# 18. Out of Scope

ORDER-003 does not include:

- JavaScript implementation;
- frontend changes;
- Mini App UI changes;
- React component changes;
- database migrations;
- payment provider integration;
- YooKassa credentials;
- machine hardware commands;
- CRM screens;
- notification templates;
- cloud event bus implementation.

---

# 19. Future Recommendations

Recommended follow-up tasks:

1. Define formal Order command contracts.
2. Define formal Order event schemas and versions.
3. Add a `SupportReview` or `RecoveryRequired` state only if Product Owner approves it for paid exception handling.
4. Define partial refund policy before supporting partial fulfillment or partial compensation.
5. Define machine no-pickup and product-taken events before customer pickup UX is implemented.
6. Add state-machine test scenarios before implementation.
