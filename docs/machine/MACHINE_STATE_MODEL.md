# Machine State Model

Document code: MACHINE-STATE-MODEL-001
Task: EPIC-373 / MACHINE-STATE-001
Version: 0.1
Status: Draft
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-09
Last updated: 2026-07-09
Scope: Documentation only

This document defines the machine lifecycle, runtime states, transitions, commands, events, error states, recovery flows, offline behavior, maintenance mode, security rules and integration boundaries for Soft ICE vending machines.

Related documents:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `docs/domain/MACHINE_DOMAIN.md`
- `docs/machine/MACHINE_PASSPORT.md`
- `docs/machine/MACHINE_MODEL_REVIEW.md`
- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/architecture/PROJECT_DECISIONS.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/tasks/ORDER-008_MACHINE_DISPATCH.md`
- `docs/api/EVENT_API.md`
- `docs/api/REST_API.md`
- `docs/tasks/TASK_INDEX.md`

Source decisions:

- `DECISION-038` - Platform Data Model Is the Logical Source of Truth.
- `DECISION-039` - Machine Domain Owns Equipment Execution Boundary.

---

# 1. Purpose

Machine State Model describes how the platform represents and changes machine state from planning through retirement, and how a paid order becomes a physical machine operation.

The model exists so the platform can:

- keep machine lifecycle state separate from live runtime status;
- decide whether a machine is eligible for paid fulfillment;
- send safe, idempotent commands to the machine boundary;
- receive trusted machine events and execution results;
- handle errors, offline periods, maintenance and unknown physical outcomes;
- preserve auditability across Order, Payment, Product, Machine, CRM and Analytics domains.

Core rule:

```text
Machine executes commands.
Platform controls business decisions.
Payment confirmation is required before preparation.
Machine reports results through events.
```

This document is documentation-only. It does not introduce application code, database schema, firmware command payloads or production hardware certification.

---

# 2. Boundary Rules

Machine Runtime owns:

- machine lifecycle state;
- machine runtime status;
- command delivery records;
- machine operation state;
- machine-originated execution events;
- inventory, telemetry, maintenance state and incidents;
- recovery records for ambiguous physical outcomes.

Machine Runtime does not own:

- payment authorization, capture, completion or refunds;
- customer bonus or Club Account logic;
- product catalog, product price, media or customer-facing availability;
- Order lifecycle decisions outside accepted machine facts;
- raw firmware implementation;
- CRM screen layout or notification templates.

Required boundary:

```text
Payment Domain confirms payment.
Order Domain accepts paid order state.
Machine Domain accepts paid dispatch context.
Machine executes command and emits events.
Order Domain consumes events and moves order lifecycle.
```

Machine commands must not contain:

- raw card data;
- provider secrets;
- payment provider webhook payloads;
- bonus balances;
- customer profile data beyond approved correlation references;
- UI state;
- raw firmware credentials.

---

# 3. State Axes

Machine state is not one flat field. The platform uses multiple state axes because hardware can be active in the business sense but temporarily offline, busy, degraded or blocked.

| Axis | Owner | Purpose | Examples |
|---|---|---|---|
| Lifecycle state | Machine Runtime | Business and operational life of the machine. | `planned`, `active`, `maintenance`, `retired` |
| Runtime status | Machine Runtime | Current readiness and equipment condition. | `ready`, `busy`, `offline`, `blocked`, `error` |
| Connectivity state | Machine Runtime / adapter | Reachability of machine or adapter. | `unknown`, `connected`, `stale`, `offline` |
| Operation state | Machine Runtime | State of one paid physical fulfillment attempt. | `queued`, `preparing`, `completed`, `failed` |
| Command state | Machine adapter boundary | Delivery and acknowledgement state for one command. | `created`, `sent`, `accepted`, `rejected`, `timeout` |
| Maintenance mode | Machine Runtime / operator | Controlled service reservation. | `inactive`, `scheduled`, `active`, `completion_pending` |
| Incident state | Machine Runtime / CRM | Support and recovery case state. | `open`, `investigating`, `resolved`, `closed` |

Projection rule:

```text
Customer-facing and Order projections may read machine state,
but they must not infer physical completion from timers alone.
```

---

# 4. Machine Lifecycle State Machine

Lifecycle state describes the business life of a machine in the platform.

Canonical lifecycle flow:

```text
planned
  -> registered
  -> installation_pending
  -> commissioning
  -> active
       -> paused -> active
       -> maintenance -> active
       -> out_of_service -> maintenance -> active
       -> retired
