# ORDER-006 Cancellation

Status: Architecture documented
Version: 0.1
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-03
Last updated: 2026-07-03

Related documents:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `docs/architecture/ARCHITECTURE_BASELINE_1_0.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/architecture/CHECKOUT.md`
- `docs/architecture/EVENT_PLATFORM.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/WALLET.md`
- `docs/architecture/LEDGER.md`
- `docs/tasks/EPIC-230_ORDER_PLATFORM.md`
- `docs/tasks/ORDER-001_ORDER_DOMAIN.md`
- `docs/tasks/ORDER-003_ORDER_STATE_MACHINE.md`
- `docs/tasks/ORDER-004_ORDER_EVENTS.md`
- `docs/tasks/ORDER-005_FULFILLMENT.md`

---

# Purpose

ORDER-006 defines cancellation as a formal business process for Order Platform.

Cancellation stops an order flow only through explicit domain rules, reconciliation, compensation and event publication. It is not a UI-only action, not a provider status and not a direct database edit.

Core rule:

```text
Cancellation never edits historical transactions.
Cancellation never edits immutable Order snapshots.
Cancellation always publishes business events after accepted business decisions.
```

ORDER-006 is documentation only. It introduces no application source code, frontend changes, UI changes, routes, styles, database migrations, payment provider integration or machine hardware integration.

---

# Business Value

Cancellation protects the first purchase flow from unsafe partial states.

Business value:

- customers can stop an unpaid order without creating hidden financial obligations;
- paid orders that cannot continue move into refund compensation instead of false cancellation;
- support can explain why an order stopped and what was released or refunded;
- finance can reconcile cancellation, refund, wallet, bonus and Ledger facts;
- machine operations can be stopped or reconciled without duplicate products;
- analytics and CRM receive consistent cancellation events;
- operators have auditable reason codes for sensitive cancellation decisions.

Cancellation supports the MVP goal by making the failed or stopped purchase path as explicit as the successful path.

---

# Architecture Scope

ORDER-006 covers:

- cancellation request sources;
- eligibility and authorization rules;
- allowed and forbidden cancellation points;
- unpaid cancellation closure;
- paid cancellation or stop through refund compensation;
- Payment, Wallet, Bonus, Ledger and Machine coordination;
- event flow;
- audit and monitoring requirements;
- failure and recovery strategy;
- future roadmap for Refund Engine and support workflows.

Out of scope:

- JavaScript implementation;
- frontend changes;
- Mini App UI changes;
- React component changes;
- database migrations;
- payment provider integration;
- machine firmware or hardware commands;
- CRM screens;
- notification templates;
- cloud event bus implementation;
- partial refund policy implementation.

---

# Cancellation Stages

Cancellation has its own lifecycle before it becomes an Order state transition or refund compensation flow.

| Stage | Meaning |
|---|---|
| `requested` | Customer, system, operator, support, Payment Engine, provider fact or risk process asks to stop the order. |
| `authorized` | Actor and permissions are validated for the cancellation command. |
| `eligibility_checked` | Order state is checked against cancellation and refund rules. |
| `payment_reconciled` | Payment Engine confirms whether captured funds exist when payment state is relevant or ambiguous. |
| `machine_reconciled` | Machine Platform confirms queue, preparation, dispensing or physical outcome when fulfillment may have started. |
| `side_effects_requested` | Owning domains receive release, cancel, refund, stop or reconciliation commands. |
| `accepted_as_cancelled` | No captured payment exists; Order can close as `Cancelled`. |
| `accepted_as_refund_pending` | Captured payment exists; Order moves to `RefundPending`. |
| `rejected` | Cancellation is forbidden or unsafe; state remains unchanged and audit is recorded. |
| `published` | Required business events are published through Event Platform. |

Unpaid cancellation path:

```text
requested
-> authorized
-> eligibility_checked
-> payment_reconciled when needed
-> side_effects_requested
-> Cancelled
-> OrderCancelled
```

Paid cancellation or stop path:

```text
requested
-> authorized
-> eligibility_checked
-> payment_reconciled
-> machine_reconciled when needed
-> RefundPending
-> RefundStarted
-> refund flow
-> RefundCompleted
-> Refunded
```

Rejected cancellation path:

```text
requested
-> authorized or rejected_by_authorization
-> eligibility_checked
-> rejected
-> audit record
```

