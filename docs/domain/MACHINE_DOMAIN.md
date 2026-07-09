# Machine Domain

Document code: DOMAIN-MACHINE-001
Task: EPIC-370 / MACHINE-001
Version: 0.1
Status: Draft
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-08
Last updated: 2026-07-08
Scope: Documentation only

Related documents:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `docs/architecture/PROJECT_DECISIONS.md`
- `docs/architecture/GLOSSARY.md`
- `docs/architecture/ARCHITECTURE_STATUS.md`
- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/api/REST_API.md`
- `docs/api/EVENT_API.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/tasks/ORDER-008_MACHINE_DISPATCH.md`
- `docs/tasks/TASK_INDEX.md`

Required decision:

- `DECISION-039` - Machine Domain Owns Equipment Execution Boundary.

---

# 1. Machine Domain Purpose

Machine Domain describes how Soft ICE Platform represents, operates, observes and maintains vending machines.

The domain exists so the platform can:

- register machines as business entities with stable platform IDs;
- track machine lifecycle, location, configuration, capabilities and components;
- select only eligible machines for paid order fulfillment;
- execute platform commands through machine adapters;
- receive machine-originated events, telemetry and execution results;
- track ingredient and consumable inventory independently from payment state;
- detect equipment faults, blocked preparation, failed dispensing and ambiguous physical outcomes;
- support maintenance, service operator actions and recovery workflows;
- provide auditable machine facts to Order, CRM, Notification, Analytics and support.

Core rule:

```text
Machine Domain executes paid fulfillment work.
Machine does not decide payment.
Machine does not decide bonuses.
Machine reports statuses and execution results.
Platform sends commands; machine returns events.
```

Machine Domain is documentation-only in this increment and introduces no application code.

---

# 2. Machine as Business Entity

`Machine` is the aggregate root for one physical vending machine or one platform-addressable controller that represents a vending unit.

Minimal entity model:

```json
{
  "machine_id": "machine_01JZ0000000000000000000000",
  "machine_code": "machine_001",
  "status": "ready",
  "lifecycle_state": "active",
  "location_id": "location_01JZ0000000000000000000000",
  "machine_group_id": "machine_group_01JZ0000000000000000000000",
  "controller_alias": "vendor-controller-123",
  "adapter_id": "adapter_soft_ice_v1",
  "firmware_version": "1.0.0",
  "configuration_version": 1,
  "capability_profile_id": "machine_profile_soft_ice_v1",
  "last_seen_at": "2026-07-08T00:00:00Z",
  "created_at": "2026-07-08T00:00:00Z",
  "updated_at": "2026-07-08T00:00:00Z"
}
```

Machine Domain owns:

- machine identity and lifecycle state;
- machine status and readiness model;
- machine assignment to location and group;
- machine configuration and capability profile;
- machine component state;
- dispatch queue execution and machine operation records;
- machine command acknowledgement and execution results;
- machine inventory and inventory adjustment facts;
- telemetry, health reports and equipment errors;
- maintenance windows, service incidents and operator actions;
- machine audit trail.

Machine Domain does not own:

- customer profile or consent;
- product catalog, product names, product prices or media;
- price, discount, bonus or Club Account logic;
- payment provider integration, payment confirmation or refund execution;
- Ledger, Wallet or financial registry records;
- Order lifecycle decisions outside accepted machine facts;
- notification templates or customer messaging;
- CRM screens or operator UI layout;
- raw firmware implementation.

Boundary rule:

```text
Machine Domain owns physical execution facts.
Order Domain owns purchase lifecycle.
Payment Domain owns settlement confirmation.
Product Domain owns catalog, configuration and recipe source models.
```

---

# 3. Machine Lifecycle

Machine lifecycle describes the business and operational life of a vending machine in the platform.

Lifecycle flow:

```text
planned
->
registered
->
installation_pending
->
commissioning
->
active
|-> paused -> active
|-> maintenance -> active
|-> out_of_service -> maintenance -> active
|-> retired
```

Lifecycle states:

| State | Meaning | Allowed direction |
|---|---|---|
| `planned` | Machine is expected but not yet registered. | Register machine. |
| `registered` | Machine identity exists in the platform. | Assign location and configuration. |
| `installation_pending` | Machine is assigned but not ready for production use. | Commission or cancel installation. |
| `commissioning` | Machine is being tested, calibrated and connected. | Activate, pause or mark out of service. |
| `active` | Machine can be eligible for paid order dispatch when operational status is ready. | Normal operation, pause or maintenance. |
| `paused` | Machine is temporarily unavailable by policy or operator action. | Resume, maintenance or out of service. |
| `maintenance` | Machine is reserved for cleaning, refill, repair, calibration or inspection. | Return to active, pause or out of service. |
| `out_of_service` | Machine is not safe or not allowed for customer fulfillment. | Maintenance or retired. |
| `retired` | Machine is removed from active platform use. | Read and audit only. |

Lifecycle rules:

- lifecycle state is not the same as live hardware status;
- an `active` machine can still be temporarily `offline`, `busy`, `blocked` or `error`;
- activation requires approved configuration, location, capability profile and safety readiness;
- retirement preserves historical order, operation, inventory, telemetry summary and audit references;
- lifecycle changes require actor, reason, timestamp and audit record.

---

# 4. Machine Statuses

Machine status represents the current operational condition of a machine.

Recommended status families:

| Status | Meaning | Dispatch eligibility |
|---|---|---|
| `unknown` | Platform has no reliable current state. | Not eligible. |
| `offline` | Machine or adapter is not reachable. | Not eligible. |
| `online` | Machine is reachable but not necessarily ready. | Eligibility requires readiness checks. |
| `ready` | Machine is online, safe, stocked and can accept a compatible operation. | Eligible. |
| `busy` | Machine is processing another operation or queue policy blocks new work. | Eligible only for queued work where policy allows. |
| `preparing` | Machine is preparing product for an accepted operation. | Not eligible for another conflicting operation. |
| `dispensing` | Machine is dispensing or presenting product. | Not eligible for conflicting operation. |
| `product_ready` | Product is ready for pickup or already presented. | Not eligible for conflicting operation. |
| `cleaning` | Machine is cleaning or sanitation cycle is running. | Not eligible. |
| `maintenance` | Service work is active. | Not eligible. |
| `degraded` | Machine works with reduced capability. | Eligible only for supported recipes. |
| `blocked` | Safety, door, temperature or inventory condition blocks operation. | Not eligible. |
| `error` | Machine reported a fault requiring recovery. | Not eligible until resolved. |
| `out_of_service` | Machine is intentionally removed from fulfillment. | Not eligible. |

Status rules:

- status is reported by machine, adapter, operator action or health monitor;
- status must include `machine_id`, source, timestamp and correlation where available;
- status changes are facts and should produce `Machines.StatusChanged`;
- stale status must degrade to `unknown` or `offline` according to health policy;
- UI and Order projections must not infer machine progress from timers alone;
- a machine must not start preparation when status is not compatible with the command.

---

# 5. Machine Location

Machine location describes where the machine is physically installed and where the customer can receive the product.

Location model:

```json
{
  "location_id": "location_01JZ0000000000000000000000",
  "display_name": "Utimoshi test location",
  "status": "active",
  "address": "approved address reference",
  "geo": {
    "latitude": null,
    "longitude": null
  },
  "timezone": "Asia/Tomsk",
  "pickup_zone": "front",
  "site_owner_reference": null,
  "service_notes": "internal notes"
}
```

Location rules:

- machine has one current `location_id`;
- location assignment affects customer pickup context and machine selection;
- location changes after paid order dispatch require reconciliation and support policy;
- location data must not be inferred from customer device location as source of truth;
- partner/site owner details belong to approved location or partner records, not command payloads;
- service notes are internal and must not leak to customer-facing UI unless explicitly approved.

Machine groups:

- support routing, reporting, maintenance and fallback selection;
- can represent a site, region, operator route or fleet segment;
- must not override per-machine safety or readiness checks.

---

# 6. Machine Configuration

Machine configuration describes how a machine is allowed to operate in the platform.

Configuration areas:

| Area | Examples |
|---|---|
| Controller | Adapter ID, controller alias, firmware version, communication protocol. |
| Product profile | Supported recipe profile, product categories, cup sizes, output limits. |
| Ingredient mapping | Slot to ingredient mapping, syrup pump mapping, topping dispenser mapping. |
| Calibration | Doses, pump timing, temperature targets, portion tolerances. |
| Queue policy | Queue depth, concurrency, operation timeout, retry policy references. |
| Safety policy | Door, temperature, cleaning, emergency stop and sensor requirements. |
| Telemetry policy | Required health reports, sample frequency and stale status window. |
| Maintenance policy | Cleaning interval, refill thresholds, inspection intervals. |

Configuration rules:

- configuration is versioned;
- configuration changes require authorization, reason and audit;
- active paid operations use the configuration version accepted at command creation;
- configuration must not contain payment credentials, provider secrets or customer personal data;
- recipe mapping must reference Product Domain recipe IDs or machine profile IDs;
- firmware-specific settings stay behind adapter contracts where possible;
- a configuration change cannot silently change historical operation meaning.

---

# 7. Machine Capabilities

Machine capabilities describe what a machine can actually prepare and report.

Capability examples:

- soft ice cream preparation;
- supported cup/container types;
- supported base flavors;
- syrup pump count and supported syrup IDs;
- topping dispenser count and supported topping IDs;
- compatible `recipe_id` or recipe profile IDs;
- temperature control and reporting;
- cup dispensing sensor;
- product presence sensor;
- pickup door or hatch sensor;
- inventory level reporting;
- cleaning cycle support;
- safe stop support;
- remote status read support;
- command idempotency support;
- offline queue support, if approved;
- firmware update support.

Capability rules:

- a machine can accept a command only when its capabilities match the accepted recipe;
- degraded capability can disable only affected recipes instead of the whole machine when safe;
- capability changes are versioned and auditable;
- capability reporting from hardware must be normalized into platform capability fields;
- Product Domain does not inspect raw hardware capability payloads;
- Machine Domain does not change product catalog availability globally without Product Domain policy.

---

# 8. Machine Components

Machine components are physical or logical parts whose state can affect preparation.

Recommended component catalog:

| Component | Purpose | Example states |
|---|---|---|
| `controller` | Main machine control unit. | online, offline, rebooting, error. |
| `network_module` | Connectivity to platform or adapter. | connected, weak_signal, disconnected. |
| `freezer_unit` | Maintains ice cream temperature and texture. | cooling, ready, temperature_high, fault. |
| `mix_hopper` | Holds base mix. | ok, low, empty, sensor_fault. |
| `cup_dispenser` | Supplies cups. | ok, low, empty, jammed. |
| `syrup_pump` | Dispenses syrup. | ok, low, blocked, calibration_required. |
| `topping_dispenser` | Dispenses topping. | ok, low, blocked, empty. |
| `nozzle` | Product output path. | clean, cleaning_required, blocked. |
| `pickup_hatch` | Customer pickup area. | closed, open, blocked, sensor_fault. |
| `temperature_sensor` | Reports temperature. | ok, out_of_range, fault. |
| `weight_or_presence_sensor` | Confirms product or inventory state. | ok, missing_reading, fault. |
| `cleaning_system` | Runs cleaning/sanitation cycle. | idle, running, required, failed. |

Component rules:

- component state can block dispatch even when machine status is online;
- component state changes should be correlated with telemetry and maintenance records;
- component replacement or calibration is a service operator action;
- component faults must not be hidden behind generic `error` when a safe reason is known;
- component data must support maintenance and analytics without exposing raw firmware internals.

---

# 9. Product Dispensing Rules

Product dispensing is the physical preparation and presentation of a paid product.

Entry conditions:

```text
Order accepted paid state
Machine dispatch request accepted
Machine selected and ready
Machine supports accepted recipe
Inventory and consumables are sufficient
Safety checks pass
Idempotent machine command accepted
```

Successful execution flow:

```text
command_received
->
command_accepted
->
operation_locked
->
preparation_started
->
base_dispensed
->
syrup_dispensed
->
topping_dispensed
->
product_ready
->
product_taken
->
operation_completed
```

Dispensing rules:

- machine must never prepare product before payment is confirmed by Payment Domain and accepted by Order Domain;
- machine receives only paid orders through approved Machine commands;
- machine command references immutable Order snapshots and accepted `recipe_id`;
- machine command does not contain payment credentials, provider payloads, bonus balances or UI state;
- command execution must be idempotent by `machine_operation_id` and command idempotency key;
- duplicate accepted command returns the original operation result or current state;
- unsupported recipe, missing inventory, unsafe temperature or blocked component rejects the command before preparation;
- preparation failure must be reported as a machine event;
- partial preparation or ambiguous dispensing requires reconciliation before completion, retry or refund;
- dispensing result must be reported by machine or adapter, not inferred by frontend timers.

Product preparation failure rule:

```text
Any physical failure that prevents correct preparation or delivery must produce a Machine event such as Machines.PreparationFailed or Machines.ErrorReported.
```

---

# 10. Payment-to-Dispatch Rule

Payment-to-dispatch is the required boundary between financial settlement and physical preparation.

Approved flow:

```text
Payment Domain confirms payment
->
Order Domain accepts PaymentConfirmed and enters Paid
->
Order requests fulfillment
->
Machine Domain accepts paid dispatch request
->
Machine command is sent
->
Machine reports execution events
```

Mandatory rules:

1. Machine does not start preparation before payment is confirmed.
2. Machine receives only paid orders.
3. Payment Domain owns payment confirmation.
4. Order Domain owns the paid order lifecycle and fulfillment state.
5. Machine Domain owns queue, command delivery, execution facts and equipment outcome.
6. Machine Domain is not responsible for payment logic.
7. Machine Domain is not responsible for bonus logic.
8. Machine inventory is tracked separately from payments.
9. Ambiguous payment outcome blocks dispatch.
10. Ambiguous machine outcome blocks automatic completion.

Machine command payload may include safe references such as `order_id`, `order_item_id`, `payment_id`, `recipe_id`, `dispatch_id` and `machine_operation_id` when needed for audit and correlation. It must not include raw payment provider data, card data, secret keys, bonus calculations or customer personal data beyond approved correlation fields.

If Machine Domain receives a command that is not backed by an accepted paid dispatch request, it must reject the command, publish or record a rejected-command fact and create an audit record.

---

# 11. Machine Inventory Overview

Machine inventory tracks ingredients, consumables and service materials inside or assigned to the machine.

Inventory categories:

| Category | Examples |
|---|---|
| Ingredients | soft ice cream mix, syrup, topping. |
| Consumables | cups, spoons, lids, napkins where supported. |
| Service materials | cleaning solution, filters, maintenance parts. |
| Capacity counters | remaining servings, estimated doses, hopper level. |
| Waste and cleanup | waste container level, cleaning cycle count. |

Inventory model example:

```json
{
  "machine_inventory_id": "machine_inventory_01JZ0000000000000000000000",
  "machine_id": "machine_01JZ0000000000000000000000",
  "item_id": "syrup_strawberry",
  "inventory_type": "ingredient",
  "status": "available",
  "quantity_estimate": 45,
  "unit": "serving",
  "threshold_low": 10,
  "threshold_empty": 0,
  "source": "machine_sensor",
  "updated_at": "2026-07-08T00:00:00Z"
}
```

Inventory rules:

- inventory is not payment state and must not be stored inside Payment records;
- inventory changes are owned by Machine Domain;
- successful dispensing decreases inventory through measured or estimated usage;
- failed or partial dispensing may require waste and manual adjustment records;
- low inventory can make a recipe unavailable on one machine without changing global Product catalog;
- manual inventory corrections require operator, reason, timestamp and audit;
- inventory must support reconciliation between sensor reports, operator refills and operation usage;
- inventory events must not contain payment credentials or customer personal data.

---

# 12. Telemetry Overview

Telemetry is machine-originated operational data used for health, diagnostics, operations and analytics.

Telemetry examples:

- connectivity and heartbeat;
- current status and lifecycle health;
- temperature readings;
- ingredient and consumable levels;
- pump cycles and dispense counters;
- motor current or actuator status where available;
- door, hatch and product presence sensor values;
- cleaning cycle status;
- error codes and warning codes;
- firmware version and configuration version;
- command acknowledgement timing;
- operation start and completion timing.

Telemetry rules:

- telemetry must include `machine_id`, timestamp, source and schema version;
- raw vendor telemetry is adapter data until normalized into platform fields;
- stale telemetry must not be treated as proof of readiness;
- telemetry can support readiness decisions only through Machine Runtime policy;
- telemetry can produce domain events when it crosses business thresholds, such as inventory low, status changed or error reported;
- telemetry retention is shorter than order/payment history unless tied to incident, safety, maintenance or support audit;
- telemetry must not include payment credentials, provider secrets, customer personal data or raw access tokens.

---

# 13. Machine Events

Machine events follow Event API `<Domain>.<Fact>` naming and describe accepted machine facts.

Recommended events:

| Event | Produced after | Meaning |
|---|---|---|
| `Machines.Registered` | Machine registered. | Platform identity exists. |
| `Machines.Activated` | Machine became active. | Machine can be considered for readiness. |
| `Machines.LocationAssigned` | Location assignment changed. | Machine moved or assigned to a location. |
| `Machines.ConfigurationChanged` | Configuration version accepted. | Machine configuration changed. |
| `Machines.CapabilitiesChanged` | Capability profile changed. | Supported recipes or features changed. |
| `Machines.StatusChanged` | Operational status changed. | Readiness or availability changed. |
| `Machines.InventoryChanged` | Inventory fact accepted. | Ingredient or consumable level changed. |
| `Machines.InventoryLow` | Inventory crossed low threshold. | Refill should be considered. |
| `Machines.MaintenanceRequired` | Maintenance condition detected. | Service action is needed. |
| `Machines.CommandReceived` | Adapter or machine received command. | Command entered machine boundary. |
| `Machines.CommandAccepted` | Machine accepted command. | Operation may execute. |
| `Machines.CommandRejected` | Machine rejected command. | Operation did not start. |
| `Machines.PreparationStarted` | Physical preparation started. | Machine began making product. |
| `Machines.IceCreamDispensed` | Base portion dispensed. | Base dispense fact accepted. |
| `Machines.SyrupDispensed` | Syrup portion dispensed. | Syrup dispense fact accepted. |
| `Machines.ToppingDispensed` | Topping portion dispensed. | Topping dispense fact accepted. |
| `Machines.ProductReady` | Product is ready or presented. | Customer pickup can be signaled by approved consumers. |
| `Machines.ProductTaken` | Product pickup detected. | Product was taken where sensor policy supports it. |
| `Machines.ProductNotTaken` | Pickup window expired or product remains. | No-pickup policy is needed. |
| `Machines.PreparationFailed` | Preparation failed. | Product was not correctly prepared. |
| `Machines.DispensingFailed` | Dispensing failed or was blocked. | Physical delivery failed. |
| `Machines.OperationCompleted` | Machine operation completed. | Machine operation reached terminal success. |
| `Machines.OperationFailed` | Machine operation failed. | Recovery or refund policy may be needed. |
| `Machines.ErrorReported` | Machine error accepted. | Fault is visible to operations and support. |
| `Machines.TelemetryReported` | Telemetry accepted where eventing is needed. | Operational fact entered platform. |

Event rules:

- events are facts, not commands;
- event payloads use platform IDs and snake_case fields;
- machine-originated events require authenticated machine or adapter identity;
- event payloads include `machine_id`, `machine_operation_id`, command ID, order references, status, reason, correlation ID and causation ID when available;
- event payloads must not expose raw firmware commands, payment credentials, provider secrets, raw card data, unnecessary personal data or UI state;
- event replay rebuilds projections and monitoring but must not resend machine commands or repeat preparation.

---

# 14. Machine Commands

Machine commands are platform requests to a Machine Runtime, adapter or physical controller.

Command rules:

- commands are not events;
- platform sends commands and machine returns acknowledgements/events;
- side-effect commands require idempotency;
- commands include actor or system identity, reason where needed and correlation metadata;
- commands must be versioned when payload shape can change;
- adapters translate platform commands to hardware-specific protocol;
- duplicate commands with the same idempotency key must not create duplicate products;
- commands must not contain payment credentials, provider secrets, raw card data, bonus balances or UI state.

Future Machine Runtime commands:

| Command | Purpose |
|---|---|
| `RegisterMachine` | Create platform machine identity. |
| `AssignMachineLocation` | Assign or change machine location. |
| `UpdateMachineConfiguration` | Apply approved configuration version. |
| `UpdateMachineCapabilities` | Apply capability profile or capability report. |
| `SetMachineLifecycleState` | Pause, activate, mark maintenance, out of service or retired. |
| `RequestMachineStatus` | Ask machine or adapter for current status. |
| `RecordMachineStatus` | Accept normalized machine status fact. |
| `RequestInventoryReport` | Ask machine or operator flow for inventory state. |
| `RecordInventoryAdjustment` | Record refill, correction, waste or sensor-derived change. |
| `CreateDispatchQueueEntry` | Queue paid fulfillment operation for a machine. |
| `PrepareProduct` | Start idempotent product preparation for a paid order. |
| `CancelQueuedOperation` | Cancel queued work before physical preparation starts. |
| `SafeStopOperation` | Stop active operation when safe and policy allows. |
| `ReconcileMachineOperation` | Determine current outcome for ambiguous operation. |
| `StartCleaningCycle` | Start cleaning or sanitation cycle. |
| `RecordMaintenanceAction` | Record service work, repair, refill, calibration or inspection. |
| `ResolveMachineIncident` | Close incident after approved recovery. |
| `RebootController` | Request controlled controller reboot where safe. |

Minimal `PrepareProduct` command:

```json
{
  "command_id": "machine_command_01JZ0000000000000000000000",
  "command_type": "PrepareProduct",
  "payload_version": 1,
  "machine_id": "machine_01JZ0000000000000000000000",
  "machine_operation_id": "machine_operation_01JZ0000000000000000000000",
  "dispatch_id": "dispatch_01JZ0000000000000000000000",
  "queue_entry_id": "machine_queue_01JZ0000000000000000000000",
  "order_id": "order_01JZ0000000000000000000000",
  "order_item_id": "order_item_01JZ0000000000000000000000",
  "recipe_id": "recipe_soft_ice_vanilla_strawberry_oreo",
  "configuration_version": 1,
  "idempotency_key": "machine_operation_01JZ_prepare_v1",
  "correlation_id": "order_01JZ0000000000000000000000",
  "causation_id": "evt_01JZ0000000000000000000000",
  "issued_at": "2026-07-08T00:00:00Z"
}
```

---

# 15. Error Scenarios

Machine errors are equipment, command, adapter or operational failures. They are not payment provider errors.

Recommended error codes:

| Code | Meaning | Required handling |
|---|---|---|
| `MACHINE_NOT_FOUND` | Machine ID is unknown. | Reject command and audit. |
| `MACHINE_NOT_ACTIVE` | Lifecycle blocks operation. | Reject or route to support. |
| `MACHINE_OFFLINE` | Machine or adapter is unreachable. | Reconcile, retry status read or select alternate machine. |
| `MACHINE_STATUS_STALE` | Status is too old to trust. | Refresh status before dispatch. |
| `MACHINE_BUSY` | Machine cannot accept conflicting work. | Queue or retry within policy. |
| `MACHINE_UNSAFE` | Safety interlock, door, temperature or emergency stop blocks operation. | Stop dispatch and require recovery. |
| `MACHINE_MAINTENANCE_ACTIVE` | Service mode is active. | Reject customer operation. |
| `MACHINE_RECIPE_UNSUPPORTED` | Machine cannot prepare accepted recipe. | Select alternate machine or recover. |
| `MACHINE_INVENTORY_INSUFFICIENT` | Ingredient or consumable is unavailable. | Block recipe, refill or alternate machine. |
| `MACHINE_COMPONENT_BLOCKED` | Component jam or blockage detected. | Service action required. |
| `MACHINE_TEMPERATURE_OUT_OF_RANGE` | Product safety or quality temperature is unsafe. | Block operation until ready. |
| `MACHINE_COMMAND_DUPLICATE` | Duplicate command matches existing operation. | Return existing state. |
| `MACHINE_COMMAND_CONFLICT` | Same idempotency key has conflicting payload. | Reject and audit. |
| `MACHINE_COMMAND_UNAUTHORIZED` | Command source is not trusted. | Reject and security audit. |
| `MACHINE_UNPAID_ORDER_REJECTED` | Command lacks accepted paid dispatch context. | Reject and raise incident. |
| `MACHINE_ACK_TIMEOUT` | Acknowledgement not received in time. | Reconcile before retry. |
| `MACHINE_OPERATION_UNKNOWN` | Outcome cannot be confirmed. | Reconcile telemetry and physical state. |
| `MACHINE_PREPARATION_FAILED` | Product preparation failed. | Publish failure event and recover. |
| `MACHINE_DISPENSING_FAILED` | Product could not be dispensed or presented. | Reconcile partial outcome. |
| `MACHINE_PRODUCT_NOT_TAKEN` | Product remained after pickup window. | Apply no-pickup policy when approved. |
| `MACHINE_TELEMETRY_INVALID` | Telemetry shape or source is invalid. | Reject telemetry and audit if sensitive. |

Error rules:

- errors must be safe, machine-readable and correlated;
- physical failures must produce events or operation results;
- unknown outcome is not success and not failure until reconciled;
- retry must prefer status reconciliation before repeating physical side effects;
- repeated failures move to support review, maintenance or refund compensation through owning domains;
- errors must not expose raw firmware secrets, payment data or unnecessary personal data.

---

# 16. Maintenance Scenarios

Maintenance keeps machines safe, stocked, clean and operational.

Maintenance scenarios:

| Scenario | Purpose |
|---|---|
| Planned cleaning | Routine sanitation before policy deadline. |
| Emergency cleaning | Cleanup after failed, partial or contaminated operation. |
| Refill | Add mix, syrup, toppings, cups or service materials. |
| Calibration | Adjust dose, pump timing, sensors or temperature behavior. |
| Component repair | Fix or replace blocked, worn or failed component. |
| Firmware update | Update controller software under approved policy. |
| Installation check | Verify machine before first active use. |
| Safety inspection | Confirm machine can safely serve customers. |
| Incident recovery | Resolve an error, unknown outcome or support case. |
| Retirement preparation | Remove machine from active service and preserve records. |

Maintenance rules:

- maintenance state blocks customer preparation unless policy allows limited safe operations;
- service work requires operator identity, reason and timestamp;
- refill changes inventory through inventory adjustment records;
- cleaning, repair and calibration can change readiness and capabilities;
- firmware update must preserve adapter compatibility and audit;
- maintenance completion must not mark paid order completed by itself;
- unresolved maintenance incidents keep machine out of eligibility.

---

# 17. Service Operator Actions

Service operators perform controlled actions on machines.

Allowed operator actions:

- register machine after approval;
- assign or change location;
- activate, pause or mark out of service;
- start and finish maintenance;
- refill ingredients and consumables;
- correct inventory with reason;
- run cleaning cycle;
- calibrate pumps, dispensers and sensors;
- replace component;
- request status or inventory report;
- safe stop operation;
- resolve machine incident;
- select approved alternate machine where policy allows;
- close operation manually only under approved support policy;
- retire machine.

Operator action rules:

- every sensitive action requires actor, role, reason and audit record;
- operators cannot mark a payment as completed from Machine Domain;
- operators cannot grant bonuses or change bonus balances from Machine Domain;
- operators cannot edit historical operation results silently;
- manual operation closure requires evidence and approved policy;
- inventory correction must not change financial or payment records;
- service notes must not leak raw personal data or provider secrets.

---

# 18. Audit Trail

Machine audit reconstructs equipment state, commands, events, maintenance and operator actions.

Required audit fields:

| Field | Purpose |
|---|---|
| `audit_event_id` | Stable audit identity. |
| `machine_id` | Affected machine. |
| `machine_operation_id` | Operation reference when applicable. |
| `command_id` | Command reference when applicable. |
| `event_id` | Event reference when applicable. |
| `order_id` | Paid order reference when applicable. |
| `order_item_id` | Order item reference when applicable. |
| `recipe_id` | Accepted recipe reference when applicable. |
| `actor_type` | customer, operator, system, machine, adapter or support. |
| `actor_id` | Stable actor reference where available. |
| `action` | Accepted action or rejected sensitive attempt. |
| `reason_code` | Business, service, safety, support or system reason. |
| `from_state` | Prior state when applicable. |
| `to_state` | New state when applicable. |
| `source` | CRM, machine adapter, scheduler, runtime or API. |
| `correlation_id` | End-to-end flow correlation. |
| `causation_id` | Command, event or request that caused the action. |
| `idempotency_key` | Side-effect duplicate handling key when applicable. |
| `occurred_at` | UTC occurrence timestamp. |
| `recorded_at` | UTC audit record timestamp. |

Audit rules:

- command, acknowledgement, rejection, timeout, retry, preparation start, preparation failure, product ready, product taken, maintenance and operator recovery are auditable;
- rejected sensitive commands are auditable;
- machine-originated facts require trusted machine or adapter identity;
- audit records must not contain payment credentials, provider secrets, raw card data, raw firmware secrets or unnecessary personal data;
- audit records are append-only;
- corrections use new audit records and compensating domain actions.

---

# 19. Integration with Order Domain

Order Domain owns the business purchase lifecycle. Machine Domain owns physical execution facts.

Integration flow:

```text
Order Paid
->
Machine dispatch requested
->
Machine queue accepted
->
Machine command accepted
->
Machine preparation and dispensing events
->
Order consumes validated facts through approved transition commands
```

Integration rules:

- Order may request fulfillment only after it accepts paid state;
- Machine Domain accepts only paid dispatch requests;
- Machine queue acceptance can allow Order to move `Paid -> Queued`;
- `Machines.PreparationStarted` can allow Order to move `Queued -> Preparing`;
- dispensing and product-ready/taken facts can support Order fulfillment progress;
- machine failure after payment triggers Order recovery, support review or refund compensation policy;
- Machine Domain does not directly mutate Order state;
- Order Domain does not send low-level hardware commands directly;
- both domains share correlation IDs and operation references for audit.

---

# 20. Integration with Payment Domain

Payment Domain owns payment lifecycle and settlement confirmation. Machine Domain consumes only paid fulfillment context through Order and dispatch contracts.

Integration rules:

- Machine Domain does not create payment intents;
- Machine Domain does not authorize, capture, cancel or refund payments;
- Machine Domain does not inspect provider webhooks or YooKassa statuses;
- Machine Domain does not calculate payable amount or method lines;
- Machine Domain may store safe `payment_id` references for audit correlation when provided by Order;
- payment ambiguity blocks dispatch before machine execution;
- machine failure after payment does not rewrite Payment records;
- refund compensation is requested through Order and Payment workflows, not Machine Domain.

Payment-to-machine boundary:

```text
Payments.Completed is a Payment fact.
Orders.PaymentConfirmed is an Order fact.
Machine command is allowed only after Order accepts paid fulfillment context.
```

---

# 21. Integration with Product Domain

Product Domain owns catalog, configuration, pricing source rules, media and recipes. Machine Domain consumes accepted recipe references and machine profile mappings.

Integration rules:

- Machine Domain does not own product names, prices, media or customer-facing catalog availability;
- Machine Domain does not calculate final product configuration;
- Machine command uses accepted `recipe_id`, option IDs and recipe profile references from immutable Order snapshots;
- Machine capability checks validate whether a machine can execute the accepted recipe;
- recipe mapping translates Product Domain recipe into machine adapter instructions;
- unsupported recipe on one machine can block that machine without retiring the global product;
- ingredient slot mapping must use stable semantic IDs such as `syrup_strawberry` and `topping_oreo`;
- recipe, capability and calibration versions must be recorded for audit.

Recipe boundary:

```text
Product Domain defines what should be made.
Machine Domain determines whether this machine can make it now and reports what happened.
```

---

# 22. Future Roadmap

Recommended future tasks:

1. Define Machine Runtime command schemas.
2. Define Machine Runtime query schemas.
3. Define Machine event payload schemas and Event Registry entries.
4. Define machine adapter authentication and replay protection.
5. Define machine capability profile metadata and versioning.
6. Define recipe-to-machine instruction mapping contract.
7. Define inventory storage, thresholds, refill and reconciliation policy.
8. Define telemetry schema, retention and health scoring policy.
9. Define dispatch queue persistence, ordering and recovery policy.
10. Define status reconciliation API for unknown command outcomes.
11. Define safe stop, cleanup and partial preparation workflow.
12. Define product-ready, product-taken and product-not-taken policy.
13. Define alternate-machine policy after payment.
14. Define maintenance scheduler and service operator workflows.
15. Define CRM/support machine incident views.
16. Define machine analytics dashboards and operational alerts.
17. Define simulator or test adapter for development.
18. Define hardware certification checklist before production use.
19. Add test scenarios for paid dispatch, rejection, preparation failure, telemetry loss, inventory low, maintenance and recovery.
20. Implement Machine Runtime only after command, event, adapter and safety contracts are approved.

---

# 23. Readiness Criteria

Machine Domain is architecture-ready when:

- Machine Domain purpose is documented;
- Machine as business entity is documented;
- lifecycle and statuses are documented;
- location, configuration, capabilities and components are documented;
- product dispensing rules are documented;
- payment-to-dispatch rule is documented;
- inventory and telemetry overviews are documented;
- machine events and commands are documented;
- error and maintenance scenarios are documented;
- service operator actions and audit trail are documented;
- integration with Order, Payment and Product Domains is documented;
- future roadmap is documented;
- machine does not start preparation before payment confirmation;
- machine receives only paid orders;
- product preparation failure is reported as an event;
- documentation remains practical and implementation-ready;
- no application source code is modified.

Implementation-ready criteria for future tasks:

- exact command and event schemas are approved;
- machine adapter protocol and authentication are approved;
- inventory and telemetry storage contracts are approved;
- readiness and safety checks are approved;
- retry, recovery and unknown-outcome policies are approved;
- service operator roles and audit permissions are approved;
- Product Owner approves no-pickup, partial dispensing and alternate-machine customer policies.

---

# 24. Documentation Scope

This document is documentation-only.

It does not introduce application code, frontend code, backend code, Telegram bot code, runtime configuration, database migrations, generated build output, payment provider integration, real machine firmware commands, real machine credentials, CRM screens, notification templates or final hardware safety certification.