```

Lifecycle states:

| State | Meaning | Dispatch eligibility |
|---|---|---|
| `planned` | Machine is expected but platform identity is not production-ready. | Not eligible. |
| `registered` | Platform identity exists. | Not eligible. |
| `installation_pending` | Machine is assigned but not commissioned. | Not eligible. |
| `commissioning` | Machine is being tested, calibrated and connected. | Not eligible for customer orders. |
| `active` | Machine can be considered for paid fulfillment if runtime status is compatible. | Eligible only when runtime status and readiness pass. |
| `paused` | Machine is temporarily unavailable by policy or operator action. | Not eligible. |
| `maintenance` | Machine is reserved for cleaning, refill, repair, calibration or inspection. | Not eligible for customer preparation. |
| `out_of_service` | Machine is not safe or not allowed for fulfillment. | Not eligible. |
| `retired` | Machine is removed from active platform use. | Not eligible; read and audit only. |

Lifecycle transition rules:

- lifecycle changes require actor, reason, timestamp and audit record;
- `active` does not mean `ready`;
- `retired` is terminal for normal operations;
- an `active` machine with `offline`, `blocked`, `error`, `maintenance` or `unknown` runtime status is not dispatch-eligible;
- activation requires approved location, configuration, capability profile, adapter identity and safety readiness.

Lifecycle transition table:

| From | To | Command | Result event | Required notes |
|---|---|---|---|---|
| `planned` | `registered` | `RegisterMachine` | `Machines.Registered` | Creates platform machine identity. |
| `registered` | `installation_pending` | `AssignMachineLocation` | `Machines.LocationAssigned` | Requires approved location. |
| `installation_pending` | `commissioning` | `StartCommissioning` | `Machines.CommissioningStarted` | Requires configuration draft and service actor. |
| `commissioning` | `active` | `ActivateMachine` | `Machines.Activated` | Requires commissioning checks. |
| `active` | `paused` | `PauseMachine` | `Machines.Paused` | Requires operator/system reason. |
| `paused` | `active` | `ResumeMachine` | `Machines.Resumed` | Requires readiness check before dispatch. |
| `active` | `maintenance` | `EnterMaintenanceMode` | `Machines.MaintenanceModeEntered` | Blocks customer operations. |
| `maintenance` | `active` | `ExitMaintenanceMode` | `Machines.MaintenanceModeExited` | Requires service completion and readiness check. |
| `active` | `out_of_service` | `MarkMachineOutOfService` | `Machines.MarkedOutOfService` | Used for safety, policy or severe fault. |
| `paused` | `out_of_service` | `MarkMachineOutOfService` | `Machines.MarkedOutOfService` | Used when pause cannot be resolved safely. |
| `out_of_service` | `maintenance` | `EnterMaintenanceMode` | `Machines.MaintenanceModeEntered` | Recovery work begins. |
| `out_of_service` | `retired` | `RetireMachine` | `Machines.Retired` | Preserves audit and historical references. |
| `active` | `retired` | `RetireMachine` | `Machines.Retired` | Allowed only when no active operation exists. |

Invalid lifecycle transitions must be rejected and audited.

---

# 5. Runtime Status State Machine

Runtime status describes current machine readiness and physical condition.

Canonical runtime flow for a normal paid operation:

```text
online
  -> ready
  -> busy
  -> preparing
  -> dispensing
  -> product_ready
  -> ready