---

# Allowed Cancellation Points

Allowed unpaid cancellation points:

| Order state | Cancellation result | Required coordination |
|---|---|---|
| `Draft` | `Cancelled` | No financial or machine side effect should exist. |
| `Configured` | `Cancelled` | No payment or machine side effect should exist. |
| `Priced` | `Cancelled` | Price snapshot remains historical draft context; no refund is needed. |
| `Discounted` | `Cancelled` | Release coupon or promotion reservation when applicable. |
| `BonusReserved` | `Cancelled` | Release bonus reservation through Bonus Engine. |
| `PaymentPending` | `Cancelled` only after no captured payment is confirmed | Cancel unfinished payment and release wallet, bonus or coupon reservations. |

Allowed paid stop points that become refund compensation:

| Order state | Order result | Required coordination |
|---|---|---|
| `Paid` | `RefundPending` | Refund captured payment when the order must stop before fulfillment starts. |
| `Queued` | `RefundPending` | Reconcile or cancel machine queue before refund. |
| `Preparing` | `RefundPending` | Stop or reconcile machine operation before refund decision. |
| `Dispensing` | `RefundPending` | Reconcile physical outcome before refund decision. |

Rules:

- `PaymentPending -> Cancelled` is allowed only when Payment Engine confirms no captured funds exist.
- `Paid`, `Queued`, `Preparing` and `Dispensing` are not allowed to close as `Cancelled`.
- Paid stop requests use refund compensation, not unpaid cancellation.
- Duplicate cancellation commands must be idempotent.

---

# Forbidden Cancellation Points

Cancellation is forbidden when it would hide financial, fulfillment or terminal-state truth.

Forbidden cases:

| Case | Reason |
|---|---|
| Captured payment -> `Cancelled` | Captured funds require refund compensation. |
| `Completed -> Cancelled` | Completed is terminal and immutable. |
| `Cancelled -> any state` | Cancelled is terminal. |
| `Refunded -> any state` | Refunded is terminal. |
| `Expired -> Cancelled` | Expired is terminal; no new cancellation transition is needed. |
| Payment outcome ambiguous -> `Cancelled` | Payment must be reconciled first. |
| Machine outcome ambiguous -> refund or completion without reconciliation | Physical outcome must be known or support-reviewed. |
| Customer cancels after approved no-cancel machine threshold | Business policy must route to support or refund rules. |
| Operator cancellation without reason | Sensitive command requires actor and reason. |
| UI-only cancellation state | UI cannot be source of domain truth. |

Forbidden transitions are rejected commands. They do not change Order state and do not publish normal lifecycle business events, but sensitive rejected attempts must be audited.

---

# Machine Coordination

Machine coordination is required when a cancellation request touches fulfillment.

Machine rules:

- no machine fulfillment should exist before `Paid`;
- if a machine operation exists before `Paid`, it is a reconciliation incident;
- Order does not send low-level hardware commands directly;
- Machine Platform owns queue cancellation, operation stop, safe cleanup, telemetry and hardware recovery;
- queue cancellation must be idempotent by `order_id`, `order_item_id`, `machine_id`, `recipe_id` and operation type;
- preparation or dispensing cancellation requires safe-stop support or physical outcome reconciliation;
- refund must not be finalized from machine assumptions or UI timers;
- machine-originated facts must include trusted machine or adapter identity;
- duplicate machine events must not duplicate cancellation, refund or support actions.

Machine coordination by state:

| State | Coordination |
|---|---|
| `Paid` | Confirm no queue or operation exists before refund when the order is stopped. |
| `Queued` | Cancel or reconcile the queue entry before refund compensation. |
| `Preparing` | Stop when safe; otherwise reconcile operation result and route to support or refund. |
| `Dispensing` | Reconcile dispensed amount and customer outcome before refund. |
| `Completed` | Do not cancel; create a separate support or goodwill refund workflow if approved. |

---

# Financial Coordination

Cancellation financial coordination depends on settlement state.

No captured payment:

- Payment Engine cancels or expires unfinished payment attempts;
- Wallet releases active reservations through Ledger-backed policy;
- Bonus Engine releases bonus reservations;
- Discount or Promotion owner releases coupon or promotion reservations;
- Ledger does not record a refund because no captured funds exist;
- Order closes as `Cancelled` only after required release/cancel commands are accepted or safely scheduled by policy.

