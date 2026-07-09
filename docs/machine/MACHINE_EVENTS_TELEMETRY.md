# Machine Events and Telemetry

Document code: MACHINE-EVENTS-TELEMETRY-001
Task: EPIC-374 / MACHINE-004
Version: 0.1
Status: Draft
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-09
Last updated: 2026-07-09
Scope: Documentation only

This document defines event-driven communication between the Machine Digital Twin and the Soft ICE Platform.

The Machine Digital Twin is the platform projection of one physical vending machine. It is updated from authenticated machine, adapter, operator and health-monitor facts. It must not invent physical facts from timers, UI state or customer expectations.

Related documents:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `docs/domain/MACHINE_DOMAIN.md`
- `docs/machine/MACHINE_PASSPORT.md`
- `docs/machine/MACHINE_STATE_MODEL.md`
- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/api/EVENT_API.md`
- `docs/architecture/PROJECT_DECISIONS.md`
- `docs/tasks/TASK_INDEX.md`

Source decisions:

- `DECISION-038` - Platform Data Model Is the Logical Source of Truth.
- `DECISION-039` - Machine Domain Owns Equipment Execution Boundary.
- Event API Fact Boundary - Event API transports Runtime-owned facts and must not own business logic.

Core rule:

```text
Machine reports facts.
Machine Digital Twin records and projects accepted facts.
Platform makes business decisions.
Events do not repeat physical side effects.
```

This document is documentation-only. It does not introduce application code, database schema, firmware protocol, runtime configuration, generated build output or production hardware certification.

---

# 1. Purpose

Machine Events and Telemetry define how the physical vending machine, adapter, Machine Runtime and platform consumers exchange operational facts.

The document exists so the platform can:

- keep machine facts separate from commands and business decisions;
- update the Machine Digital Twin from authenticated events and telemetry;
- correlate machine facts with orders, payments, operations, maintenance and incidents;
- detect readiness, degraded state, failures and maintenance needs;
- preserve auditability for physical preparation and dispensing;
- support idempotent event consumers, offline buffering and delayed delivery;
- prepare future Event Registry, schema, adapter and telemetry implementation work.

MVP goal supported by this document:

```text
A customer can select a dessert, pay for it and receive it from a vending machine.
```

The machine communication goal:

```text
After payment and accepted dispatch, the platform sends commands.
The machine or adapter reports what actually happened.
The platform consumes those facts through approved domain boundaries.
```

Out of scope:

- final firmware protocol;
- final JSON Schema or AsyncAPI contracts;
- real hardware sensor inventory;
- exact heartbeat intervals;
- exact retention periods;
- production security implementation;
- order, payment, refund, bonus or CRM implementation logic.

---

# 2. Event-Driven Architecture Principles

Machine communication follows the Event API architecture.

Principles:

1. Events are immutable facts.
2. Events describe things that already happened.
3. Commands request work; events report accepted facts.
4. Machine-originated facts require authenticated machine or adapter identity.
5. The Machine Digital Twin is updated only from accepted events, telemetry reports, operator actions and health-monitor facts.
6. Event API owns envelope validation, routing, retry, replay and dead-letter behavior.
7. Machine Runtime owns machine event payload meaning.
8. Platform domains consume machine facts idempotently.
9. Consumers must tolerate duplicates, delayed events and out-of-order events.
10. Event replay must never resend machine commands or repeat physical preparation.
11. Stale telemetry is not proof of readiness.
12. Telemetry can produce events when it crosses business or safety thresholds.

Approved flow:

```text
Machine, adapter or operator fact
  -> source authentication
  -> adapter normalization where needed
  -> Machine Runtime validation
  -> Machine event or telemetry accepted
  -> Event API envelope accepted
  -> Machine Digital Twin projection updated
  -> platform consumers react through their own Runtime contracts
```

Forbidden flow:

```text
Telemetry or event
  -> marks payment completed
  -> grants bonus
  -> calculates price
  -> silently completes order without approved Order transition
  -> repeats a physical command during replay
