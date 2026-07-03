# ORDER-008 Machine Dispatch

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
- `docs/architecture/EVENT_PLATFORM.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/WALLET.md`
- `docs/architecture/LEDGER.md`
- `docs/tasks/EPIC-230_ORDER_PLATFORM.md`
- `docs/tasks/ORDER-001_ORDER_DOMAIN.md`
- `docs/tasks/ORDER-003_ORDER_STATE_MACHINE.md`
- `docs/tasks/ORDER-004_ORDER_EVENTS.md`
- `docs/tasks/ORDER-005_FULFILLMENT.md`
- `docs/tasks/ORDER-006_CANCELLATION.md`
- `docs/tasks/ORDER-007_REFUND.md`

---

# Purpose

ORDER-008 defines Machine Dispatch as the technical and operational handoff from a confirmed paid Order to a vending machine operation.

Machine Dispatch selects an eligible machine, creates or uses a dispatch queue entry, sends a versioned machine command through an approved delivery protocol, receives acknowledgement, tracks timeouts and retries, publishes events and records audit data.

Core rule:

```text
Machine receives only confirmed paid orders.
Dispatch never changes financial data.
Dispatch never changes Order state directly.
Dispatch publishes technical and business events.
```

ORDER-008 is documentation only. It introduces no application source code, frontend changes, UI changes, routes, styles, database migrations, payment provider integration, machine firmware changes, hardware commands or cloud infrastructure.

---

# Business Value

Machine Dispatch protects the paid purchase flow when the platform starts communicating with real vending machines.

Business value:

- customers receive products only after payment is confirmed;
- paid orders are not lost between payment and machine preparation;
- duplicate physical preparation is prevented through idempotent dispatch commands;
- support can reconstruct command, acknowledgement, retry and failure timelines;
- operators can detect stuck machines and dispatch queues before they become customer incidents;
- finance remains protected because dispatch cannot mutate Payment, Wallet or Ledger data;
- future CRM, Notification and Analytics consumers receive stable machine-dispatch facts.

Machine Dispatch supports the MVP goal by making the final step of the first purchase flow safe, traceable and recoverable.

---

# Architecture Scope

ORDER-008 covers:

- Machine Dispatch architecture;
- dispatch lifecycle;
- machine selection;
- queue handling;
- machine command model;
- delivery protocol;
- acknowledgement flow;
- timeout strategy;
- retry strategy;
- failure scenarios;
- recovery strategy;
- event publication;
- monitoring;
- audit;
- acceptance criteria;
- risks;
- future roadmap;
- important architecture rules.

ORDER-008 does not cover:

- JavaScript implementation;
- React or frontend changes;
- Mini App UI changes;
- database schema implementation;
- physical vending firmware implementation;
- machine hardware command syntax;
- payment provider implementation;
- refund provider implementation;
- CRM screens;
- notification templates;
- cloud event bus implementation.

---

# Dispatch Lifecycle

Dispatch starts only after Order has accepted payment completion.

Entry condition:

```text
Order state = Paid
Payment completion accepted under Payment Engine and Ledger policy
Fulfillment request is approved
```

Successful dispatch flow:

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

Failure and recovery flow:

```text
dispatch_requested / machine_selected / queue_entry_created / command_sent
->
timeout_detected
->
status_reconciled
->
retry_scheduled
->
command_sent

dispatch_requested / queue_entry_created / command_sent / operation_started
->
dispatch_failed
->
recovery_required
->
retry, alternate machine, support review or refund compensation
```

Lifecycle rules:

- unpaid orders cannot enter dispatch;
- dispatch request references immutable Order snapshots and accepted `recipe_id`;
- dispatch can advance only by accepted machine, adapter or queue facts;
- dispatch completion is not Order completion;
- dispatch failure after payment cannot move Order to `Cancelled` or `Expired`;
- repeated dispatch failure routes to recovery, support or refund compensation through owning domains.

---

# Machine Selection

Machine selection chooses which vending machine can safely fulfill the paid order.

Selection inputs:

- `order_id`;
- `order_item_id`;
- `fulfillment_id`;
- accepted `recipe_id`;
- product, flavor, syrup, topping and size semantic IDs from snapshots;
- customer channel and machine context;
- requested quantity;
- machine availability;
- recipe capability;
- ingredient and consumable availability;
- maintenance, cleaning, temperature and safety state;
- queue capacity;
- operator override when approved.

Selection modes:

| Mode | Meaning |
|---|---|
| Direct | Customer flow is tied to one known vending machine. |
| Policy | Platform selects an eligible machine after payment. |
| Alternate | Platform selects a replacement machine before physical preparation starts. |
| Operator | Authorized operator assigns or reassigns a machine with reason. |

