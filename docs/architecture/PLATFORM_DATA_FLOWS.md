# Platform Data Flows

Status: Approved
Document code: ARCH-FLOW-001
Version: 1.0
Effective date: 2026-07-23

## Purpose

This document records the authoritative high-level data flows between Soft ICE Platform areas. The flows define ownership and trust transitions, not transport-specific API implementations.

## Flow Rules

- Every external fact is authenticated or verified before it becomes a platform fact.
- Every mutating request carries correlation and idempotency context where required.
- Interfaces call owning services and never write domain storage directly.
- Domain events describe accepted facts; consumers must be idempotent.
- Audit records privileged actions without replacing the owning domain record.
- Failure at a gate stops downstream actions and leaves a traceable outcome.

## 1. Customer Registration and Consent

```text
Telegram Mini App / customer channel
  -> Auth Core verifies channel evidence
  -> Customer Identity resolves or creates canonical customer_id
  -> Auth Core creates customer session
  -> Consent service presents/records versioned decisions
  -> Customer Platform receives safe profile and consent projection
  -> audit records identity and consent mutations
```

1. A customer opens Telegram Mini App or another approved customer channel.
2. Auth Core verifies Telegram init data or the channel's approved identity proof.
3. Customer Identity resolves the external identity to canonical `customer_id` or creates the permitted customer record.
4. Auth Core issues an authenticated customer session containing no business state.
5. The customer receives the applicable consent documents and versions.
6. Consent service appends each accepted or declined decision with server time, source channel, document version and idempotency evidence.
7. Customer Platform reads only safe identity and current-consent projections.
8. Identity linking and consent changes create audit facts.

Consent history is immutable. Advertising, loyalty and other consumers read authoritative decisions and never infer consent from UI state.

## 2. Customer Purchase and Payment

```text
Customer Platform
  -> Catalog / Product Configurator
  -> Pricing and eligibility services
  -> Checkout
  -> Order creates purchase intent
  -> Payment Core creates payment intent/session
  -> provider adapter presents YooKassa / Sber / SBP QR channel
```

1. Customer Platform requests catalog, availability, media and current price projections from owning services.
2. Product configuration is validated and priced by backend/domain services.
3. Checkout validates authenticated customer, machine/product availability and the proposed commercial snapshot.
4. Order records the purchase intent and immutable commercial references required for the transaction.
5. Payment Core creates a provider-independent payment intent and a concrete payment session.
6. A YooKassa, Sber or SBP QR adapter translates the session to the provider channel.
7. Customer Platform displays safe provider instructions or redirect/QR data.

The UI does not calculate final price, accept payment or command the machine.

## 3. Payment Confirmation and Dispense

```text
Payment provider
  -> authenticated webhook / approved polling adapter
  -> deduplication and normalization
  -> Payment Core accepts payment fact
  -> ledger entry and payment state
  -> Order marks purchase paid
  -> Machine creates dispense request
  -> MachineGateway
  -> Huaxin adapter or Machine Simulator
  -> dispense result
  -> Machine and Order fulfillment state
  -> customer/CRM projections
```

1. The provider sends a callback or is queried through an approved adapter.
2. The integration boundary verifies signature/credentials, freshness, event identity and payload shape.
3. Idempotency rejects duplicate processing and conflicting replays.
4. The adapter normalizes the provider result; Payment Core decides whether it is an accepted payment fact.
5. Payment Core records payment state and immutable ledger/operation facts.
6. Order consumes the accepted payment fact and transitions the matching purchase to paid exactly once.
7. Machine creates a dispense request only for the accepted paid order.
8. `MachineGateway` sends a vendor-neutral command through the configured Huaxin adapter or simulator.
9. The gateway normalizes telemetry and the physical result.
10. Machine owns dispense status; Order owns fulfillment status; customer and CRM projections update from accepted facts.

A webhook must never directly mark an order paid or command a machine. A dispense failure does not erase accepted payment history and must enter the approved recovery/refund workflow.

## 4. Operator Service and Inventory Refill

```text
Operator App
  -> operator authentication and assignment authorization
  -> Machine Operations task + checklist version
  -> operator records work/evidence/refill
  -> Inventory records movements
  -> service report submitted
  -> Administrator reviews in CRM/Admin Console
  -> audit and reporting projections
```

