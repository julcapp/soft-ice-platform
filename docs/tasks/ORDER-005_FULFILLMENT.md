# ORDER-005 Fulfillment

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
- `docs/architecture/LEDGER.md`
- `docs/architecture/WALLET.md`
- `docs/tasks/EPIC-230_ORDER_PLATFORM.md`
- `docs/tasks/ORDER-001_ORDER_DOMAIN.md`
- `docs/tasks/ORDER-003_ORDER_STATE_MACHINE.md`
- `docs/tasks/ORDER-004_ORDER_EVENTS.md`

---

# Goal

Document the complete fulfillment process for a paid order.

ORDER-005 is documentation only. It defines queue management, machine assignment, preparation, dispensing, completion, failure handling, retry policy, compensation, events, audit and monitoring before implementation starts.

Core rule:

```text
Only paid orders can enter fulfillment.
Fulfillment never changes financial data.
Every accepted fulfillment stage publishes a domain event.
```

---

# 1. Purpose

Fulfillment is the business delivery process that turns a paid Order into a prepared and dispensed product.

Fulfillment exists so Soft ICE Platform can:

- send paid orders to a vending machine safely;
- prepare the accepted recipe from the immutable Order snapshot;
- track queue, preparation, dispensing and completion;
- recover from machine and delivery failures;
- compensate the customer when a paid product cannot be delivered;
- provide customer, CRM, support, analytics and monitoring projections from formal events.

Fulfillment does not own:

- product configuration rules;
- price calculation;
- discount calculation;
- bonus balance or bonus lifecycle;
- payment settlement;
- wallet balance;
- Ledger financial history;
- machine hardware commands;
- UI progress timers.

Fulfillment coordinates Order and Machine facts. Financial compensation is requested through Payment, Wallet, Bonus and Ledger-owned processes.

---

# 2. Fulfillment Lifecycle

Fulfillment begins after Order accepts payment completion.

Entry condition:

```text
Order state = Paid
Payment completion accepted under Payment Engine and Ledger policy
```

Successful business flow:

```text
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

Detailed fulfillment status flow:

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

Failure and recovery flow:

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

Lifecycle rules:

- `Paid` is the only Order state that can request a new fulfillment queue entry.
- `Queued` means Machine Platform accepted one queue entry for the paid order item.
- `Preparing` means Machine Platform confirmed preparation started.
- `Dispensing` means Machine Platform confirmed dispensing started.
- `Completed` means product delivery or approved fulfillment closure is accepted.
- `Completed` is terminal and immutable.
- Fulfillment retry attempts must not duplicate queue entries, machine operations or products.
- Fulfillment failure after payment cannot close as `Cancelled` or `Expired`; it requires recovery or refund compensation.

---

# 3. Queue Management

Queue management is the first fulfillment boundary after payment.

Queue request input:

- `order_id`;
- `order_item_id`;
- `fulfillment_id`;
- `machine_id` or assignment policy reference;
- accepted `recipe_id` from configuration snapshot;
- quantity;
- priority or scheduling policy;
- `correlation_id`;
- `causation_id`;
- idempotency key.

Queue rules:

- queue handoff is allowed only for paid orders;
- one order item must produce at most one active machine queue entry;
- queue entry must reference immutable Order snapshots;
- queue priority is policy-driven and must not be inferred by UI;
- duplicate queue requests with the same semantic payload return the existing queue entry;
- duplicate queue requests with conflicting payload are rejected and audited;
- queue timeout requires Machine Platform status reconciliation before retry;
- queue rejection after payment triggers retry, alternate assignment, support review or refund policy.

Recommended queue idempotency scope:

```text
order_id + order_item_id + machine_id + recipe_id + operation_type
```

Queue acceptance moves Order:

```text
Paid -> Queued
```

Order publishes:

```text
OrderQueued
```

---

# 4. Machine Assignment

Machine assignment selects or confirms the vending machine that will fulfill the paid order.

Assignment modes:

| Mode | Meaning |
|---|---|
| Direct assignment | The customer channel is tied to a known vending machine before checkout. |
| Policy assignment | A future assignment policy selects an eligible machine after payment. |
| Operator assignment | A support or operator flow assigns or reassigns a machine under approved policy. |

Assignment checks:

- machine exists and is active;
- machine is reachable or has acceptable offline policy;
- machine supports the accepted recipe;
- required ingredients, syrup, topping, cups and consumables are available;
- machine is not blocked by maintenance, safety, temperature or cleaning policy;
- machine queue can accept the order;
- channel and customer context allow fulfillment from that machine.

Assignment rules:

- assignment cannot happen before payment completion is accepted;
- assignment must not change configuration, pricing, discount, bonus or payment snapshots;
- alternate-machine assignment after payment requires approved customer, operator or business policy;
- assignment ambiguity must be reconciled before preparation starts;
- assignment facts are machine-owned and event-published by Machine Platform.

---

# 5. Preparation

Preparation is the machine process that starts making the accepted product recipe.

Preparation input:

- `machine_operation_id`;
- `order_id`;
- `order_item_id`;
- `machine_id`;
- accepted `recipe_id`;
- quantity;
- recipe snapshot or version reference;
- operation idempotency key.

Preparation rules:

- preparation can start only after queue acceptance and machine assignment;
- Order must not translate recipe data into hardware commands;
- Machine Platform owns low-level commands, dosing, motors, sensors and telemetry;
- preparation uses immutable Order configuration and recipe references, not live UI state;
- preparation start moves Order from `Queued` to `Preparing`;
- preparation failure must include reason code, machine identity and operation reference;
- preparation failure after payment triggers retry, support review or refund compensation.

Expected preparation failures:

- ingredient unavailable;
- syrup unavailable;
- topping unavailable;
- cup unavailable;
- machine offline;
- machine busy beyond policy;
- temperature or cleaning block;
- hardware command rejected;
- sensor or telemetry conflict;
- operation timeout.

---

# 6. Dispensing

Dispensing is the physical delivery stage.

Dispensing rules:

- dispensing starts only after preparation start is accepted;
- Machine Platform confirms dispensing start before Order enters `Dispensing`;
- Order must not infer dispensing success from a timer;
- dispensing telemetry remains machine-owned;
- customer-visible dispensing progress must be derived from Order and Machine events;
- dispensing failure or ambiguity must be reconciled before completion or refund decision.

Expected dispensing outcomes:

| Outcome | Handling |
|---|---|
| Fully dispensed | Move toward completion. |
| Partial dispensing | Reconcile physical outcome and apply support or refund policy. |
| Dispensing blocked | Retry if safe or request compensation. |
| Telemetry ambiguous | Reconcile machine operation before completion or refund. |
| Product not taken | Follow future pickup/no-pickup policy; do not infer refund automatically. |

Dispensing start moves Order:

```text
Preparing -> Dispensing
```

Order publishes:

```text
DispensingStarted
```

---

# 7. Completion

Completion closes the successful purchase delivery flow.

Completion can be accepted when one approved condition is true:

- Machine Platform confirms product was dispensed;
- Machine Platform confirms product is ready and current business policy treats ready state as delivery;
- Machine Platform confirms product was taken when pickup detection is available;
- support or operator closes fulfillment under approved business policy with reason.

Completion rules:

- completion moves Order from `Dispensing` to `Completed`;
- `Completed` is terminal and immutable;
- completion does not change financial data;
- completion does not create or edit Ledger entries;
- completion does not alter Payment, Wallet, Bonus, Discount or Pricing facts;
- post-completion goodwill refund or support correction is a new support or refund workflow referencing the completed order.

Order publishes:

```text
OrderCompleted
```

---

# 8. Failure Handling

Fulfillment failures are business or machine facts, not hidden UI failures.

Failure categories:

- queue rejection;
- queue timeout;
- assignment failure;
- preparation failure;
- dispensing failure;
- completion ambiguity;
- machine telemetry conflict;
- network or event delivery failure;
- duplicate command conflict;
- operator or support exception.

Failure matrix:

| Failure | Detection point | Required handling |
|---|---|---|
| Queue rejected | Queue request | Reconcile machine state, retry safely, assign another approved machine or compensate. |
| Queue timeout | Queue wait | Read Machine Platform state before retrying queue handoff. |
| Machine unavailable | Assignment | Use approved alternate machine before preparation or move to compensation policy. |
| Preparation cannot start | Preparation start | Retry transient readiness failure or move to support/refund policy. |
| Preparation fails after start | Machine telemetry | Stop or reconcile machine operation, then retry or compensate. |
| Dispensing fails | Dispensing telemetry | Reconcile physical outcome before retry or refund. |
| Completion not verified | Completion | Reconcile Machine Platform state; do not mark completed from timer alone. |
| Event publication fails | Event Platform | Retry same event ID; do not duplicate accepted transition. |
| Operator manual closure | Support action | Require actor, reason, audit entry and approved closure policy. |

Failure rules:

- payment history must not be edited;
- Ledger entries must not be edited or deleted;
- accepted snapshots must not be rewritten;
- paid orders cannot become `Cancelled` or `Expired`;
- paid orders that cannot be fulfilled move to `RefundPending` when compensation is required;
- rejected fulfillment commands are audited but do not publish lifecycle events unless audit policy promotes them.

---

# 9. Retry Policy

Fulfillment retry is conservative because duplicate preparation can create a duplicate product.

Retry rules:

- retry only idempotent operations automatically;
- reconcile current Order and Machine state before repeating a side effect;
- preserve original correlation and causation IDs;
- reuse the same idempotency key for the same operation;
- do not create duplicate queue entries;
- do not create duplicate machine operations;
- do not start a second preparation when the first operation may still be active;
- use bounded exponential backoff for transient infrastructure or machine-status failures;
- route repeated failures to support review, dead-letter handling or refund policy;
- retry event publication with the same event ID.

Retry examples:

| Scenario | Retry behavior |
|---|---|
| Queue request timeout | Read queue or machine operation by idempotency key before retry. |
| Machine status read timeout | Retry status read before issuing another machine command. |
| Preparation start timeout | Reconcile whether preparation actually started before retry. |
| Dispensing completion event delayed | Reconcile machine operation state before failure or completion. |
| Event bus timeout | Retry publication with the same event ID. |
| Duplicate machine event | Deduplicate by machine event ID and operation ID. |

Retry must favor reconciliation over repeated physical action.

---

# 10. Compensation Strategy

Compensation handles paid orders that cannot be fulfilled.

Core compensation rule:

```text
Fulfillment never changes financial data.
```

Compensation owners:

| Area | Owner |
|---|---|
| Refund execution | Payment Engine |
| Refund financial facts | Ledger |
| Wallet reservation, release, capture or refund | Wallet and Ledger |
| Bonus reservation, redemption, release or reversal | Bonus Engine |
| Machine stop, cleanup and operation reconciliation | Machine Platform |
| Business state and compensation references | Order Platform |

Compensation flow:

```text
Fulfillment failure
->
Retry or alternate fulfillment exhausted
->
Order accepts compensation decision
->
RefundStarted
->
Payment Engine refund flow
->
Ledger-backed refund fact
->
RefundCompleted
->
Refunded
```

Compensation rules:

- refund is a new financial operation, not an edit to original payment;
- refund amount must follow Payment and Ledger policy;
- Wallet refund or release must go through Wallet and Ledger contracts;
- bonus reversal or release must go through Bonus Engine policy;
- Machine Platform must reconcile actual physical outcome before refund when dispensing may have occurred;
- Order records refund, support and machine references for audit;
- partial refund and partial fulfillment require future Product Owner-approved policy.

---

# 11. Event Publication

Every accepted fulfillment stage publishes a domain event by the owning domain.

Order Platform event rules:

- Order publishes events after accepted Order state changes or approved checkpoints;
- event names follow the ORDER-004 catalog;
- events use Event Platform envelope and snake_case payload fields;
- every event includes `order_id`, `correlation_id`, `causation_id`, `actor` and idempotency metadata;
- event publication retries reuse the same `event_id`;
- rejected commands do not publish lifecycle events unless audit policy requires a separate audit event.

Fulfillment event map:

| Stage | Producer | Event | Notes |
|---|---|---|---|
| Payment accepted for fulfillment | Order Platform | `PaymentConfirmed` | Order is `Paid` and eligible for fulfillment. |
| Queue accepted | Order Platform | `OrderQueued` | Order moves `Paid -> Queued`. |
| Queue operation accepted | Machine Platform | `MachineQueueEntryAccepted` | Machine event name is finalized by Machine Platform task. |
| Machine assigned | Machine Platform | `MachineAssigned` | Assignment is machine-owned; Order stores reference when accepted. |
| Preparation started | Order Platform | `PreparationStarted` | Order moves `Queued -> Preparing`. |
| Machine preparation started | Machine Platform | `MachinePreparationStarted` | Hardware execution fact. |
| Dispensing started | Order Platform | `DispensingStarted` | Order moves `Preparing -> Dispensing`. |
| Machine dispensing started | Machine Platform | `MachineDispensingStarted` | Hardware execution fact. |
| Product delivered | Order Platform | `OrderCompleted` | Order moves `Dispensing -> Completed`. |
| Machine operation completed | Machine Platform | `MachineOperationCompleted` | Hardware outcome fact. |
| Fulfillment cannot complete | Order Platform | `RefundStarted` | Compensation decision accepted. |
| Machine failure reported | Machine Platform | `MachineErrorReported` or failure event | Failure fact consumed by Order and support flows. |

Machine Platform event names in this task are expected examples. Final Machine event contracts must be approved in a Machine Platform task and must remain compatible with Order fulfillment requirements.

---

# 12. Audit

Fulfillment audit must reconstruct the physical delivery timeline.

Required audit fields:

- `order_id`;
- `order_item_id`;
- `fulfillment_id`;
- `machine_id`;
- `queue_entry_id`;
- `machine_operation_id`;
- `recipe_id`;
- `from_state`;
- `to_state`;
- `fulfillment_status`;
- `state_reason`;
- `failure_reason` when applicable;
- `attempt_count`;
- `actor`;
- `operator_id` and support reason when applicable;
- `command_id`;
- `event_id`;
- `correlation_id`;
- `causation_id`;
- `idempotency_key`;
- `occurred_at`;
- `recorded_at`;
- machine firmware, adapter or controller version when available.

Audit rules:

- every accepted fulfillment stage records actor and reason;
- rejected sensitive commands are audited;
- machine-originated facts require trusted machine or adapter identity;
- operator actions require actor ID and reason;
- audit records must not contain payment credentials, provider secrets, raw card data or unnecessary personal data;
- support closures are compensating operations or approved closure actions, not silent edits.

---

# 13. Monitoring

Fulfillment monitoring must detect customer-impacting and machine-impacting failures.

Required metrics:

- paid-to-queued latency;
- queue wait time;
- assignment success rate;
- assignment failure rate;
- preparation start latency;
- preparation failure rate;
- dispensing start latency;
- dispensing failure rate;
- completion rate;
- completion ambiguity count;
- retry count by stage;
- refund-compensation rate after fulfillment failure;
- machine error rate by machine ID;
- event publication failure rate;
- dead-letter count;
- support manual closure count.

Required alerts:

- paid orders stuck before queue;
- queued orders stuck before preparation;
- preparing orders stuck before dispensing;
- dispensing orders stuck before completion;
- high machine failure rate;
- high compensation rate;
- repeated event publication failure;
- duplicate command conflicts;
- Machine and Order state divergence;
- fulfillment projection lag.

Monitoring rules:

- customer-facing progress must use Order and Machine facts;
- dashboards must not infer fulfillment success from timers;
- alerts must include correlation IDs and machine IDs;
- replay must rebuild monitoring projections without repeating machine commands or refunds.

---

# 14. Architecture Principles

ORDER-005 follows these principles:

1. Only paid orders can enter fulfillment.
2. Fulfillment never changes financial data.
3. Order owns business fulfillment state.
4. Machine Platform owns queue execution, assignment, commands, telemetry and physical outcome.
5. Ledger remains the source of truth for financial history.
6. Payment Engine owns refunds and payment settlement.
7. Wallet and Bonus changes happen only through their owning domains.
8. Fulfillment uses immutable Order snapshots.
9. Fulfillment must not recalculate configuration, price, discount or payable amount.
10. Every accepted fulfillment stage publishes a domain event.
11. Every fulfillment side effect is idempotent.
12. Retries reconcile before repeating physical operations.
13. Duplicate queue entries and duplicate product preparation are forbidden.
14. Failures become recovery, support or compensation workflows.
15. Corrections are explicit compensating operations, not silent edits.
16. UI derives fulfillment progress from domain facts, not timers.
17. Audit must preserve the complete physical delivery timeline.
18. Monitoring must detect stuck paid orders before they become support incidents.

---

# 15. Acceptance Criteria

ORDER-005 is complete when:

- fulfillment purpose is documented;
- fulfillment lifecycle is documented;
- queue management is documented;
- machine assignment is documented;
- preparation is documented;
- dispensing is documented;
- completion is documented;
- failure handling is documented;
- retry policy is documented;
- compensation strategy is documented;
- event publication is documented;
- audit requirements are documented;
- monitoring requirements are documented;
- architecture principles are documented;
- only paid orders can enter fulfillment;
- fulfillment never changes financial data;
- every accepted fulfillment stage publishes a domain event;
- documentation remains architecture-only;
- no application code is modified;
- no frontend files are modified.

---

# 16. Out of Scope

ORDER-005 does not include:

- JavaScript implementation;
- frontend changes;
- Mini App UI changes;
- React component changes;
- database migrations;
- payment provider integration;
- machine hardware commands;
- vending firmware changes;
- CRM screens;
- notification templates;
- cloud event bus implementation;
- refund provider implementation;
- partial fulfillment policy implementation.

---

# 17. Future Recommendations

Recommended follow-up tasks:

1. Define Machine Platform command and event contracts.
2. Define formal fulfillment command contracts for Order Platform.
3. Define machine assignment policy for direct, alternate and operator assignment.
4. Define no-pickup, product-ready and product-taken policy.
5. Define partial dispensing and partial refund policy before supporting partial fulfillment.
6. Add fulfillment state-machine tests before implementation.
7. Add monitoring dashboards for paid orders stuck in fulfillment.
8. Define support workflows for manual closure, refund approval and machine incident investigation.
