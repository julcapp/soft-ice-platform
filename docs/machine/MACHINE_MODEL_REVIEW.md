# Machine Model Review

Document code: MACHINE-MODEL-REVIEW-001
Task: EPIC-372 / MACHINE-003
Version: 0.1
Status: Completed
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-09
Last updated: 2026-07-09
Scope: Documentation only

This document records the Machine documentation consistency review for EPIC-372 / MACHINE-003.

Review rule:

```text
Do not rewrite documents unnecessarily.
Only update reviewed documentation when a real inconsistency exists.
Unknown hardware characteristics must remain Unknown or To be confirmed until verified.
```

---

# 1. Reviewed Documents

- `docs/machine/MACHINE_PASSPORT.md`
- `docs/domain/MACHINE_DOMAIN.md`
- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/architecture/PROJECT_DECISIONS.md`

Supporting references checked for source consistency:

- `docs/vending_machine_ui.md`
- `docs/tasks/ORDER-008_MACHINE_DISPATCH.md`
- `docs/architecture/ORDER_PLATFORM.md`

---

# 2. Review Summary

The reviewed Machine documentation is consistent on the core architecture boundary:

- Machine Domain owns physical execution facts, machine state, inventory, telemetry, commands, operations, maintenance and audit.
- Order Domain owns the purchase lifecycle and consumes validated machine facts through approved transitions.
- Payment Domain owns payment confirmation, settlement and refunds.
- Product Domain owns catalog, configuration, pricing source rules, media and recipe source models.
- Machines receive only paid orders and must not start preparation before accepted payment context exists.
- Unknown hardware facts are not presented as verified equipment facts.

No broad rewrite was needed.

---

# 3. Found Inconsistencies

## 3.1 Machine inventory identifier naming

Status: Fixed in `docs/data/PLATFORM_DATA_MODEL.md`.

Finding:

- `docs/domain/MACHINE_DOMAIN.md` uses `machine_inventory_id` in the Machine Inventory model.
- `docs/data/PLATFORM_DATA_MODEL.md` used `inventory_id` for `MachineInventory`.

Resolution:

- `MachineInventory` now uses `machine_inventory_id` in the platform data model.

Reason:

- The prefixed identifier is clearer, avoids collision with non-machine inventory concepts and matches the Machine Domain example.

## 3.2 Machine command identifier naming

Status: Fixed in `docs/data/PLATFORM_DATA_MODEL.md`.

Finding:

- `docs/domain/MACHINE_DOMAIN.md`, `docs/tasks/ORDER-008_MACHINE_DISPATCH.md` and `docs/architecture/ORDER_PLATFORM.md` use `command_id` for machine command payloads and audit references.
- `docs/data/PLATFORM_DATA_MODEL.md` used `machine_command_id` for `MachineCommand`.

Resolution:

- `MachineCommand` now uses `command_id` in the platform data model.

Reason:

- `command_id` is the canonical command-envelope field already used by the Machine and Order dispatch documentation. The ID value may still use a `machine_command_...` prefix.

## 3.3 Missing Machine relationships in cardinality summary

Status: Fixed in `docs/data/PLATFORM_DATA_MODEL.md`.

Finding:

- Section 11 of the platform data model documented Machine capabilities, dispatch queue entries, operations, commands, telemetry events and incidents.
- Section 15 did not summarize several of those relationships.

Resolution:

- Added relationship summary rows for:
  - `Machine -> MachineCapability`
  - `Machine -> DispatchQueueEntry`
  - `DispatchQueueEntry -> MachineOperation`
  - `MachineOperation -> MachineCommand`
  - `Machine -> MachineTelemetryEvent`
  - `Machine -> MachineIncident`

Reason:

- These relationships are required to keep the logical data model aligned with Machine Domain execution, telemetry, maintenance and audit concepts.

---

# 4. Consistency Findings

## 4.1 Terminology consistency

Result: Consistent with minor future clarification needed.

- `Machine Domain`, `Machine Runtime`, `Machine Dispatch`, `Machine Platform`, `machine adapter`, `MachineOperation`, `DispatchQueueEntry` and `MachineCommand` are used consistently for the current documentation stage.
- `Machine Dispatch` is correctly treated as the technical handoff after paid Order acceptance, not as payment or Order lifecycle ownership.
- `Payments supported by equipment` in the passport is scoped to hardware or terminal-equipment capability and does not move payment logic into Machine Domain.

Future clarification:

- Keep using `Machine Dispatch` for the handoff flow and `Machine Domain` / `Machine Runtime` for the owning bounded context.

## 4.2 Entity naming consistency

Result: Mostly consistent; fixed where concrete drift existed.

- `Machine`, `MachineGroup`, `Location`, `DispatchQueueEntry`, `MachineOperation`, `MachineCommand`, `MachineInventory`, `MachineTelemetryEvent` and `MachineIncident` now align across the reviewed model documents.
- Generated operational IDs remain acceptable for runtime records.
- Semantic IDs for product, syrup, topping, recipe and media references remain owned by Product Domain.

## 4.3 Component naming consistency

Result: No blocking inconsistency.

- `docs/domain/MACHINE_DOMAIN.md` uses logical component codes such as `controller`, `network_module`, `freezer_unit`, `mix_hopper`, `cup_dispenser`, `syrup_pump`, `topping_dispenser`, `pickup_hatch`, `temperature_sensor` and `cleaning_system`.
- `docs/machine/MACHINE_PASSPORT.md` uses hardware-facing labels such as refrigeration system, mix tanks, pumps, valves, syrup dispensers and topping dispensers.

This is acceptable because the passport has not yet received verified manufacturer hardware details.

Future clarification:

- After manufacturer verification, add a mapping between physical hardware labels and Machine Domain component codes.

## 4.4 Missing relationships

Result: Fixed for the current logical model.

The missing relationships were in the platform data model relationship summary, not in the Machine Domain model itself.

## 4.5 Conflicting definitions

Result: No conflicting ownership definitions found.

The reviewed documents agree that:

- Machine does not decide payment state.
- Machine does not calculate payable amount.
- Machine does not own product catalog data.
- Machine inventory is separate from payment and financial records.
- Unknown machine outcome requires reconciliation before completion, retry or refund compensation.
- Physical preparation failure must be reported as a Machine event or operation result.

## 4.6 Unknown hardware assumptions

Result: No unmarked hardware assumptions found.

The passport correctly marks manufacturer, model, dimensions, weight, power, exact sensor list, actuator list, network interfaces, controller, maintenance intervals, safety certificates and real serial number as `Unknown` or `To be confirmed`.

Verified platform facts such as cup inventory control, syrup/topping option counts, QR/NFC entry points and card/QR/SBP terminal scenarios are documented as platform or vending UI facts, not as fully verified manufacturer hardware facts.

---

# 5. Decisions Required

1. Confirm manufacturer, model, serial number, controller type and hardware revision from equipment label or manufacturer documents.
2. Confirm physical sensor and actuator inventory before Machine Runtime schema finalization.
3. Decide whether future capability modeling needs both `MachineCapability` records and reusable `MachineCapabilityProfile` templates.
4. Approve the mapping between physical hardware components and Machine Domain component codes after hardware verification.
5. Approve adapter authentication, replay protection, telemetry retention and command reconciliation policies before runtime implementation.
6. Approve customer/support policies for no-pickup, partial dispensing, ambiguous outcome and alternate-machine fulfillment after payment.

---

# 6. Recommendations

1. Keep the current Machine Passport as a hardware verification boundary and do not convert `Unknown` or `To be confirmed` fields into facts without manufacturer evidence.
2. Use `command_id` as the canonical command envelope identifier and `machine_operation_id` as the physical execution record identifier.
3. Use `machine_inventory_id` for Machine inventory records in future schemas.
4. Add a component mapping table only after real hardware documentation is available.
5. Add test scenarios for paid dispatch, command rejection, preparation failure, telemetry loss, inventory low, maintenance block and unknown outcome reconciliation before Machine Runtime implementation.
6. Keep future Machine Runtime implementation documentation-first until command, event, adapter, telemetry, safety and recovery contracts are approved.

---

# 7. Verification

This review is documentation-only.

No application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output was changed.

Build was not run because no executable application behavior changed.