Selection rules:

- machine selection is allowed only for confirmed paid orders;
- selected machine must support the accepted recipe;
- selected machine must pass readiness, safety and queue checks;
- selection must not change accepted configuration, pricing, discount, bonus, payment or Ledger facts;
- alternate-machine selection after payment requires approved business policy;
- selection ambiguity blocks command dispatch until reconciled.

---

# Queue Handling

Dispatch queue controls the order in which paid machine operations are sent to machines.

Queue entry fields:

- `queue_entry_id`;
- `dispatch_id`;
- `order_id`;
- `order_item_id`;
- `fulfillment_id`;
- `machine_id`;
- `recipe_id`;
- `queue_status`;
- `priority`;
- `attempt_count`;
- `correlation_id`;
- `causation_id`;
- idempotency key;
- timestamps.

Queue rules:

- only paid orders can enter the dispatch queue;
- one order item has at most one active queue entry for one fulfillment operation;
- queue entry is idempotent by order item, machine, recipe and operation type;
- duplicate queue requests with matching payload return the existing queue entry;
- duplicate queue requests with conflicting payload are rejected and audited;
- queue priority is policy-driven and cannot be inferred by UI;
- queue timeout requires queue and machine status reconciliation before retry;
- queue cancellation, pause, reorder and safe stop are Machine Platform responsibilities.

Recommended idempotency scope:

```text
order_id + order_item_id + machine_id + recipe_id + operation_type
```

---

# Machine Command Model

Machine command model defines the platform command sent by Dispatch to a machine adapter.

Minimal command envelope:

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
  "idempotency_key": "machine_operation_01JZ_prepare_v1",
  "correlation_id": "order_01JZ0000000000000000000000",
  "causation_id": "evt_01JZ0000000000000000000000",
  "issued_at": "2026-07-03T00:00:00Z"
}
```

Command rules:

- command is created only from a paid order dispatch flow;
- command references accepted Order snapshots and recipe references;
- command payload contains no payment credentials, provider secrets, raw card data or unnecessary personal data;
- command type and payload version are stable contracts;
- machine adapters translate platform command into hardware-specific protocol;
- firmware-specific statuses are mapped into platform result codes before other domains consume them;
- duplicate command with the same idempotency key must resolve to the same machine operation or be rejected as a conflict.

---

# Acknowledgement Flow

Acknowledgement confirms whether the machine or adapter received and accepted the command.

Acknowledgement states:

```text
sent
->
received
->
accepted

sent / received
->
rejected

sent / received
->
duplicate

