# Machine Operations Platform v1

Status: Implemented
Version: 1.0
Date: 2026-07-21

## Purpose

`machine_operations` owns human operational work performed on vending machines: maintenance tasks and checklists, service reports, test-run facts, material consumption, and photo evidence. It is separate from the Machine domain, which owns machine identity/state, and from pricing, commercial configuration, loyalty, and order fulfillment.

## Actors and permissions

An `Operator` has role `OPERATOR` or `ADMIN` and status `ACTIVE` or `SUSPENDED`. Authorization is deny-by-default. Suspended operators have no operational permissions.

Operators may execute their assigned maintenance tasks, perform test runs, record inventory consumption, attach photo evidence, and submit service reports. Operators cannot change prices, commercial settings, loyalty settings, checklists, machine settings, or approve reports.

Admins inherit operator capabilities and may view all operator audit actions, approve submitted service reports, configure versioned checklists, assign maintenance tasks, provision operators, and manage machine settings. Admin authority does not bypass domain validation and grants no pricing, commercial, or loyalty control through this module.

## Model

- `Operator` is the stable operational actor.
- `OperatorPermission` stores explicit semantic grants; role grants provide the v1 baseline.
- `MaintenanceChecklist` is immutable by `(code, version)` and stores checklist item definitions.
- `MaintenanceTask` binds one checklist version, machine, and assignee and preserves submitted results.
- `ServiceLog` records work performed and follows `DRAFT/SUBMITTED/APPROVED/REJECTED` review state.
- `TestRun` records a passed or failed machine test and owns its material-consumption references.
- `InventoryMovement` is the inventory integration fact for consumption, replenishment, or adjustment.
- `PhotoEvidence` stores object-storage metadata, SHA-256 integrity evidence, capture time, and exactly one operational aggregate reference at the API boundary. Binary photo bytes remain in object storage.
- `MachineSetting` stores admin-managed, machine-scoped operational settings. Commercial pricing and loyalty settings are outside this domain.

## Test-run invariant

A test run is persisted in one database transaction with positive consumption movements for `CUP`, `ICE_CREAM_MIX`, and `TOPPING`. Each quantity has a unit; toppings may carry a semantic catalog reference such as `topping_oreo`. If any category is missing or a write fails, neither the run nor its movements are committed.

## Audit and security

Every state-changing action records an `AuditEvent` with `subjectType=operator`, stable actor and target IDs, correlation ID, and safe metadata. Photo bytes, credentials, and secrets are never stored in audit metadata.

Public clients cannot self-assert operator identity. API v1 consumes `X-Operator-ID` only as an authenticated trusted-gateway assertion. Direct deployment without a gateway that strips client identity headers and injects verified canonical identity is prohibited.

## Boundaries

The module does not own prices, commercial configuration, loyalty, customers, payments, orders, hardware protocols, binary media storage, or physical safety certification. Inventory facts can later feed a dedicated inventory ledger without changing application contracts.