```

Alternative runtime branches:

```text
ready -> degraded -> ready
ready -> blocked -> ready
ready -> error -> maintenance -> ready
online -> offline -> unknown -> online
ready -> cleaning -> ready
ready -> maintenance -> ready
```

Runtime statuses:

| Status | Meaning | Dispatch eligibility |
|---|---|---|
| `unknown` | Platform has no reliable current runtime state. | Not eligible. |
| `offline` | Machine or adapter is not reachable. | Not eligible. |
| `online` | Machine is reachable but readiness has not passed. | Not eligible until readiness passes. |
| `ready` | Machine is online, safe, stocked and can accept a compatible operation. | Eligible. |
| `busy` | Machine has accepted work or queue policy blocks another operation. | Eligible only for allowed queued work. |
| `preparing` | Physical product preparation is running. | Not eligible for conflicting operation. |
| `dispensing` | Product is being dispensed or presented. | Not eligible for conflicting operation. |
| `product_ready` | Product is ready for pickup or already presented. | Not eligible for conflicting operation. |
| `cleaning` | Cleaning or sanitation cycle is running. | Not eligible. |
| `maintenance` | Service work is active. | Not eligible. |
| `degraded` | Machine works with reduced capability. | Eligible only for supported recipes and policy. |
| `blocked` | Safety, inventory, door, temperature or component condition blocks operation. | Not eligible. |
| `error` | Machine reported a fault requiring recovery. | Not eligible. |
| `out_of_service` | Machine is intentionally removed from fulfillment. | Not eligible. |

Runtime status transition table:

| From | To | Trigger | Event |
|---|---|---|---|
| `unknown` | `online` | trusted heartbeat or status report received | `Machines.StatusChanged` |
| `unknown` | `offline` | stale status window elapsed | `Machines.StatusChanged` |
| `offline` | `online` | authenticated adapter reconnects | `Machines.StatusChanged` |
| `online` | `ready` | readiness check passes | `Machines.StatusChanged` |
| `ready` | `busy` | queue entry or operation lock accepted | `Machines.StatusChanged` |
| `busy` | `preparing` | machine accepted `PrepareProduct` and starts physical work | `Machines.PreparationStarted` |
| `preparing` | `dispensing` | dispense stage starts | `Machines.StatusChanged` |
| `dispensing` | `product_ready` | product presented or ready | `Machines.ProductReady` |
| `product_ready` | `ready` | product taken or pickup window resolved | `Machines.StatusChanged` |
| `ready` | `cleaning` | cleaning cycle starts | `Machines.CleaningStarted` |
| `cleaning` | `ready` | cleaning cycle completed and readiness passes | `Machines.CleaningCompleted` |
| any non-terminal status | `blocked` | safety, inventory or component block detected | `Machines.StatusChanged` |
| `blocked` | `ready` | block resolved and readiness passes | `Machines.StatusChanged` |
| any non-terminal status | `error` | fault reported | `Machines.ErrorReported` |
| `error` | `maintenance` | service recovery starts | `Machines.MaintenanceModeEntered` |
| `maintenance` | `ready` | service completed and readiness passes | `Machines.MaintenanceModeExited` |
| `online`, `ready`, `busy`, `degraded` | `offline` | heartbeat or adapter lost beyond stale window | `Machines.StatusChanged` |

Status rules:

- stale telemetry is not proof of readiness;
- status changes must include `machine_id`, source, timestamp and correlation metadata where available;
- hardware, adapter, health monitor and operator sources must be distinguishable;
- a machine must not start preparation when runtime status is incompatible with the command;
- `degraded` must describe affected capabilities rather than hide them behind a generic ready state.

---

# 6. Operation State Machine

Operation state describes one physical fulfillment attempt for one paid order item.

Canonical operation flow:

```text
created
  -> queued
  -> command_created
  -> command_sent
  -> command_accepted
  -> operation_locked
  -> preparing
  -> dispensing
  -> product_ready
  -> product_taken
  -> completed
