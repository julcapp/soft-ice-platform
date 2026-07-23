# Machine Operations Platform

Status: Approved
Version: 1.0
Checkpoint date: 2026-07-23

## Purpose and boundary

Machine Operations Platform is the bounded context for authenticated, assigned and auditable human work performed on vending machines. It is separate from CRM, Customer, Loyalty, Pricing, Advertising, Order, Payment and the machine protocol/gateway boundary.

CRM/Admin Console is the central management interface for oversight, but Machine Operations owns its operational records, permissions and state transitions. Machine Domain continues to own machine identity and machine-reported state. Inventory remains the source of stock movements and reconciliation facts.

## Operator App responsibilities

An authorized operator may:

- view machines assigned to that operator;
- receive and execute maintenance tasks;
- complete the version of a checklist attached to a task;
- record ingredient and consumable refills;
- perform authorized test runs;
- attach photo evidence;
- report faults;
- submit a service report for administrative review.

Assignments limit visibility and action scope. Every mutation requires an authenticated actor, timestamp, target, correlation reference and auditable reason or result where applicable. Checklist versions used by completed work remain immutable.

## Operator restrictions

The Operator App must deny permissions to:

- change prices;
- change commercial machine settings;
- change loyalty rules;
- manage advertising;
- manage customers.

These restrictions are explicit, deny-by-default authorization boundaries, not UI-only hiding rules.

## Administrator responsibilities

An authorized administrator may:

- change prices and commercial settings through the owning domain contracts;
- configure and version checklists;
- assign, reassign and review maintenance tasks;
- view and audit all operator actions;
- approve or reject submitted service reports with a recorded decision and reason;
- perform the same maintenance and test actions as an operator when necessary.

Administrator actions use a distinct permission set and remain fully audited. Administrative authority does not permit rewriting immutable operational, inventory, order, payment or financial history.

## Test operations and inventory

Every test or service operation that consumes or discards stock must create one or more inventory consumption records classified by an approved reason:

- `TEST_CUP`;
- `TEST_ICECREAM`;
- `TEST_TOPPING`;
- `TEST_FULL_CYCLE`;
- `CALIBRATION`;
- `CLEANING`;
- `WASTE`.

A full-cycle test may create component-level movements linked to the same test-operation ID. Zero-consumption outcomes must be explicit when policy requires a record; consumed quantities must never be inferred from a service-report narrative.

Test and service consumption is separated from sales consumption by movement classification and source reference. It must not create a sale, order revenue or customer purchase. Both consumption classes are included in total stock reconciliation:

```text
opening stock + refills - sales consumption - test/service consumption
- waste - approved corrections = expected closing stock
```

Reconciliation must retain the originating machine, operator/admin actor, operation, reason, quantities, units and timestamps.

## Core records

| Record | Responsibility |
|---|---|
| Operator identity and assignment | Establish operational actor and machine scope. |
| Maintenance task | Track assigned work, priority, lifecycle and due information. |
| Checklist and checklist version | Define immutable instructions used for a specific task execution. |
| Refill record | Record stock added to a machine. |
| Test operation | Record test type, execution, outcome and linked consumption. |
| Inventory consumption | Record quantity and non-sales reason for reconciliation. |
| Photo evidence | Store metadata and an external object reference; binary objects remain outside relational records. |
| Fault report | Record observed failure, severity, evidence and resolution linkage. |
| Service report | Summarize completed work and carry submission, approval or rejection state. |
| Audit event | Reconstruct every sensitive operator and administrator action. |

## Future Operator App expansion

The following capabilities are accepted direction but require separately scoped implementation decisions:

- before/after photos;
- ingredient batches and expiry dates;
- GPS confirmation;
- maintenance scheduling;
- operator routes;
- offline mode with conflict-safe synchronization;
- digital service acceptance;
- senior operator role.

## Out of scope for this checkpoint

No application code, Prisma schema, API behavior, authorization middleware, inventory logic or UI is changed by this document.