Captured payment:

- cancellation cannot close as `Cancelled`;
- Order moves to `RefundPending`;
- Refund Engine or Payment Engine refund flow executes refund;
- Ledger records refund as a new financial fact;
- Wallet refund or release is performed by Wallet and Ledger;
- Bonus redemption reversal or compensation is performed by Bonus Engine;
- mixed payments preserve method-line attribution;
- Order closes as `Refunded` only after accepted refund completion.

Financial invariants:

- cancellation never edits the original payment;
- cancellation never edits Ledger entries;
- cancellation never recalculates payable amount;
- cancellation never edits pricing or discount snapshots;
- cancellation never treats bonuses as money;
- refund amount cannot exceed captured amount minus previous refunds.

Until a separate Refund Engine exists, Payment Engine owns refund execution. ORDER-006 keeps the Refund Engine boundary visible for future extraction.

---

# Event Flow

Cancellation follows Event Platform rules.

Unpaid cancellation event flow:

```text
CancelOrder command accepted
-> payment reconciliation confirms no capture when needed
-> release/cancel side effects accepted or scheduled
-> Order state changes to Cancelled
-> OrderCancelled
-> PaymentCancelled / WalletReservationReleased / BonusReservationReleased when applicable
-> NotificationRequested / CRM projection updates when applicable
```

Paid stop and refund event flow:

```text
StopOrder or CancelOrder command accepted for captured payment
-> machine and payment reconciliation
-> Order state changes to RefundPending
-> RefundStarted
-> RefundRequested
-> RefundCompleted from finance flow
-> Order state changes to Refunded
-> RefundCompleted
```

Rejected cancellation flow:

```text
CancelOrder command rejected
-> no Order lifecycle event
-> audit record
-> optional OrderTransitionRejected only if audit policy promotes rejected commands to events
```

Required Order events:

| Event | Trigger |
|---|---|
| `OrderCancelled` | Unpaid cancellation accepted. |
| `RefundStarted` | Paid stop or cancellation requires compensation. |
| `RefundCompleted` | Refund compensation is complete and Order closes as `Refunded`. |

Event rules:

- cancellation events are facts, not commands;
- every accepted Order cancellation or refund transition emits exactly one Order business event;
- event payloads use snake_case fields and stable IDs;
- event payloads include actor, reason, correlation ID, causation ID and idempotency key;
- event payloads do not expose provider secrets, payment credentials, raw card data or unnecessary personal data;
- publication retries reuse the same event ID.

---

# Failure Scenarios

| Failure | Required handling |
|---|---|
| Duplicate cancellation command | Return existing result when payload matches; reject conflicting duplicate. |
| Payment status unknown | Reconcile through Payment Engine before `Cancelled`, `RefundPending` or retry. |
| Provider cancellation timeout | Read provider status before repeating cancellation. |
| Captured payment discovered after unpaid cancellation request | Stop `Cancelled` closure; move to refund compensation policy. |
| Wallet release fails | Retry idempotently through Wallet/Ledger policy or escalate to support. |
| Bonus release fails | Retry idempotently through Bonus Engine or escalate to support. |
| Coupon release fails | Retry through Discount or Promotion owner or escalate. |
| Machine queue cancellation times out | Read Machine Platform state before repeating operation. |
| Machine preparation already started | Reconcile safe stop and physical outcome before refund. |
| Dispensing ambiguous | Reconcile telemetry and support evidence before completion or refund. |
| Event publication fails | Retry same event ID through Event Platform policy. |
| Operator lacks permission or reason | Reject command and audit the attempt. |
| Terminal order cancellation requested | Reject command and keep terminal state immutable. |

Failure handling must preserve idempotency and must not duplicate payments, refunds, bonus movements, wallet releases, machine commands or products.

---

# Recovery Strategy

Recovery favors reconciliation before repeated side effects.

Recovery rules:

- read current Order state before applying any cancellation result;
- read Payment state before cancelling or refunding;
- read Ledger-backed facts before accepting refund completion;
- read Wallet and Bonus state before repeating release or reversal;
- read Machine state before repeating queue cancellation or stop commands;
- preserve original correlation and causation IDs;
- use bounded retry for transient infrastructure failures;
- route repeated failures to support review or dead-letter handling;
- keep customer-facing state derived from domain facts, not timers;
- never reopen terminal states for recovery.