```

Machine Digital Twin rules:

- it represents the latest accepted machine projection, not the hardware itself;
- it must keep `last_seen_at`, source and freshness metadata;
- it may mark readiness as stale or unknown when events stop arriving;
- it must not infer product completion from elapsed time alone;
- it can support dispatch eligibility checks only through Machine Runtime policy;
- it does not replace service operator evidence when physical outcome is ambiguous.

---

# 3. Machine Event Model

Machine events use the Event API envelope and a Machine-owned payload.

Canonical Event API name:

```text
Machines.<EventType>
```

Example:

```text
event_type: MachineReady
event_name: Machines.MachineReady
```

## 3.1 Event Identity

Every event has a globally unique `event_id`.

Rules:

- `event_id` identifies one accepted fact;
- publication retries and offline redelivery of the same fact reuse the same `event_id`;
- duplicate compatible deliveries are deduplicated by `event_id`;
- machine or adapter source IDs may be stored as `source_event_id`, but they do not replace platform `event_id`;
- if the source can provide ordering, include `source_sequence` or `aggregate_sequence`;
- event identity must be stable enough for audit, replay and support investigation.

Recommended fields:

| Field | Required | Meaning |
|---|---|---|
| `event_id` | Yes | Platform event identity. |
| `event_name` | Yes | Event API name, for example `Machines.MachineReady`. |
| `event_version` | Yes | Integer event contract version. |
| `source_event_id` | Optional | Source-generated event ID from adapter or controller. |
| `aggregate_sequence` | Recommended | Machine or operation sequence when available. |
| `idempotency_key` | Optional | Duplicate handling key where the fact is tied to a side-effect command. |

## 3.2 Event Type

`event_type` is the Machine-local fact type.

Rules:

- event types use English PascalCase;
- event types describe facts, not commands;
- the same event type must keep the same meaning for a given version;
- breaking payload or semantic changes require a new version;
- event type names in this document are Machine domain types, even when they contain the word `Order`.

Example:

```json
{
  "event_name": "Machines.OrderAccepted",
  "payload": {
    "event_type": "OrderAccepted"
  }
}
```

`Machines.OrderAccepted` means the Machine boundary accepted a paid dispatch context for physical execution. It does not mean the Order Domain accepted or paid the order.

## 3.3 Timestamp

Machine events must distinguish occurrence, observation and publication time.

Recommended fields:

| Field | Required | Meaning |
|---|---|---|
| `occurred_at` | Yes | UTC time when the fact occurred according to the trusted source. |
| `observed_at` | Recommended | UTC time when adapter or Machine Runtime observed the fact. |
| `published_at` | Yes in Event API | UTC time when Event Runtime accepted the event. |
| `received_at` | Optional | UTC time when platform ingress received the fact. |

Rules:

- timestamps use UTC ISO 8601 / RFC 3339 format;
- delayed events keep original `occurred_at`;
- freshness decisions use `occurred_at`, `received_at`, source and health policy;
- consumer projections must not assume that delivery order equals occurrence order.

## 3.4 Machine Identifier

Every machine event must include `machine_id`.

Rules:

- `machine_id` is the primary platform machine identifier;
- external aliases such as controller ID or vendor ID are source metadata only;
- a machine event without resolvable `machine_id` is rejected or quarantined;
- machine group, location and adapter IDs may be included when useful for routing or support;
- events must not use customer device location as machine location source of truth.

Recommended fields:

| Field | Required | Meaning |
|---|---|---|
| `machine_id` | Yes | Platform machine identity. |
| `machine_code` | Optional | Human-friendly internal code. |
| `controller_alias` | Optional | Vendor or hardware alias. |
| `adapter_id` | Recommended | Machine adapter identity. |
| `location_id` | Recommended | Current platform location reference where known. |

## 3.5 Correlation ID

`correlation_id` links machine facts to a business or operational flow.

Rules:

- order execution events use the order or checkout correlation chain;
- hardware and lifecycle events use machine health, maintenance or incident correlation when available;
- `causation_id` references the command, event, request or external fact that caused this event;
- command-related events include `command_id` and `machine_operation_id` where applicable;
- missing correlation is allowed for autonomous hardware facts but should be minimized.

Recommended correlation fields:

| Field | Meaning |
|---|---|
| `correlation_id` | End-to-end trace for the flow. |
| `causation_id` | Command, event, request or telemetry sample that caused the fact. |
| `machine_operation_id` | Physical operation attempt. |
| `command_id` | Machine command delivery record. |
| `dispatch_id` | Paid dispatch context reference. |
| `order_id` | Order reference where applicable. |
| `order_item_id` | Order item reference where applicable. |
| `recipe_id` | Accepted recipe reference where applicable. |

## 3.6 Payload

The payload contains Machine-owned fact data.

Payload rules:

- payload fields use `snake_case`;
- payload schema is versioned;
- payload contains normalized platform fields, not raw firmware protocol by default;
- raw vendor details stay inside protected adapter diagnostics unless explicitly approved;
- payload must not contain payment credentials, provider secrets, raw card data, bonus balances, UI state or unnecessary personal data;
- order execution payloads reference immutable order and recipe snapshots through IDs, not mutable catalog data.

Required payload fields:

| Field | Meaning |
|---|---|
| `event_type` | Machine-local event type. |
| `machine_id` | Platform machine identity. |
| `severity` | Operational severity. |
| `source` | Structured source descriptor. |

Recommended optional payload fields:

- `status`;
- `previous_status`;
- `machine_operation_id`;
- `command_id`;
- `dispatch_id`;
- `order_id`;
- `order_item_id`;
- `recipe_id`;
- `component_id`;
- `component_type`;
- `item_id`;
- `threshold`;
- `measurement`;
- `reason_code`;
- `error_code`;
- `recovery_hint`;
- `telemetry_ref`.

## 3.7 Source

`source` identifies where the fact came from.

Allowed source types:

| Source type | Meaning |
|---|---|
| `machine_controller` | Physical controller reported the fact directly. |
| `machine_adapter` | Adapter normalized controller or vendor data. |
| `machine_runtime` | Machine Runtime accepted or derived a state fact from policy. |
| `health_monitor` | Platform health monitor detected stale, offline or recovery state. |
| `operator` | Authorized service or support actor recorded the fact. |
| `system` | Platform scheduler or internal service emitted a machine-owned fact. |

Source rules:

- source identity is mandatory for security and audit;
- machine and adapter sources must be authenticated;
- operator sources require actor ID, role and reason;
- source metadata must not expose secrets, tokens or raw credentials;
- source trust level may affect whether the event updates readiness, opens an incident or only enters diagnostics.

Example source object:

```json
{
  "source_type": "machine_adapter",
  "source_id": "adapter_soft_ice_v1",
  "controller_alias": "vendor-controller-123",
  "firmware_version": "1.0.0",
  "trust_level": "authenticated"
}
```

## 3.8 Severity

Severity describes operational urgency.

Allowed severity values:

| Severity | Meaning | Typical handling |
|---|---|---|
| `info` | Normal lifecycle, readiness or execution progress. | Update projection and audit when needed. |
| `warning` | Condition may require attention or can degrade service. | Update projection, alert operations by policy. |
| `error` | Failure affects operation, readiness or component availability. | Block affected capability, open incident where needed. |
| `critical` | Safety, severe equipment failure or high-risk unknown outcome. | Block dispatch, escalate support or maintenance immediately. |

Severity rules:

- severity must be safe and machine-readable;
- repeated warnings may escalate by Machine Runtime policy;
- severity does not decide refunds, bonuses or customer compensation;
- safety and food-quality risks should use `error` or `critical` according to approved policy.

---

# 4. Machine Lifecycle Events

Lifecycle events describe connectivity, runtime availability and service readiness facts for one machine.

| Event type | Event API name | Meaning | Default severity | Required payload highlights |
|---|---|---|---|---|
| `MachineConnected` | `Machines.MachineConnected` | Authenticated machine or adapter connection became available. | `info` | `machine_id`, `connection_state`, `source`, `last_seen_at` |
| `MachineDisconnected` | `Machines.MachineDisconnected` | Machine or adapter connection was lost or exceeded stale window. | `warning` | `machine_id`, `connection_state`, `previous_connection_state`, `offline_reason` |
| `MachineStarted` | `Machines.MachineStarted` | Controller, adapter or machine runtime started or restarted. | `info` | `machine_id`, `start_reason`, `firmware_version`, `configuration_version` |
| `MachineReady` | `Machines.MachineReady` | Readiness check passed for current policy and configuration. | `info` | `machine_id`, `status`, `readiness`, `configuration_version` |
| `MachineBusy` | `Machines.MachineBusy` | Machine accepted work, locked an operation or cannot accept conflicting work. | `info` | `machine_id`, `status`, `machine_operation_id`, `queue_policy` |
| `MachineError` | `Machines.MachineError` | Machine reported or Machine Runtime accepted a fault. | `error` | `machine_id`, `error_code`, `component_id`, `recovery_hint` |
| `MachineMaintenanceRequired` | `Machines.MachineMaintenanceRequired` | Cleaning, refill, calibration, repair or inspection is required. | `warning` | `machine_id`, `maintenance_type`, `reason_code`, `affected_capability` |

Lifecycle event rules:

- `MachineConnected` does not mean ready;
- `MachineReady` does not mean payment or order acceptance;
- `MachineBusy` must include the operation or blocking reason when known;
- `MachineDisconnected` during an active operation must trigger reconciliation policy;
- `MachineError` can be produced by controller, adapter, Machine Runtime or authorized operator evidence;
- `MachineMaintenanceRequired` can be generated from telemetry thresholds, schedules, component faults or operator inspection.

Recommended lifecycle state effects:

| Event type | Digital Twin effect |
|---|---|
| `MachineConnected` | Connectivity becomes `connected`; runtime status may remain `online` until readiness is confirmed. |
| `MachineDisconnected` | Connectivity becomes `offline` or `stale`; dispatch eligibility becomes false. |
| `MachineStarted` | Runtime may enter `online` or `unknown` until status and readiness are refreshed. |
| `MachineReady` | Runtime projection may become `ready` if lifecycle and policy allow. |
| `MachineBusy` | Runtime projection becomes `busy`, `preparing` or equivalent operation-bound state. |
| `MachineError` | Runtime projection becomes `error`, `blocked` or degraded according to fault. |
| `MachineMaintenanceRequired` | Runtime projection marks affected capability or machine as needing service. |

---

# 5. Order Execution Events

Order execution events describe physical fulfillment facts for a paid order item.

Machine order event types are Machine facts. They do not replace Order Domain events.

| Event type | Event API name | Meaning | Default severity | Required payload highlights |
|---|---|---|---|---|
| `OrderReceived` | `Machines.OrderReceived` | Machine boundary received paid dispatch context or execution command. | `info` | `machine_id`, `dispatch_id`, `order_id`, `order_item_id`, `machine_operation_id` |
| `OrderAccepted` | `Machines.OrderAccepted` | Machine accepted the paid dispatch context for execution. | `info` | `machine_id`, `command_id`, `machine_operation_id`, `recipe_id` |
| `PreparationStarted` | `Machines.PreparationStarted` | Physical preparation started. | `info` | `machine_id`, `machine_operation_id`, `order_id`, `recipe_id`, `started_at` |
| `PreparationCompleted` | `Machines.PreparationCompleted` | Preparation finished successfully before or at product presentation. | `info` | `machine_id`, `machine_operation_id`, `duration_ms`, `ingredient_usage` |
| `PreparationFailed` | `Machines.PreparationFailed` | Preparation failed or could not produce the expected product. | `error` | `machine_id`, `machine_operation_id`, `failure_code`, `failure_stage` |
| `ProductDispensed` | `Machines.ProductDispensed` | Product was dispensed, presented or released to pickup area. | `info` | `machine_id`, `machine_operation_id`, `dispense_result`, `pickup_state` |

Order execution rules:

- order execution starts only after Payment Domain confirmation and Order Domain paid state acceptance;
- Machine Runtime must reject commands that lack accepted paid dispatch context;
- `OrderReceived` means the machine boundary received context, not that physical work started;
- `OrderAccepted` means the machine accepted execution responsibility or an operation lock, not that the customer order is complete;
- `PreparationStarted` is the first physical side-effect event in the normal flow;
- `PreparationCompleted` does not by itself prove product pickup;
- `PreparationFailed` must preserve enough information for reconciliation, maintenance and Order recovery;
- `ProductDispensed` must not be inferred by frontend timers;
- product pickup detection, if available, can be a future separate event such as `ProductTaken`.

Normal execution flow:

```text
Machines.OrderReceived
  -> Machines.OrderAccepted
  -> Machines.PreparationStarted
  -> Machines.PreparationCompleted
  -> Machines.ProductDispensed