```

Failure and recovery branches:

```text
command_sent -> ack_timeout -> reconciliation_required
command_accepted -> preparation_failed -> failed
dispensing -> dispensing_failed -> reconciliation_required
product_ready -> product_not_taken -> recovery_required
reconciliation_required -> completed
reconciliation_required -> failed
reconciliation_required -> support_review
```

Operation states:

| State | Meaning | Side-effect risk |
|---|---|---|
| `created` | Operation record exists for accepted paid dispatch context. | None. |
| `queued` | Operation is waiting for machine dispatch. | None. |
| `command_created` | Idempotent command envelope exists. | None. |
| `command_sent` | Command was sent to adapter or controller. | Possible physical side effect. |
| `ack_timeout` | Command acknowledgement was not received in time. | Unknown. |
| `command_rejected` | Machine rejected command before physical preparation. | None if rejection is trusted. |
| `command_accepted` | Machine accepted command. | Possible physical side effect. |
| `operation_locked` | Machine locked the operation against duplicate execution. | Possible physical side effect. |
| `preparing` | Product preparation started. | Active physical side effect. |
| `dispensing` | Product is being dispensed or presented. | Active physical side effect. |
| `product_ready` | Product is ready or presented. | Physical product exists. |
| `product_taken` | Pickup detected where supported. | Physical product left pickup zone. |
| `completed` | Machine operation reached terminal success. | Terminal. |
| `preparation_failed` | Product preparation failed. | Terminal or recovery-required. |
| `dispensing_failed` | Dispensing or presentation failed. | Recovery-required. |
| `product_not_taken` | Product remained after pickup window. | Recovery-required. |
| `reconciliation_required` | Outcome is ambiguous and must be resolved. | High. |
| `support_review` | Manual support or service review is needed. | Depends on case. |
| `failed` | Machine operation reached terminal failure. | Terminal. |
| `cancelled_before_start` | Queued operation was cancelled before physical work. | Terminal. |

Operation invariants:

- `created` requires accepted paid dispatch context from Order;
- `PrepareProduct` must not be issued before payment confirmation is accepted by Order;
- after `command_sent`, retries must be gated by reconciliation and idempotency;
- unknown physical outcome is neither success nor failure until reconciled;
- terminal operation records are preserved and corrected through new recovery or compensating records.

---

# 7. Command State Model

Commands are platform requests to Machine Runtime, a machine adapter or a physical controller.

Command states:

| State | Meaning |
|---|---|
| `created` | Command envelope was created with idempotency metadata. |
| `validated` | Platform validation passed. |
| `rejected_before_send` | Command was rejected before adapter delivery. |
| `sent` | Command was delivered to adapter or controller. |
| `received` | Adapter or machine reported receipt. |
| `accepted` | Machine accepted command for execution. |
| `rejected` | Machine rejected command. |
| `timeout` | Expected acknowledgement was not received. |
| `cancelled` | Command was cancelled before physical side effect, where supported. |
| `completed` | Command reached its expected result. |
| `failed` | Command failed and generated an error or incident. |
| `duplicate` | Duplicate idempotency key matched an existing command. |
| `conflict` | Same idempotency key was reused with different payload. |

Command rules:

- commands are not events;
- side-effect commands require idempotency keys;
- duplicate compatible commands return existing state or result;
- conflicting duplicate commands are rejected and audited;
- commands carry correlation and causation metadata;
- command payload versioning is mandatory when shape can change;
- adapters translate platform commands to hardware protocol and keep protocol details inside the adapter boundary.

---

# 8. Commands

Commands describe intent. Events describe accepted facts.

Lifecycle and configuration commands:

| Command | Purpose | Required preconditions | Resulting facts |
|---|---|---|---|
| `RegisterMachine` | Create platform machine identity. | Approved actor and unique alias. | `Machines.Registered` |
| `AssignMachineLocation` | Assign or change machine location. | Machine registered; location approved. | `Machines.LocationAssigned` |
| `UpdateMachineConfiguration` | Apply approved configuration version. | Authorized actor; versioned config. | `Machines.ConfigurationChanged` |
| `UpdateMachineCapabilities` | Apply capability profile or report. | Trusted source; valid capability schema. | `Machines.CapabilitiesChanged` |
| `SetMachineLifecycleState` | Change lifecycle state. | Allowed transition; actor and reason. | lifecycle event, audit record |
| `ActivateMachine` | Move commissioned machine into active use. | Commissioning complete; readiness approved. | `Machines.Activated` |
| `PauseMachine` | Temporarily block business use. | Active or commissioning machine. | `Machines.Paused` |
| `ResumeMachine` | Return paused machine to active candidate pool. | Pause reason resolved. | `Machines.Resumed` |
| `MarkMachineOutOfService` | Remove machine from fulfillment for safety or policy. | Authorized actor or system rule. | `Machines.MarkedOutOfService` |
| `RetireMachine` | Remove machine from active platform use. | No active operation; approval. | `Machines.Retired` |

Runtime and operation commands:

| Command | Purpose | Required preconditions | Resulting facts |
|---|---|---|---|
| `RequestMachineStatus` | Ask adapter or machine for current status. | Trusted caller and machine identity. | `Machines.StatusReported` or `Machines.StatusChanged` |
| `RecordMachineStatus` | Accept normalized machine status fact. | Authenticated source; schema valid. | `Machines.StatusChanged` |
| `CreateDispatchQueueEntry` | Queue paid fulfillment operation. | Order is paid; recipe and machine eligible. | `Machines.DispatchQueued` |
| `PrepareProduct` | Start idempotent product preparation. | Paid dispatch accepted; ready machine; compatible recipe. | `Machines.CommandReceived`, `Machines.CommandAccepted`, execution events |
| `CancelQueuedOperation` | Cancel queued work before physical preparation. | Operation not physically started. | `Machines.OperationCancelled` |
| `SafeStopOperation` | Stop active operation when safe and policy allows. | Supported by adapter; safety policy permits. | `Machines.OperationStopped` or failure event |
| `ReconcileMachineOperation` | Determine outcome for ambiguous operation. | Unknown or timeout state exists. | `Machines.OperationReconciled` |
| `RequestInventoryReport` | Ask for inventory state. | Trusted caller; adapter supports report. | `Machines.InventoryReported` |
| `RecordInventoryAdjustment` | Record refill, correction, waste or sensor-derived change. | Authorized source and reason. | `Machines.InventoryChanged` |
| `StartCleaningCycle` | Start cleaning or sanitation cycle. | Machine supports cleaning; no active customer operation. | `Machines.CleaningStarted` |
| `RecordMaintenanceAction` | Record repair, refill, calibration or inspection. | Operator identity and reason. | `Machines.MaintenanceActionRecorded` |
| `ResolveMachineIncident` | Close incident after recovery. | Evidence or approved operator decision. | `Machines.IncidentResolved` |
| `RebootController` | Request controlled controller reboot. | Supported adapter; no unsafe active operation. | `Machines.ControllerRebootRequested` |

`PrepareProduct` gate:

```text
PrepareProduct is allowed only after:

Payment confirmed
-> Order accepted paid state
-> Dispatch context accepted
-> Machine readiness and capability checks passed
-> Command idempotency key validated
```

---

# 9. Events

Events are accepted facts. They are produced by Machine Runtime, adapter, trusted machine source or authorized operator workflow.

Lifecycle and status events:

| Event | Meaning |
|---|---|
| `Machines.Registered` | Machine identity exists. |
| `Machines.LocationAssigned` | Machine location assignment changed. |
| `Machines.ConfigurationChanged` | Configuration version accepted. |
| `Machines.CapabilitiesChanged` | Capability profile or report changed. |
| `Machines.Activated` | Machine became active. |
| `Machines.Paused` | Machine was paused. |
| `Machines.Resumed` | Machine was resumed. |
| `Machines.MarkedOutOfService` | Machine was removed from fulfillment. |
| `Machines.Retired` | Machine was retired. |
| `Machines.StatusReported` | Status report was accepted. |
| `Machines.StatusChanged` | Runtime status changed. |

Command and operation events:

| Event | Meaning |
|---|---|
| `Machines.DispatchQueued` | Paid order item entered machine queue. |
| `Machines.CommandReceived` | Adapter or machine received command. |
| `Machines.CommandAccepted` | Machine accepted command. |
| `Machines.CommandRejected` | Machine rejected command. |
| `Machines.CommandTimedOut` | Command acknowledgement timed out. |
| `Machines.OperationLocked` | Machine locked operation for execution. |
| `Machines.PreparationStarted` | Physical preparation started. |
| `Machines.IceCreamDispensed` | Base portion was dispensed. |
| `Machines.SyrupDispensed` | Syrup portion was dispensed. |
| `Machines.ToppingDispensed` | Topping portion was dispensed. |
| `Machines.ProductReady` | Product was prepared or presented. |
| `Machines.ProductTaken` | Pickup was detected. |
| `Machines.ProductNotTaken` | Pickup window expired or product remained. |
| `Machines.OperationCompleted` | Operation reached terminal success. |
| `Machines.OperationFailed` | Operation reached terminal failure. |
| `Machines.OperationReconciled` | Ambiguous operation outcome was resolved. |

Maintenance, telemetry and error events:

| Event | Meaning |
|---|---|
| `Machines.InventoryChanged` | Inventory fact was accepted. |
| `Machines.InventoryLow` | Inventory crossed low threshold. |
| `Machines.TelemetryReported` | Telemetry fact was accepted where eventing is needed. |
| `Machines.MaintenanceRequired` | Service action is needed. |
| `Machines.MaintenanceModeEntered` | Machine entered maintenance mode. |
| `Machines.MaintenanceActionRecorded` | Service action was recorded. |
| `Machines.MaintenanceModeExited` | Machine exited maintenance mode. |
| `Machines.CleaningStarted` | Cleaning cycle started. |
| `Machines.CleaningCompleted` | Cleaning cycle completed. |
| `Machines.PreparationFailed` | Product preparation failed. |
| `Machines.DispensingFailed` | Product dispensing or presentation failed. |
| `Machines.ErrorReported` | Fault was accepted. |
| `Machines.IncidentOpened` | Machine incident was opened. |
| `Machines.IncidentResolved` | Machine incident was resolved. |

Event rules:

- event payloads use platform IDs and snake_case fields;
- events include `machine_id`, timestamp, source, correlation ID and causation ID where available;
- operation events include `machine_operation_id`, `command_id`, `order_id`, `order_item_id` and `recipe_id` where applicable;
- machine-originated facts require authenticated machine or adapter identity;
- event replay must not resend machine commands or repeat physical preparation.

---

# 10. Error States

Error states are machine, command, adapter or operational conditions. They are not payment provider errors.

| Error state | Typical cause | Required handling |
|---|---|---|
| `offline` | Adapter or controller unreachable. | Block dispatch; reconcile active operations. |
| `unknown` | Status is stale or no trusted state exists. | Request status; do not dispatch. |
| `blocked` | Door, hatch, temperature, inventory or component blocks operation. | Resolve block before dispatch. |
| `degraded` | Machine can operate only with reduced capability. | Allow only compatible recipes if policy permits. |
| `error` | Machine reported fault. | Open incident; require recovery. |
| `ack_timeout` | Command acknowledgement missing. | Reconcile before retry. |
| `command_rejected` | Command rejected by machine or platform validation. | Keep operation unstarted if rejection is trusted. |
| `preparation_failed` | Physical preparation failed. | Emit failure event; start recovery flow. |
| `dispensing_failed` | Product could not be dispensed or presented correctly. | Reconcile partial outcome. |
| `operation_unknown` | Machine may or may not have executed command. | Reconcile; do not infer success. |
| `product_not_taken` | Product stayed in pickup zone after window. | Apply approved no-pickup policy. |
| `maintenance_required` | Cleaning, refill, calibration or repair required. | Enter maintenance or block affected capability. |

Recommended error codes:

| Code | Meaning |
|---|---|
| `MACHINE_NOT_FOUND` | Machine ID is unknown. |
| `MACHINE_NOT_ACTIVE` | Lifecycle blocks operation. |
| `MACHINE_OFFLINE` | Machine or adapter is unreachable. |
| `MACHINE_STATUS_STALE` | Status is too old to trust. |
| `MACHINE_BUSY` | Machine cannot accept conflicting work. |
| `MACHINE_UNSAFE` | Safety interlock, temperature or emergency condition blocks operation. |
| `MACHINE_MAINTENANCE_ACTIVE` | Service mode is active. |
| `MACHINE_RECIPE_UNSUPPORTED` | Machine cannot prepare accepted recipe. |
| `MACHINE_INVENTORY_INSUFFICIENT` | Required ingredient or consumable is unavailable. |
| `MACHINE_COMPONENT_BLOCKED` | Component jam or blockage detected. |
| `MACHINE_TEMPERATURE_OUT_OF_RANGE` | Product safety or quality temperature is unsafe. |
| `MACHINE_COMMAND_DUPLICATE` | Duplicate command matches existing operation. |
| `MACHINE_COMMAND_CONFLICT` | Idempotency key is reused with a different payload. |
| `MACHINE_COMMAND_UNAUTHORIZED` | Command source is not trusted. |
| `MACHINE_UNPAID_ORDER_REJECTED` | Command lacks accepted paid dispatch context. |
| `MACHINE_ACK_TIMEOUT` | Acknowledgement was not received in time. |
| `MACHINE_OPERATION_UNKNOWN` | Outcome cannot be confirmed. |
| `MACHINE_PREPARATION_FAILED` | Product preparation failed. |
| `MACHINE_DISPENSING_FAILED` | Product delivery failed or was blocked. |
| `MACHINE_PRODUCT_NOT_TAKEN` | Product remained after pickup window. |
| `MACHINE_TELEMETRY_INVALID` | Telemetry shape or source is invalid. |

Error rules:

- unknown outcome is not success;
- repeated physical side effects require reconciliation first;
- errors are correlated to command, operation, order and machine where possible;
- errors must not expose secrets, provider credentials or unnecessary personal data;
- payment compensation is requested through Order and Payment workflows, not by Machine Runtime directly.

---

# 11. Recovery Flows

Recovery flows preserve customer, financial, safety and audit boundaries.

## 11.1 Offline Before Dispatch

```text
Machine status becomes offline or unknown
-> dispatch eligibility becomes false
-> Order remains paid but not machine-prepared
-> platform may select another eligible machine if policy allows
-> if no machine is available, Order enters support/recovery path
```

Rules:

- no `PrepareProduct` command is sent to an offline or unknown machine;
- alternate-machine policy requires Product Owner approval before customer-facing automation;
- Payment records are not changed by Machine Runtime.

## 11.2 Offline After Command Sent

```text
PrepareProduct command sent
-> acknowledgement missing or connection lost
-> operation enters ack_timeout or reconciliation_required
-> platform requests status when connection returns
-> operation is resolved as completed, failed or support_review
```

Rules:

- do not blindly resend `PrepareProduct`;
- use idempotency key and operation ID when retrying status or command reconciliation;
- if physical outcome remains unknown, create support review or incident.

## 11.3 Command Rejected

```text
Command rejected before physical start
-> Machines.CommandRejected emitted
-> operation becomes command_rejected or failed
-> Order consumes failure fact and chooses recovery path
```

Rules:

- rejection reason must be safe and machine-readable;
- unpaid order rejection raises a security or process incident;
- unsupported recipe, inventory shortage or safety block does not mutate Product catalog globally.

## 11.4 Preparation Failed

```text
Preparation started
-> machine reports failure
-> Machines.PreparationFailed emitted
-> operation becomes preparation_failed or failed
-> incident or maintenance may be opened
-> Order evaluates retry, support or refund compensation policy
```

Rules:

- partial ingredient usage may create inventory adjustment or waste record;
- refund is not executed by Machine Runtime;
- repeated failures should move machine to maintenance or out_of_service.

## 11.5 Dispensing Failed or Ambiguous

```text
Dispensing starts
-> sensor or adapter reports failure, timeout or unclear result
-> operation enters dispensing_failed or reconciliation_required
-> telemetry, status and operator evidence are reviewed
-> final outcome is completed, failed or support_review
```

Rules:

- a product-presented signal is required before customer pickup can be treated as ready where hardware supports it;
- if product might have been dispensed, support review is safer than automatic retry;
- customer compensation belongs to Order and Payment policies.

## 11.6 Product Not Taken

```text
ProductReady emitted
-> pickup window expires or product remains
-> ProductNotTaken emitted
-> operation enters product_not_taken or recovery_required
-> no-pickup policy determines next step
```

Rules:

- no-pickup policy requires explicit approval before production automation;
- machine may require cleaning or operator removal after abandoned product;
- Order completion, cancellation or compensation depends on approved customer policy.

## 11.7 Maintenance Recovery

```text
Error, blocked state or scheduled service detected
-> maintenance mode entered
-> service action recorded
-> readiness check executed
-> maintenance mode exited
-> runtime status becomes ready or remains blocked/error
```

Rules:

- service completion alone does not complete paid orders;
- active or ambiguous operations must be reconciled separately;
- inventory adjustments require reason and audit.

---

# 12. Offline Behavior

Offline behavior protects against unsafe physical side effects.

Connectivity states:

| State | Meaning | Dispatch behavior |
|---|---|---|
| `unknown` | No reliable connectivity state. | Block dispatch. |
| `connected` | Adapter or machine is reachable. | Eligibility still requires readiness checks. |
| `stale` | Last heartbeat or status is too old. | Block dispatch until refreshed. |
| `offline` | Adapter or machine is unreachable. | Block dispatch and reconcile active operations. |

Offline rules:

- stale status degrades to `unknown` or `offline` according to health policy;
- new `PrepareProduct` commands must not be issued while machine is `offline`, `stale` or `unknown`;
- offline queueing for future physical execution is not approved for MVP production;
- if future offline queue capability is approved, it must still require paid dispatch context before any preparation starts;
- machine-originated events buffered during offline periods require authentication, ordering metadata and replay protection when reconnected;
- connection recovery must request current status and reconcile active operations before accepting new customer work;
- customer UI and CRM must not treat reconnect as proof that a previous operation succeeded.

Heartbeat and stale status policy must be defined before runtime implementation.

---

# 13. Maintenance Mode

Maintenance mode is a controlled service reservation. It can be represented both as lifecycle state and runtime status when service work is active.

Maintenance states:

| State | Meaning |
|---|---|
| `inactive` | No maintenance reservation is active. |
| `scheduled` | Maintenance is planned but not started. |
| `entry_pending` | Platform is blocking new work and preparing service mode. |
| `active` | Service work is in progress. |
| `completion_pending` | Service work is done but readiness checks are not complete. |
| `completed` | Maintenance action completed and machine can return to policy-selected lifecycle state. |
| `failed` | Maintenance action failed or did not clear the issue. |

Allowed maintenance commands:

- `RequestMachineStatus`;
- `RequestInventoryReport`;
- `RecordInventoryAdjustment`;
- `StartCleaningCycle`;
- `RecordMaintenanceAction`;
- `UpdateMachineConfiguration`;
- `UpdateMachineCapabilities`;
- `RebootController`;
- `ResolveMachineIncident`;
- `ExitMaintenanceMode`.

Blocked during active maintenance:

- customer `PrepareProduct`;
- new paid dispatch queue acceptance for that machine;
- automatic order completion;
- silent incident closure;
- unaudited configuration or inventory changes.

Maintenance rules:

- entering maintenance blocks customer preparation unless an explicitly approved limited safe operation exists;
- operator identity, role, reason and timestamp are mandatory;
- cleaning, refill, repair and calibration can change readiness, capability or inventory state;
- unresolved maintenance incidents keep the machine out of eligibility;
- exiting maintenance requires readiness check and may return to `active`, `paused` or `out_of_service` according to the resolved condition.

---

# 14. Security Rules

Machine commands and events are sensitive because they can cause physical side effects.

Authentication and authorization:

- machines and adapters must authenticate before sending events or accepting commands;
- operator actions require role, actor ID, reason and audit record;
- unauthenticated machine-originated facts are rejected;
- command issuers must be authorized for the command type and machine scope;
- service mode commands require service or operations permissions.

Replay and idempotency:

- side-effect commands require idempotency keys;
- command payload hash must be compared for duplicate keys;
- duplicate compatible commands return existing command or operation state;
- duplicate conflicting commands are rejected and audited;
- machine-originated offline event replay requires ordering and replay protection.

Data minimization:

- commands and events must not carry raw payment credentials, provider secrets, raw card data, API keys, bot tokens, customer profile data or unnecessary personal data;
- safe references such as `order_id`, `order_item_id`, `payment_id`, `recipe_id`, `dispatch_id`, `machine_operation_id` and `correlation_id` are allowed when needed for audit;
- raw firmware protocol payloads stay inside adapter records unless explicitly approved for protected diagnostics.

Audit:

- accepted commands, rejected commands, acknowledgement timeouts, retries, preparation start, failures, product ready, product taken, maintenance and operator recovery are auditable;
- security rejections use safe reason codes;
- audit records are append-only and must not include secrets.

---

# 15. Integration Boundaries

## 15.1 Order Domain

Order Domain owns purchase lifecycle and consumes machine facts through approved transitions.

Rules:

- Order may request machine fulfillment only after paid state is accepted;
- Machine queue acceptance can support Order fulfillment progress;
- Machine events can trigger Order transitions, but Machine Runtime does not mutate Order state directly;
- machine failure after payment triggers Order recovery, support or refund compensation policy.

## 15.2 Payment Domain

Payment Domain owns settlement confirmation and refunds.

Rules:

- Machine Runtime does not create, authorize, capture, cancel or refund payments;
- payment ambiguity blocks dispatch;
- machine failure does not rewrite Payment records;
- refund compensation is requested through Order and Payment workflows.

## 15.3 Product and Recipe Domains

Product Domain owns catalog, pricing source rules, media and recipe source models.

Rules:

- Machine commands use accepted `recipe_id` and immutable Order snapshots;
- Machine capability checks validate whether this machine can execute the accepted recipe now;
- unsupported recipe on one machine blocks that machine or recipe-machine pairing, not the global product catalog;
- ingredient slot mappings use stable semantic IDs such as `syrup_strawberry` and `topping_oreo`.

## 15.4 Machine Adapter Boundary

The adapter translates platform commands into hardware-specific protocol.

Rules:

- adapter exposes normalized command acknowledgement, status, telemetry and execution facts;
- raw firmware details stay behind adapter contracts;
- adapter must preserve command idempotency and correlation;
- adapter cannot decide payment eligibility or customer compensation.

## 15.5 API and Event Platform

API and Event Platform transport contracts; they do not own business decisions.

Rules:

- REST routes call Runtime contracts instead of embedding state transitions;
- Event API transports immutable accepted facts;
- event replay rebuilds projections but never repeats physical commands.

## 15.6 CRM, Maintenance and Support

CRM consumes projections and issues approved commands.

Rules:

- operators cannot mark a payment completed from Machine Domain;
- operators cannot grant bonuses from Machine Domain;
- manual operation closure requires evidence and approved support policy;
- support notes must not leak provider secrets, machine credentials or unnecessary personal data.

## 15.7 Analytics

Analytics consumes minimized events and projections.

Rules:

- analytics does not mutate machine, order or payment state;
- telemetry retained for analytics must follow retention and privacy policies;
- machine incidents and safety facts remain audit-sensitive.

---

# 16. Readiness Criteria

MACHINE-STATE-001 is complete when:

- machine lifecycle state machine is documented;
- runtime status state machine is documented;
- operation and command state models are documented;
- state transitions are documented;
- commands and events are documented;
- error states and recovery flows are documented;
- offline behavior is documented;
- maintenance mode is documented;
- security rules are documented;
- integration boundaries are documented;
- payment confirmation before preparation is preserved;
- machine executes commands and reports events;
- platform retains business decision ownership;
- tracking files are updated;
- no application source code is modified.

Future implementation requires separate approval for:

- exact command schemas;
- exact event payload schemas;
- adapter authentication and replay protection;
- heartbeat and stale status windows;
- no-pickup policy;
- partial/ambiguous dispensing compensation policy;
- alternate-machine fulfillment after payment;
- hardware-specific safety certification.

---

# 17. Documentation Scope

This document is documentation-only.

It does not introduce application code, frontend code, backend code, Telegram bot code, runtime configuration, database migrations, generated build output, payment provider integration, real machine firmware commands, real machine credentials, CRM screens, notification templates, final hardware protocol definitions or final hardware safety certification.