Recovery outcomes:

| Situation | Outcome |
|---|---|
| No captured payment and all release actions complete | `Cancelled`. |
| No captured payment but release action is delayed | `Cancelled` only if policy allows async release tracking; otherwise support review. |
| Captured payment and no machine physical product | `RefundPending -> Refunded`. |
| Captured payment and machine outcome ambiguous | Support review before refund or completion. |
| Product delivered after cancellation request | `Completed` or support workflow according to approved policy; do not silently refund. |
| Refund fails repeatedly | Stay `RefundPending`, escalate to support and finance reconciliation. |

---

# Acceptance Criteria

ORDER-006 is complete when:

- purpose is documented;
- business value is documented;
- architecture scope is documented;
- cancellation stages are documented;
- allowed cancellation points are documented;
- forbidden cancellation points are documented;
- machine coordination is documented;
- financial coordination is documented;
- event flow is documented;
- failure scenarios are documented;
- recovery strategy is documented;
- acceptance criteria are documented;
- risks are documented;
- future roadmap is documented;
- important architecture rules are documented;
- cancellation is defined as a business process;
- cancellation never edits historical transactions;
- cancellation never edits immutable Order snapshots;
- cancellation may trigger Refund Engine or Payment Engine refund flow;
- cancellation always publishes business events after accepted business decisions;
- documentation remains architecture-only;
- no application source code is modified;
- no frontend files are modified;
- no UI files are modified.

---

# Risks

Key risks:

- treating customer UI cancel as authoritative without Payment reconciliation;
- closing a captured-payment order as `Cancelled` instead of refund compensation;
- refunding while machine dispensing outcome is ambiguous;
- duplicating provider cancellation, refund, wallet release or machine stop commands during retry;
- releasing bonus or wallet reservations before knowing payment capture status;
- publishing duplicate cancellation events for the same accepted transition;
- hiding cancellation reason from support and finance audit;
- leaving orders stuck in `RefundPending`;
- creating a separate Refund Engine later without preserving Payment and Ledger compatibility;
- introducing partial refund behavior before Product Owner approves partial fulfillment policy.

Mitigations:

- require idempotency keys on every cancellation command;
- require Payment reconciliation before cancellation closure;
- require Machine reconciliation when fulfillment may have started;
- keep Ledger immutable and authoritative;
- publish one business event per accepted Order transition;
- monitor stuck cancellation and refund states;
- route ambiguous cases to support review.

---

# Future Roadmap

Recommended follow-up work:

1. Define formal `CancelOrder`, `RequestRefund`, `RejectCancellation` and support-review command contracts.
2. Define a dedicated Refund Engine if refund orchestration grows beyond Payment Engine.
3. Define partial refund and partial dispensing policy before implementation.
4. Define machine no-pickup, product-ready and product-taken cancellation policies.
5. Define cancellation reason-code catalog and localization rules.
6. Define CRM support workflow for cancellation, refund and machine reconciliation cases.
7. Define customer notification templates triggered by cancellation events.
8. Add cancellation state-machine tests before implementation.
9. Add finance reconciliation reports for cancelled, refund-pending and refunded orders.
10. Add monitoring dashboards for cancellation latency, refund latency and release failures.

---

# Important Architecture Rules

1. Cancellation is a business process.
2. Cancellation is explicit, authorized, idempotent and auditable.
3. Cancellation never edits historical transactions.
4. Cancellation never edits immutable Order snapshots.
5. Cancellation never edits Ledger entries.
6. Cancellation never recalculates historical prices or discounts.
7. Cancellation of unpaid orders closes as `Cancelled`.
8. Cancellation or stop of paid orders moves through `RefundPending` and refund compensation.
9. Cancellation may trigger Refund Engine or Payment Engine refund flow.
10. Cancellation always publishes business events after accepted business decisions.
11. Payment, Wallet, Bonus, Discount, Ledger and Machine side effects stay in their owning domains.
12. Machine state is reconciled before refund when physical preparation may have started.
13. Terminal states are immutable and are not reopened by cancellation.
14. UI derives cancellation status from domain facts and does not decide financial or machine outcomes.