```

Failure flow:

```text
Machines.OrderReceived
  -> Machines.OrderAccepted
  -> Machines.PreparationStarted
  -> Machines.PreparationFailed
  -> Order recovery, support or refund compensation policy
```

Ambiguous flow:

```text
Command sent
  -> connection lost or acknowledgement timeout
  -> operation outcome unknown
  -> status and telemetry reconciliation
  -> terminal success, terminal failure or support review
```

---

# 6. Hardware Events

Hardware events describe physical component, consumable, safety or maintenance facts.

| Event type | Event API name | Meaning | Default severity | Required payload highlights |
|---|---|---|---|---|
| `TemperatureWarning` | `Machines.TemperatureWarning` | Temperature crossed warning or safety threshold. | `warning` | `machine_id`, `component_id`, `temperature_c`, `threshold`, `duration_ms` |
| `IngredientLow` | `Machines.IngredientLow` | Ingredient level crossed low threshold. | `warning` | `machine_id`, `item_id`, `inventory_type`, `level`, `threshold_low` |
| `CupMagazineLow` | `Machines.CupMagazineLow` | Cup magazine level crossed low threshold. | `warning` | `machine_id`, `remaining_cups`, `threshold_low` |
| `ComponentFailure` | `Machines.ComponentFailure` | Component failed, jammed, stopped reporting or became unsafe. | `error` | `machine_id`, `component_id`, `component_type`, `failure_code` |
| `CleaningRequired` | `Machines.CleaningRequired` | Cleaning or sanitation is required by schedule, sensor or incident policy. | `warning` | `machine_id`, `cleaning_reason`, `deadline_at`, `affected_component` |

Hardware event rules:

- hardware events can block dispatch even if connectivity is available;
- hardware events should reference the affected component or item when known;
- threshold events must include measured value and threshold policy reference when available;
- raw sensor data remains telemetry until accepted as a machine fact;
- a hardware warning can become a lifecycle or maintenance event through Machine Runtime policy;
- a hardware fault on one capability should degrade only affected recipes when safe and supported;
- severe safety or food-quality events must block dispatch until resolved by approved policy.

Hardware event to projection examples:

| Event type | Possible projection effect |
|---|---|
| `TemperatureWarning` | Mark machine degraded, blocked or maintenance required depending on threshold. |
| `IngredientLow` | Mark affected ingredient as low and warn operations. |
| `CupMagazineLow` | Mark cups low; dispatch may continue until empty threshold. |
| `ComponentFailure` | Mark component failed; block affected operation or machine. |
| `CleaningRequired` | Mark maintenance required; block preparation when cleaning deadline is reached. |

---

# 7. Telemetry Model

Telemetry is machine-originated operational data used for readiness, diagnostics, maintenance, analytics and support.

Telemetry can be stored as `MachineTelemetryEvent` records in the logical platform model. Telemetry is not automatically a domain event. It becomes an event when Machine Runtime accepts it as a fact that should update projections, trigger alerts, open incidents or notify consumers.

Recommended telemetry record:

```json
{
  "telemetry_event_id": "machine_telemetry_01K0000000000000000000000",
  "schema_version": 1,
  "machine_id": "machine_01JZ0000000000000000000000",
  "telemetry_type": "runtime_snapshot",
  "measured_at": "2026-07-09T09:00:00Z",
  "received_at": "2026-07-09T09:00:02Z",
  "source": {
    "source_type": "machine_adapter",
    "source_id": "adapter_soft_ice_v1"
  },
  "payload": {}
}
```

Telemetry rules:

- telemetry includes `machine_id`, source, schema version and measurement timestamp;
- telemetry freshness must be explicit;
- raw vendor telemetry is adapter data until normalized;
- stale telemetry cannot mark a machine ready;
- telemetry that affects safety, order execution, inventory or maintenance must be auditable;
- telemetry retention may be shorter than order, payment and incident history unless tied to audit, support or safety evidence;
- telemetry must not contain payment credentials, provider secrets, raw card data, customer personal data, raw access tokens or UI state.

## 7.1 Temperature

Temperature telemetry describes current and historical readings for cold chain, product quality and component health.

Recommended fields:

| Field | Meaning |
|---|---|
| `component_id` | Sensor or temperature-controlled component. |
| `temperature_c` | Temperature in Celsius. |
| `target_min_c` | Lower allowed or target value where known. |
| `target_max_c` | Upper allowed or target value where known. |
| `warning_threshold_c` | Warning threshold where policy exists. |
| `critical_threshold_c` | Critical threshold where policy exists. |
| `duration_ms` | How long the reading stayed outside threshold. |
| `sensor_status` | `ok`, `missing_reading`, `fault` or equivalent. |

Temperature events:

- `TemperatureWarning` when warning threshold is crossed;
- `MachineError` or `ComponentFailure` when unsafe or sensor failure state is accepted;
- `MachineReady` only when temperature checks pass by policy.

## 7.2 Consumables Level

Consumables telemetry describes ingredients and materials available in the machine.

Consumable categories:

- ice cream mix;
- syrup;
- topping;
- cups;
- cleaning materials;
- service materials where supported.

Recommended fields:

| Field | Meaning |
|---|---|
| `item_id` | Stable item ID such as `syrup_strawberry` or `topping_oreo`. |
| `inventory_type` | `ingredient`, `consumable` or `service_material`. |
| `level_percent` | Estimated percentage remaining. |
| `quantity_estimate` | Estimated quantity remaining. |
| `unit` | `serving`, `piece`, `ml`, `g` or approved unit. |
| `threshold_low` | Low threshold. |
| `threshold_empty` | Empty or block threshold. |
| `source_method` | `sensor`, `operator`, `calculated_usage` or `adapter_estimate`. |

Consumables events:

- `IngredientLow` when an ingredient crosses low threshold;
- `CupMagazineLow` when cups cross low threshold;
- future `InventoryChanged` when normalized inventory fact is accepted;
- future maintenance events when refill is required.

## 7.3 Counters

Counters telemetry supports operations, maintenance, analytics and component wear tracking.

Recommended counters:

| Counter | Meaning |
|---|---|
| `orders_received_count` | Machine-bound order contexts received. |
| `orders_accepted_count` | Orders accepted for execution. |
| `preparations_started_count` | Physical preparations started. |
| `preparations_completed_count` | Successful preparations. |
| `preparations_failed_count` | Failed preparations. |
| `products_dispensed_count` | Products presented or dispensed. |
| `cup_dispense_count` | Cup dispense cycles. |
| `syrup_pump_cycles` | Syrup pump cycles by channel. |
| `topping_dispenser_cycles` | Topping dispenser cycles by channel. |
| `cleaning_cycle_count` | Completed or attempted cleaning cycles. |
| `component_error_count` | Component errors by type. |

Counter rules:

- counters can be lifetime, daily, maintenance-period or operation-scoped;
- counter resets require source and reason;
- counters are supporting evidence, not proof of one specific order outcome unless correlated with operation ID;
- counter deltas that affect inventory should create inventory adjustment or usage records by policy.

## 7.4 Runtime

Runtime telemetry describes machine mode, software and operation state.

Recommended fields:

| Field | Meaning |
|---|---|
| `runtime_status` | Current runtime status such as `ready`, `busy`, `error` or `maintenance`. |
| `lifecycle_state` | Business lifecycle state where reported by platform projection. |
| `active_machine_operation_id` | Current active operation when known. |
| `uptime_seconds` | Controller or adapter uptime. |
| `firmware_version` | Firmware version. |
| `configuration_version` | Active machine configuration version. |
| `capability_profile_id` | Active capability profile. |
| `maintenance_mode` | Maintenance state where active. |

Runtime events:

- `MachineStarted`;
- `MachineReady`;
- `MachineBusy`;
- `MachineError`;
- `MachineMaintenanceRequired`.

## 7.5 Connectivity

Connectivity telemetry describes the reachability and freshness of the machine or adapter.

Recommended fields:

| Field | Meaning |
|---|---|
| `connection_state` | `connected`, `stale`, `offline` or `unknown`. |
| `last_seen_at` | Last trusted heartbeat or event time. |
| `heartbeat_interval_ms` | Expected heartbeat interval where configured. |
| `adapter_latency_ms` | Adapter round-trip or processing latency. |
| `signal_quality` | Normalized signal quality where available. |
| `network_type` | `ethernet`, `wi_fi`, `cellular` or `unknown`. |
| `offline_duration_ms` | Duration since last trusted contact where known. |

Connectivity events:

- `MachineConnected`;
- `MachineDisconnected`;
- delayed delivery or offline-buffer replay metadata on reconnection.

## 7.6 Hardware Health

Hardware health telemetry describes component state and diagnostic indicators.

Recommended fields:

| Field | Meaning |
|---|---|
| `component_id` | Component identifier. |
| `component_type` | `freezer_unit`, `cup_dispenser`, `syrup_pump`, `topping_dispenser`, `nozzle`, `pickup_hatch` or approved type. |
| `health_state` | `ok`, `warning`, `failed`, `blocked`, `unknown` or `maintenance_required`. |
| `error_code` | Safe machine-readable error code. |
| `vendor_error_ref` | Protected adapter reference when raw vendor detail exists. |
| `last_service_at` | Last service timestamp where known. |
| `diagnostic_summary` | Safe short summary for operators. |

Hardware health events:

- `ComponentFailure`;
- `CleaningRequired`;
- `MachineMaintenanceRequired`;
- `MachineError`.

---

# 8. Event Examples

Examples use the Event API envelope and Machine-owned payloads. They are illustrative contracts, not final JSON Schema.

## 8.1 Machine Ready

```json
{
  "event_id": "evt_01K0000000000000000000001",
  "event_name": "Machines.MachineReady",
  "event_version": 1,
  "event_category": "domain",
  "source_runtime_id": "runtime_machine",
  "source_domain": "machines",
  "occurred_at": "2026-07-09T09:00:00Z",
  "published_at": "2026-07-09T09:00:01Z",
  "aggregate_type": "machine",
  "aggregate_id": "machine_01JZ0000000000000000000000",
  "aggregate_sequence": 42,
  "correlation_id": "machine_health_01K0000000000000000000000",
  "causation_id": "telemetry_01K0000000000000000000000",
  "payload": {
    "event_type": "MachineReady",
    "machine_id": "machine_01JZ0000000000000000000000",
    "status": "ready",
    "previous_status": "online",
    "severity": "info",
    "source": {
      "source_type": "machine_adapter",
      "source_id": "adapter_soft_ice_v1",
      "controller_alias": "vendor-controller-123",
      "firmware_version": "1.0.0",
      "trust_level": "authenticated"
    },
    "readiness": {
      "temperature_ok": true,
      "inventory_ok": true,
      "safety_ok": true,
      "maintenance_required": false
    },
    "configuration_version": 1,
    "capability_profile_id": "machine_profile_soft_ice_v1"
  },
  "metadata": {
    "schema_ref": "event://machines/Machines.MachineReady/v1",
    "producer": "Machine Runtime",
    "sensitivity": "internal"
  }
}
```

## 8.2 Order Accepted By Machine

```json
{
  "event_id": "evt_01K0000000000000000000002",
  "event_name": "Machines.OrderAccepted",
  "event_version": 1,
  "event_category": "domain",
  "source_runtime_id": "runtime_machine",
  "source_domain": "machines",
  "occurred_at": "2026-07-09T09:03:00Z",
  "published_at": "2026-07-09T09:03:01Z",
  "aggregate_type": "machine_operation",
  "aggregate_id": "machine_operation_01K0000000000000000000000",
  "aggregate_sequence": 7,
  "correlation_id": "order_01K0000000000000000000000",
  "causation_id": "machine_command_01K0000000000000000000000",
  "idempotency_key": "machine_operation_01K0000000000000000000000_prepare_v1",
  "payload": {
    "event_type": "OrderAccepted",
    "machine_id": "machine_01JZ0000000000000000000000",
    "machine_operation_id": "machine_operation_01K0000000000000000000000",
    "command_id": "machine_command_01K0000000000000000000000",
    "dispatch_id": "dispatch_01K0000000000000000000000",
    "order_id": "order_01K0000000000000000000000",
    "order_item_id": "order_item_01K0000000000000000000000",
    "recipe_id": "recipe_soft_ice_vanilla_strawberry_oreo",
    "severity": "info",
    "source": {
      "source_type": "machine_adapter",
      "source_id": "adapter_soft_ice_v1",
      "trust_level": "authenticated"
    },
    "accepted_configuration_version": 1,
    "operation_state": "command_accepted"
  },
  "metadata": {
    "schema_ref": "event://machines/Machines.OrderAccepted/v1",
    "producer": "Machine Runtime",
    "sensitivity": "internal"
  }
}
```

## 8.3 Temperature Warning

```json
{
  "event_id": "evt_01K0000000000000000000003",
  "event_name": "Machines.TemperatureWarning",
  "event_version": 1,
  "event_category": "operational",
  "source_runtime_id": "runtime_machine",
  "source_domain": "machines",
  "occurred_at": "2026-07-09T09:05:00Z",
  "published_at": "2026-07-09T09:05:02Z",
  "aggregate_type": "machine",
  "aggregate_id": "machine_01JZ0000000000000000000000",
  "aggregate_sequence": 43,
  "correlation_id": "machine_health_01K0000000000000000000000",
  "causation_id": "machine_telemetry_01K0000000000000000000001",
  "payload": {
    "event_type": "TemperatureWarning",
    "machine_id": "machine_01JZ0000000000000000000000",
    "component_id": "freezer_unit_main",
    "component_type": "freezer_unit",
    "severity": "warning",
    "source": {
      "source_type": "machine_adapter",
      "source_id": "adapter_soft_ice_v1",
      "trust_level": "authenticated"
    },
    "measurement": {
      "temperature_c": -2.0,
      "target_min_c": -8.0,
      "target_max_c": -4.0,
      "warning_threshold_c": -3.0,
      "duration_ms": 120000
    },
    "reason_code": "TEMPERATURE_ABOVE_WARNING_THRESHOLD",
    "recovery_hint": "wait_for_cooling_or_request_service"
  },
  "metadata": {
    "schema_ref": "event://machines/Machines.TemperatureWarning/v1",
    "producer": "Machine Runtime",
    "sensitivity": "internal"
  }
}
```

## 8.4 Product Dispensed

```json
{
  "event_id": "evt_01K0000000000000000000004",
  "event_name": "Machines.ProductDispensed",
  "event_version": 1,
  "event_category": "domain",
  "source_runtime_id": "runtime_machine",
  "source_domain": "machines",
  "occurred_at": "2026-07-09T09:04:30Z",
  "published_at": "2026-07-09T09:04:31Z",
  "aggregate_type": "machine_operation",
  "aggregate_id": "machine_operation_01K0000000000000000000000",
  "aggregate_sequence": 10,
  "correlation_id": "order_01K0000000000000000000000",
  "causation_id": "evt_01K0000000000000000000002",
  "payload": {
    "event_type": "ProductDispensed",
    "machine_id": "machine_01JZ0000000000000000000000",
    "machine_operation_id": "machine_operation_01K0000000000000000000000",
    "command_id": "machine_command_01K0000000000000000000000",
    "dispatch_id": "dispatch_01K0000000000000000000000",
    "order_id": "order_01K0000000000000000000000",
    "order_item_id": "order_item_01K0000000000000000000000",
    "recipe_id": "recipe_soft_ice_vanilla_strawberry_oreo",
    "severity": "info",
    "source": {
      "source_type": "machine_controller",
      "source_id": "controller_vendor_123",
      "trust_level": "authenticated"
    },
    "dispense_result": "presented_to_pickup_area",
    "pickup_state": "awaiting_pickup",
    "ingredient_usage": [
      {
        "item_id": "flavor_vanilla",
        "unit": "serving",
        "quantity": 1
      },
      {
        "item_id": "syrup_strawberry",
        "unit": "serving",
        "quantity": 1
      },
      {
        "item_id": "topping_oreo",
        "unit": "serving",
        "quantity": 1
      }
    ]
  },
  "metadata": {
    "schema_ref": "event://machines/Machines.ProductDispensed/v1",
    "producer": "Machine Runtime",
    "sensitivity": "internal"
  }
}
```

## 8.5 Telemetry Reported

```json
{
  "event_id": "evt_01K0000000000000000000005",
  "event_name": "Machines.TelemetryReported",
  "event_version": 1,
  "event_category": "operational",
  "source_runtime_id": "runtime_machine",
  "source_domain": "machines",
  "occurred_at": "2026-07-09T09:10:00Z",
  "published_at": "2026-07-09T09:10:02Z",
  "aggregate_type": "machine",
  "aggregate_id": "machine_01JZ0000000000000000000000",
  "aggregate_sequence": 44,
  "correlation_id": "machine_health_01K0000000000000000000000",
  "causation_id": "heartbeat_01K0000000000000000000000",
  "payload": {
    "event_type": "TelemetryReported",
    "machine_id": "machine_01JZ0000000000000000000000",
    "telemetry_event_id": "machine_telemetry_01K0000000000000000000002",
    "telemetry_type": "runtime_snapshot",
    "severity": "info",
    "source": {
      "source_type": "machine_adapter",
      "source_id": "adapter_soft_ice_v1",
      "trust_level": "authenticated"
    },
    "temperature": {
      "freezer_unit_main": {
        "temperature_c": -6.0,
        "sensor_status": "ok"
      }
    },
    "consumables": {
      "cups": {
        "quantity_estimate": 124,
        "unit": "piece",
        "threshold_low": 20
      },
      "syrup_strawberry": {
        "level_percent": 62,
        "unit": "serving",
        "threshold_low": 10
      }
    },
    "counters": {
      "preparations_completed_count": 36,
      "preparations_failed_count": 1,
      "cleaning_cycle_count": 2
    },
    "runtime": {
      "runtime_status": "ready",
      "uptime_seconds": 86400,
      "firmware_version": "1.0.0",
      "configuration_version": 1
    },
    "connectivity": {
      "connection_state": "connected",
      "last_seen_at": "2026-07-09T09:10:00Z",
      "adapter_latency_ms": 180,
      "network_type": "unknown"
    }
  },
  "metadata": {
    "schema_ref": "event://machines/Machines.TelemetryReported/v1",
    "producer": "Machine Runtime",
    "sensitivity": "internal"
  }
}
```

---

# 9. Event Reliability

Machine events use at-least-once delivery with idempotent producers and consumers.

Reliability goals:

- avoid lost machine facts where possible;
- avoid duplicate business effects;
- preserve physical operation audit trail;
- protect against unsafe retries;
- keep delayed and offline-buffered facts distinguishable from live facts.

## 9.1 Duplicate Events

Duplicate event scenarios:

- producer publish retry after timeout;
- adapter reconnect and replay of buffered events;
- Event Runtime retry to a consumer;
- consumer crash after side effect but before acknowledgement.

Duplicate handling rules:

- same accepted fact uses the same `event_id`;
- consumers deduplicate by `event_id` at minimum;
- command-related consumers also use `machine_operation_id`, `command_id` and idempotency key;
- duplicate event delivery must not repeat Order transitions, customer messages, refunds, inventory deductions or machine commands;
- conflicting duplicates with same idempotency key and different payload are rejected and audited.

## 9.2 Delayed Events

Delayed event scenarios:

- weak network;
- offline buffering;
- adapter retry;
- Event Runtime delivery retry;
- clock drift or source timestamp correction.

Delayed handling rules:

- preserve original `occurred_at`;
- record `received_at` and `published_at`;
- use `aggregate_sequence` or `source_sequence` where available;
- Machine Digital Twin must reconcile delayed facts against current state;
- delayed readiness events must not override newer error, maintenance, offline or blocked facts without policy;
- delayed order execution events during ambiguous outcomes require reconciliation before automatic completion.

## 9.3 Offline Buffering

Offline buffering is a machine or adapter capability, not an automatic production guarantee.

Buffering rules:

- buffered events keep original `event_id`, `occurred_at`, source identity and sequence;
- buffered events are marked with replay or offline-buffer metadata on delivery;
- buffer storage must be protected from tampering and unauthorized reads;
- reconnect must send status and telemetry needed to reconcile current state;
- active or ambiguous operations are reconciled before new customer dispatch;
- offline queueing for future physical execution is not approved for MVP production unless separately approved.

Recommended offline replay metadata:

| Field | Meaning |
|---|---|
| `buffered` | Whether event was stored during offline period. |
| `buffered_at` | When source stored it. |
| `replayed_at` | When source replayed it. |
| `source_sequence` | Source ordering value. |
| `buffer_id` | Protected source buffer reference. |

## 9.4 Retry Strategy

Event retry is delivery behavior. It must not create new machine facts by itself.

Retry rules:

- publication retry reuses original `event_id`;
- delivery retry preserves original envelope and payload;
- retry attempts are bounded;
- transient errors may use exponential backoff or configured delay schedules;
- permanent schema, authorization or trust errors move to dead-letter handling;
- retry telemetry must be visible to operations;
- replay or redrive requires authorization and audit;
- replay suppresses unsafe side effects, especially payment actions, refunds, machine commands and customer notifications.

Physical command retry rule:

```text
If a command may have reached the machine, retry status and reconciliation before retrying the physical command.
```

---

# 10. Integration Boundaries

Machine event integration preserves the ownership boundaries from Machine Domain, State Model, Platform Data Model and Event API.

## 10.1 Machine Reports Facts

Machine, controller and adapter report:

- connectivity facts;
- controller start and restart facts;
- readiness facts;
- busy and operation-lock facts;
- command receipt, acceptance and rejection facts;
- preparation start, completion and failure facts;
- product dispense or presentation facts;
- telemetry readings;
- component failures;
- inventory and consumable threshold facts;
- cleaning and maintenance requirement facts;
- error and diagnostic facts.

Machine must not decide:

- whether a payment is completed;
- whether an order is paid;
- whether a refund is owed;
- whether bonuses are granted or redeemed;
- what a product costs;
- what product media is shown;
- what customer compensation is appropriate;
- whether customer notification content should be sent.

## 10.2 Platform Makes Business Decisions

Platform domains decide through their owning Runtime contracts:

- Payment Domain confirms payment and owns refunds;
- Order Domain owns order lifecycle and compensation flow;
- Product Domain owns catalog, recipe, pricing source rules and media;
- Machine Runtime owns machine state, command acceptance, telemetry normalization and operation facts;
- CRM and Maintenance consume projections and issue approved service commands;
- Notification Runtime owns notification requests, templates and delivery policy;
- Analytics consumes minimized events and projections without mutating source state.

Boundary examples:

| Machine fact | Platform decision owner |
|---|---|
| `Machines.MachineReady` | Machine Runtime can mark machine eligible only if lifecycle and policy allow. |
| `Machines.OrderAccepted` | Order Domain may update fulfillment progress through approved transition. |
| `Machines.PreparationFailed` | Order and Payment decide support, retry or refund compensation. |
| `Machines.IngredientLow` | Machine/Maintenance decide refill workflow; Product Domain decides any customer-facing availability policy. |
| `Machines.ProductDispensed` | Order Domain decides whether order can progress, considering pickup and policy. |

Integration rule:

```text
Machine facts inform decisions.
They do not bypass the Runtime that owns the decision.
```

---

# 11. Security Requirements

Machine events and telemetry are sensitive because they can affect physical execution, customer orders, maintenance response and operational safety.

Authentication requirements:

- machine and adapter sources must authenticate before publishing events or telemetry;
- source identity must distinguish physical controller, adapter, Machine Runtime, health monitor, operator and system sources;
- unauthenticated machine-originated facts are rejected or quarantined;
- operator-originated facts require authenticated actor, role and reason.

Authorization requirements:

- producers are authorized per event name and machine scope;
- consumers are authorized per event category, sensitivity and business need;
- service operators can only publish or correct events through approved workflows;
- replay, redrive and dead-letter recovery require privileged authorization and audit.

Replay protection:

- events include `event_id`;
- source sequence, timestamp and signature should be used where supported;
- duplicate detection protects against repeated buffered delivery;
- conflicting duplicate payloads are rejected and audited;
- stale events cannot silently override newer safe state.

Data minimization:

- event payloads must not contain raw card data, CVV, provider secrets, bot tokens, API keys, raw access tokens, payment provider authorization headers, customer personal data or bonus balances;
- use platform IDs such as `order_id`, `payment_id`, `machine_operation_id`, `recipe_id` and `correlation_id` where needed;
- raw vendor protocol payloads stay inside protected adapter diagnostics unless explicitly approved;
- diagnostic summaries must be safe for operations and support.

Transport and storage requirements:

- transport should use encrypted channels in production;
- buffered offline events should be protected from tampering;
- event storage and telemetry storage require access control;
- audit-sensitive machine facts must be protected from deletion or silent mutation;
- logs must mask secrets and avoid raw firmware credentials.

Clock and freshness requirements:

- source clock drift must be detected where possible;
- received and published timestamps are recorded by platform;
- freshness policy determines when telemetry becomes stale;
- stale data cannot prove readiness.

---

# 12. Future Extension

Future work should build on this document without changing the core boundaries.

Recommended future tasks:

1. Add Machine event names to the formal Event Registry.
2. Define JSON Schema for each Machine event payload.
3. Define telemetry schema versions for temperature, consumables, counters, runtime, connectivity and hardware health.
4. Define heartbeat interval, stale telemetry window and offline status policy.
5. Define adapter authentication, event signing and replay protection.
6. Define machine source sequence and ordering metadata.
7. Define offline buffer size, retention, encryption and redrive behavior.
8. Define dead-letter review workflow for machine events.
9. Define alert routing for warning, error and critical severity.
10. Define exact incident creation rules for hardware and preparation failures.
11. Define retention policy for raw telemetry, normalized telemetry, incidents and order-linked machine facts.
12. Define Machine Digital Twin projection fields and freshness indicators.
13. Define simulator or test adapter for event and telemetry contract testing.
14. Define hardware-specific sensor mapping after manufacturer verification.
15. Define product pickup, product not taken and abandoned product policy.
16. Define alternate-machine fulfillment policy after payment.
17. Define predictive maintenance and anomaly detection over minimized telemetry.
18. Define AsyncAPI or equivalent publication format for approved machine events.
19. Add contract tests for envelope validation, duplicate handling and replay suppression.
20. Review production machine event security before real equipment integration.

Readiness criteria for this documentation increment:

- event-driven communication between Machine Digital Twin and Platform is documented;
- machine event model is documented;
- lifecycle events are documented;
- order execution events are documented;
- hardware events are documented;
- telemetry model is documented;
- JSON event examples are provided;
- duplicate, delayed, offline and retry behavior is documented;
- Machine reports facts and Platform makes business decisions;
- security requirements are documented;
- future extension path is documented;
- tracking files are updated;
- no application source code is modified.

---

## Documentation Scope

This document is documentation-only.

It does not introduce application code, frontend code, backend code, Telegram bot code, runtime configuration, database migrations, generated build output, payment provider integration, real machine firmware commands, real machine credentials, CRM screens, notification templates, final event schemas, final telemetry schemas or final hardware safety certification.
