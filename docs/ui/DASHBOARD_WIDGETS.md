# Admin Dashboard Widgets v1

Status: Specification
Version: 1.0
Date: 2026-07-23

## 1. Dashboard contract

The Admin Dashboard is an exception-oriented, permission-composed projection. Every widget displays:

- title and plain-language metric definition;
- current value/status and comparison basis;
- period, time zone, currency/unit and organization scope;
- `as of` time, freshness target and complete/partial/stale state;
- source/metric version link;
- accessible text summary and drill-down destination.

Missing or denied data is never treated as zero. Widgets must not calculate authoritative values in the client.

## 2. Widget catalog

| Widget | Purpose and displayed data | Interactions | Permission / drill-down |
|---|---|---|---|
| Revenue | Net/gross paid revenue as explicitly selected, refunds and change versus prior comparable period/target. | Period/scope/channel; hover/focus time points; open Revenue Report. | `reports.revenue.read`; financial scope. |
| Sales | Paid orders, units/servings, average order value, success/failure trend. | Compare period, channel, region; open Orders/Revenue. | sales report permission. |
| Machines online/offline | Counts and share of online, offline, unknown and stale-contact machines. | Filter group/region; click state to Machine list. | `fleet.read`. |
| Machine health | Healthy/degraded/critical distribution, failed dispense rate, active incidents and affected revenue estimate definition. | Select severity/component; open Fleet/Incidents. | fleet and incident reads. |
| Top products | Ranked products by paid units or revenue with mix share and change. | Choose measure/top N/channel; open Product Analytics. | sales/product analytics. |
| Low inventory | Machines/warehouses below threshold, servings remaining, earliest stockout/expiry and unresolved variance. | Filter location/item/risk; create permitted replenishment proposal. | inventory read; action separate. |
| Pending operator tasks | Unassigned, due soon, overdue, awaiting approval and SLA-risk tasks. | Filter priority/region/type; assign/open review when permitted. | operations task reads/manage. |
| Recent payments | Latest accepted, pending, failed, refunded and mismatch-flagged payments with masked customer and amount. | Filter state/provider; open Payment detail. | payment read with field redaction. |
| Alerts | Critical/high machine, inventory, payment, integration, security and campaign alerts. | Acknowledge, assign, open source; acknowledgement does not resolve source. | source-specific permission. |
| AI recommendations (future) | Evidence-linked observation/recommendation, confidence, source freshness, expiry and review status. | Inspect evidence, dismiss/report, open draft workflow; never execute directly. | future AI permission plus source reads. |

## 3. Default layouts

### Administrator

Row 1: Revenue, Sales, Machines online/offline, Machine health.
Row 2: Alerts and Low inventory.
Row 3: Pending operator tasks and Recent payments.
Row 4: Top products; future AI recommendations.

### Support

Recent payments, payment exceptions, customer-support alerts and own assigned notifications. Revenue/profit is absent unless separately permitted.

### Marketing

Sales, Top products, active campaign status, CTR/conversions and consent eligibility aggregates. No customer-level audience list.

### Accountant

Revenue, Sales, Recent payments, reconciliation exceptions, unsettled amounts and inventory-value risks.

### Auditor

Read-only freshness overview, privileged-action alerts, export activity, access-review debt and reconciliation exceptions.

### Owner in Admin Console

Same permission-composed administrative dashboard. Strategic KPIs remain in the separate Executive Console.

## 4. Filters and comparison

Global controls:

- Today, yesterday, last 7/30 days, month-to-date, custom range;
- previous comparable period or approved target;
- organization, region, location, machine group;
- sales channel;
- time zone and display currency when permitted.

Widgets may add local filters but clearly indicate deviation from global context. Comparison handles partial periods explicitly.

## 5. Status behavior

| State | Required display |
|---|---|
| Loading | skeleton preserving layout; no fake values |
| Empty | “No activity in this scope/period” plus reset filters |
| Partial | visible sources missing, coverage percentage and excluded totals |
| Stale | last successful timestamp and refresh/retry |
| Unavailable | error/reference and unaffected widgets remain usable |
| Redacted | permission explanation without revealing the value |
| Anomalous | accessible marker, definition and link to evidence |

## 6. Widget actions

Widgets are read-only except contextual links and explicitly permissioned workflow entry points. Reordering/hiding saves only personal presentation preferences. Shared layout publishing is future and requires permission.

CSV/image export of a widget follows report export policy. Copying a chart preserves title, scope, period, freshness and definition version.

## 7. Responsive behavior

- Desktop: four-column KPI row; analytical widgets span two or four columns.
- Tablet: two columns.
- Mobile: single column; severity-first order; charts simplify while retaining tabular summary.
- Large touch: two/three columns with larger controls and reduced density.

User-defined order cannot hide critical alerts when policy marks them mandatory.

## 8. Future AI widget guardrails

AI recommendations are labelled `Observation`, `Prediction` or `Recommendation`, never fact. Each includes evidence links, confidence/uncertainty, model/policy version, input watermark and expiry. Missing/contradictory inputs produce `Insufficient evidence`. A recommendation may open a typed draft in an existing Admin workflow; a human with the relevant permission submits it. AI cannot command machines, alter stock, refund, change price, activate a campaign, grant access or approve evidence.