1. Operator authenticates through the operator security boundary.
2. Machine Operations confirms the machine assignment, task permission and checklist version.
3. Operator performs checklist steps and records timestamps, outcomes, faults and evidence.
4. Each refill creates inventory movement records linked to machine, task, actor, material, quantity, unit and batch/expiry when supported.
5. Photo evidence bytes go to approved object storage; domain records retain metadata and governed references.
6. Operator submits the service report.
7. Administrator reviews, approves or rejects the report with a reason.
8. Every mutation and decision is auditable and feeds operational reporting.

CRM/Admin Console provides oversight but does not write Machine Operations or Inventory storage directly.

## 5. Operator Test Run and Material Consumption

```text
approved test task
  -> Operator App requests test
  -> Machine Operations validates actor/scope/test type
  -> Machine Platform executes through MachineGateway
  -> result and measured consumption
  -> non-sale Inventory movements
  -> atomic test completion
  -> service report and administrator audit
```

1. An operator or authorized administrator starts an approved test for an assigned machine.
2. Machine Operations validates actor, task, machine state, checklist and test type.
3. Machine Platform executes the test through the vendor-neutral gateway.
4. The gateway returns the normalized result and available consumption facts.
5. Inventory records each consumed cup, ice-cream mix, syrup, topping or other material with a non-sale reason such as test, calibration, cleaning or waste.
6. Successful test completion and required consumption movements commit atomically.
7. The test, inventory movements, evidence and actor are linked in the service record and audit trail.

Every test dispense creates non-sale inventory consumption. It creates no order revenue or customer purchase.

## 6. Advertising Display and Click Tracking

```text
Customer Platform requests placement
  -> Auth Core confirms customer
  -> Customer Identity confirms verified phone
  -> Consent confirms all required active decisions
  -> Advertising selects an approved eligible creative
  -> Media supplies creative asset
  -> display fact
  -> customer click
  -> Referral Link resolution
  -> append-only Click Event
  -> optional future Conversion Event
  -> advertising reporting / analytics projection
```

1. Customer Platform requests content for an approved placement.
2. Advertising checks authenticated `customer_id`.
3. Customer Identity confirms verified-phone status.
4. Consent confirms all required active decisions for the requested use.
5. Advertising applies approved campaign, creative and placement lifecycle rules.
6. Media Library supplies the governed creative asset.
7. Advertising records the display fact when display tracking is in scope.
8. A click resolves a stable Referral Link and creates an append-only, deduplicated Click Event.
9. A future approved purchase attribution process may create a Conversion Event without rewriting the click.
10. Reporting and Analytics consume governed projections.

The flow fails closed if any authentication or consent gate cannot be proven. Targeting, ranking and optimization are future behavior until separately approved.

## 7. CRM Reporting and Audit

```text
owning domains
  -> governed operational/financial/customer/advertising facts
  -> reporting projections
  -> permission-scoped CRM/Admin queries

all privileged actions
  -> audit pipeline
  -> immutable/tamper-resistant audit view
  -> administrator oversight
```

1. Customer, Loyalty, Payment, Order, Machine, Machine Operations, Inventory and Advertising remain sources of their own facts.
2. Reporting services build governed read models without taking write ownership.
3. CRM/Admin Console requests permission-scoped reports and drill-downs.
4. Sensitive reads and privileged mutations create audit facts with actor, target, action, result, time and correlation reference.
5. Administrators can review every operator action and relevant cross-domain history.
6. Reconciliation compares payment ledger/provider settlement/order state and inventory compares opening stock, refills, sales, tests/service, waste and approved corrections.

Reports and audit views are projections. Corrections occur through owning domain workflows and corrective records, never by editing report totals or immutable history.

## Failure and Recovery Expectations

- Duplicate external messages are safe through idempotency.
- Partial cross-domain work uses explicit retry, compensation or reconciliation states.
- Provider, machine and evidence-upload failures retain correlation context.
- Operational errors expose safe codes; logs retain diagnostic context without secrets.
- Monitoring alerts on stuck payment, dispense, webhook, service approval and reconciliation states.

## Non-Implementation Scope

These flows define architecture only. No APIs, events, database schema, tests, provider calls or runtime behavior are added by this document.