sent
->
unknown
```

Acknowledgement meanings:

| State | Meaning |
|---|---|
| `sent` | Dispatch handed the command to the adapter. |
| `received` | Adapter or machine received the command envelope. |
| `accepted` | Machine accepted the operation for execution. |
| `rejected` | Machine rejected the command before execution. |
| `duplicate` | Machine recognized an already accepted idempotent command. |
| `unknown` | Dispatch cannot determine whether the machine accepted the command. |

Acknowledgement rules:

- acknowledgement is not payment confirmation;
- acknowledgement is not Order completion;
- Dispatch records acknowledgement but does not change Order state directly;
- accepted acknowledgement can become an input to approved Order transition handling;
- rejected acknowledgement must include machine, command, operation and reason references;
- duplicate acknowledgement must resolve to the original operation when payload matches;
- unknown acknowledgement requires status reconciliation before retry;
- acknowledgement is auditable and event-published.

---

# Timeout Strategy

Timeout strategy defines how Dispatch handles missing selection, queue, delivery, acknowledgement and operation facts.

Timeout categories:

| Timeout | Meaning | Handling |
|---|---|---|
| Selection timeout | No eligible machine selected in policy window. | Recalculate eligibility, select approved alternate machine or route to support/recovery. |
| Queue timeout | Queue entry does not advance. | Read queue and machine operation state before retry. |
| Command delivery timeout | Delivery result is unknown. | Reconcile command ID and idempotency key before sending again. |
| Acknowledgement timeout | Machine does not acknowledge command. | Read machine operation status before retry or failure. |
| Operation start timeout | Accepted operation does not start. | Reconcile machine state, retry if safe or recover. |
| Operation completion timeout | Started operation does not complete. | Reconcile telemetry and physical outcome before completion or refund. |

Timeout rules:

- timeout is an operational fact, not proof of failure by itself;
- timeout never changes financial data;
- timeout never changes Order state directly;
- Dispatch must reconcile status before repeating physical side effects;
- repeated timeout after bounded retries moves to support review, dead-letter handling or refund recovery;
- timeout events include dispatch, command, machine, order and idempotency references.

---

# Retry Strategy

Retry strategy protects against transient failures without creating duplicate products.

Retry rules:

- retry only idempotent operations automatically;
- retry status reads before retrying machine side effects;
- reuse the same idempotency key for the same command;
- preserve original correlation and causation IDs;
- use bounded exponential backoff for transient network, adapter, queue or machine-busy failures;
- do not automatically retry safety blocks, recipe incompatibility, payment mismatch or hard machine rejection;
- do not create a second machine operation while the first operation is unknown or active;
- route repeated failures to support review or recovery workflow;
- event publication retry uses the same event ID.

Retry examples:

| Scenario | Retry behavior |
|---|---|
| Machine status read timeout | Retry status read first. |
| Command delivery timeout | Reconcile command and operation status before resending. |
| Duplicate acknowledgement | Return original accepted operation. |
| Machine busy | Retry only within queue policy. |
| Safety block | Wait for Machine Platform readiness; do not auto-dispatch. |
| Event bus timeout | Retry same event ID through Event Platform policy. |

Retry must favor reconciliation over repeated physical action.

---

# Failure Scenarios

Dispatch failure scenarios:

| Scenario | Meaning |
|---|---|
| Paid order has no eligible machine | Selection cannot find a safe machine. |
| Machine selected but queue rejects entry | Queue capacity, maintenance or conflict blocks dispatch. |
| Command delivery fails | Adapter or network cannot confirm delivery. |
| Command acknowledgement is unknown | Machine may or may not have accepted the command. |
| Command is rejected | Machine refuses command before execution. |
| Duplicate command conflict | Same idempotency key has conflicting payload. |
| Operation does not start | Machine accepted command but no start fact appears. |
| Operation fails after start | Physical preparation or dispensing fails. |
| Operation result is ambiguous | Telemetry cannot confirm success or failure. |
| Event publication fails | Accepted dispatch fact cannot be delivered yet. |
| Order and Machine state diverge | Order projection and machine operation facts disagree. |

Failure rules:

- failed dispatch does not rewrite Payment, Wallet, Bonus or Ledger facts;
- failed dispatch does not directly mutate Order state;
- failed dispatch after payment triggers recovery, support review or refund compensation;
- every failure requires reason, correlation and audit metadata;
- customer messaging is handled by Notification or channel layer, not Dispatch internals.

---

# Recovery Strategy

Recovery strategy determines how the platform proceeds when dispatch cannot safely complete.

Recovery options:

| Failure | Recovery |
|---|---|
| No machine selected | Try approved alternate machine or move to support/refund policy. |
| Queue rejected | Reconcile reason, retry if transient or select alternate machine. |
| Command rejected before execution | Fix recoverable readiness issue, retry or compensate. |
| Command accepted but operation unknown | Reconcile machine operation before retry or refund. |
| Operation failed before product creation | Retry on same or alternate machine if policy allows. |
| Operation failed after partial preparation | Stop safely, reconcile physical outcome and route to support/refund policy. |
| Machine offline after payment | Reconcile whether command was accepted, then alternate machine or compensation. |
| Duplicate command conflict | Keep canonical operation and audit rejected duplicate. |

Recovery rules:

- recovery never edits original payment, wallet, bonus or Ledger facts;
- safe stop, cleanup and physical reconciliation belong to Machine Platform;
- refund execution belongs to Payment Engine and Ledger-backed finance flow;
- Order records recovery references and accepts state changes only through Order lifecycle rules;
- operator recovery requires actor, role and reason;
- partial preparation, partial dispensing and product-not-taken policies require Product Owner approval before automation.

---

# Event Publication

Machine Dispatch publishes technical and business events through Event Platform.

Event examples:

| Event | Type | Meaning |
|---|---|---|
| `MachineDispatchRequested` | business/integration | Paid order was accepted for dispatch attempt. |
| `MachineSelected` | business/integration | A machine was selected for dispatch. |
| `MachineQueueEntryCreated` | technical/integration | Dispatch queue entry was created. |
| `MachineCommandPrepared` | technical | Machine command envelope was created. |
| `MachineCommandSent` | technical/integration | Command was handed to adapter or machine transport. |
| `MachineCommandAcknowledged` | technical/integration | Machine acknowledged the command. |
| `MachineCommandRejected` | technical/integration | Machine rejected the command. |
| `MachineCommandTimedOut` | technical/integration | Command or acknowledgement timed out. |
| `MachineDispatchRetryScheduled` | technical | Retry was scheduled after reconciliation. |
| `MachineDispatchRecoveryRequired` | business/integration | Dispatch cannot safely continue without recovery. |
| `MachineDispatchFailed` | business/integration | Dispatch failed by policy. |
| `MachineOperationReconciled` | technical/integration | Machine operation status was reconciled. |

Event rules:

- events are facts, not commands;
- event names use English PascalCase;
- payload fields use snake_case;
- Dispatch publishes technical events for command communication and business events for accepted dispatch outcomes;
- Order Platform remains the producer of Order lifecycle events such as `OrderQueued`, `PreparationStarted`, `DispensingStarted`, `OrderCompleted` and `RefundStarted`;
- event payloads include `dispatch_id`, `order_id`, `order_item_id`, `machine_id`, `queue_entry_id`, `machine_operation_id`, command ID, state, reason, correlation ID, causation ID and idempotency key when available;
- event payloads must not include payment credentials, provider secrets, raw card data, unnecessary personal data or UI component state;
- event replay rebuilds projections and monitoring but must not resend machine commands.

---

# Monitoring

Machine Dispatch monitoring detects stuck paid orders, unreliable machine communication and repeated recovery needs.

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
- dashboards do not infer product delivery from timers alone;
- alerts include machine ID, dispatch ID, order ID and correlation ID;
- replay rebuilds monitoring projections without repeating machine commands or refunds.

---

# Audit

Dispatch audit reconstructs the full machine communication timeline.

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

---

# Acceptance Criteria

ORDER-008 is complete when:

- purpose is documented;
- business value is documented;
- architecture scope is documented;
- dispatch lifecycle is documented;
- machine selection is documented;
- queue handling is documented;
- machine command model is documented;
- acknowledgement flow is documented;
- timeout strategy is documented;
- retry strategy is documented;
- failure scenarios are documented;
- recovery strategy is documented;
- event publication is documented;
- monitoring requirements are documented;
- audit requirements are documented;
- risks are documented;
- future roadmap is documented;
- important architecture rules are documented;
- Order Platform architecture references Machine Dispatch;
- machine receives only confirmed paid orders;
- dispatch never changes financial data;
- dispatch never changes Order state directly;
- dispatch publishes technical and business events;
- documentation remains architecture-only;
- no application code is modified;
- no frontend files are modified.

---

# Risks

Key risks:

- duplicate physical preparation if idempotency is not enforced end to end;
- paid order stuck between Payment completion and machine acknowledgement;
- ambiguous command delivery causing unsafe retry;
- machine telemetry disagreement with Order projection;
- machine selection policy sending customers to the wrong pickup location;
- event publication failure hiding dispatch facts from CRM, Notification or support;
- support manually resolving dispatch without enough audit data;
- unclear partial preparation or partial dispensing policy;
- overloading Machine Platform with finance responsibilities;
- frontend inferring progress from timers instead of domain facts.

Risk controls:

- enforce command idempotency;
- reconcile status before retry;
- require trusted machine or adapter identity;
- publish technical and business dispatch events;
- monitor stuck paid orders and acknowledgement timeouts;
- keep refund and finance changes in Payment, Wallet and Ledger domains;
- require Product Owner approval for partial fulfillment and no-pickup policy.

---

# Future Roadmap

Recommended follow-up tasks:

1. Define Machine Platform command and event contract schemas.
2. Define machine adapter capability metadata and readiness model.
3. Define dispatch queue persistence and ordering policy.
4. Define direct-machine, alternate-machine and operator assignment policies.
5. Define product-ready, product-taken, no-pickup and partial-dispensing policies.
6. Define machine status reconciliation API.
7. Define safe stop and cleanup workflow for failed operations.
8. Add dispatch state-machine tests before implementation.
9. Add monitoring dashboards for paid orders stuck before acknowledgement.
10. Add support workflows for dispatch recovery and manual reconciliation.

---

# Important Architecture Rules

ORDER-008 follows these rules:

1. Machine receives only confirmed paid orders.
2. Dispatch never changes financial data.
3. Dispatch never changes Order state directly.
4. Dispatch publishes technical and business events.
5. Order Platform owns Order lifecycle transitions.
6. Payment Engine owns payment settlement and refund execution.
7. Ledger remains the source of truth for financial history.
8. Wallet and Bonus changes happen only through their owning domains.
9. Machine Platform owns machine selection, queues, commands, acknowledgements, telemetry and physical outcome.
10. Dispatch uses immutable Order snapshots and accepted recipe references.
11. Dispatch command payloads contain machine-operation data, not payment or UI state.
12. Every dispatch command is idempotent.
13. Timeouts reconcile before retry.
14. Retries must not create duplicate queue entries, machine operations or products.
15. Recovery uses retry, alternate machine, support review or refund compensation through owning domains.
16. Event replay must not resend machine commands or repeat refunds.
17. UI derives progress from Order and Machine facts, not local timers.
18. Audit must reconstruct command, acknowledgement, retry and recovery timelines.
