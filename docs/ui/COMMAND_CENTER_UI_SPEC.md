# Soft ICE Command Center UI Specification v1

Status: Approved  
Version: 1.0  
Date: 2026-07-23  
Classification: DOCUMENTED_ONLY

## Purpose and boundary

Command Center is the owner-level central operating view across commercial, financial, fleet, service, inventory, customer and growth signals. It is a read-oriented composition over governed read models. It does not own facts or grant mutation authority. Administrative actions hand off to the separately authorized Admin Console workflow.

## Information architecture

1. **Now:** active critical errors, offline fleet, payment alerts, pending approvals and freshness.
2. **Today:** revenue, sales, gross margin, network availability and low stock.
3. **Operations:** machines requiring service, operator routes, refill risk and anomaly detection.
4. **Growth:** advertising performance, loyalty activity and customer growth.
5. **Outlook:** next-day forecast and clearly labelled AI recommendations.

Global controls define organization/location scope, business date, timezone and currency. Each widget shows `as of`, freshness state, coverage and comparison basis.

## Widget data contract

| Widget | Source domains | Target refresh | Calculation owner | Permission | Drill-down |
|---|---|---|---|---|---|
| Today revenue | Orders, Payments | 1–5 min | Finance/Reporting | executive.finance.read | paid orders → payment reconciliation |
| Today sales | Orders | 1–5 min | Order Analytics | executive.overview.read | sales → order list |
| Gross margin | Orders, Payments, Inventory | 15 min | Finance | executive.finance.read | margin bridge → source transactions |
| Network status / online-offline | Telemetry, Machine | 30–60 sec | Machine Reporting | executive.operations.read | fleet map/list → machine twin |
| Active errors | Machine Operations, Telemetry | 30–60 sec | Machine Operations | executive.operations.read | incidents → machine/task |
| Machines requiring service | Machine Operations | 1 min | Machine Operations | executive.operations.read | service queue → task/report |
| Low stock | Inventory, Telemetry | 5 min | Inventory | executive.inventory.read | shortage list → machine inventory |
| Operator routes | Machine Operations | 5 min | Machine Operations | operations.route.read | route → assignments/tasks |
| Pending approvals | Audit, Machine Operations, commercial domains | 1 min | Workflow owners | scoped approval.read | approval queue → owning workflow |
| Payment alerts | Payments, Orders, Audit | 1 min | Payment/Finance | executive.finance.read | exception → payment/order/audit |
| Advertising performance | Advertising, Orders | 15 min | Advertising Analytics | executive.growth.read | campaign → governed attribution |
| Loyalty activity | Loyalty, Customers, Orders | 15 min | Loyalty | executive.growth.read | activity → aggregate detail |
| Customer growth | Customers, Consent | hourly | Customer Analytics | executive.growth.read | cohort → privacy-safe source |
| Anomaly detection | governed projections | 5–15 min | Reporting/Risk | executive.risk.read | anomaly → evidence set |
| AI recommendations | governed projections | policy-defined | AI Supervisor | executive.ai.read | recommendation → evidence/review |
| Next-day forecast | Orders, Inventory, Telemetry, calendar inputs | hourly | Forecasting owner | executive.overview.read | forecast → drivers/confidence |

Exact formulas, inclusion rules and service objectives live in versioned metric definitions. A widget may not ship without source domains, formula owner, refresh/freshness, permission scope and drill-down destination.

## Interaction and safety

All drill-downs preserve scope, time and source metric version. Missing or partial sources are explicit. AI content is visually separated from confirmed facts and shows evidence, uncertainty, expiry and human review status. AI cannot autonomously change prices, loyalty, payments, machine settings or operator assignments. Optional modules disappear cleanly when disabled, with remaining layout reflowing.

