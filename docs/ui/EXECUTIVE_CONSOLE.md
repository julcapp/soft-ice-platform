# Executive Console UI/UX Specification v1

Status: Specification
Version: 1.0
Date: 2026-07-23
Access: Owner only

## 1. Purpose and boundary

Executive Console is a separate, owner-only, primarily read-only surface for strategic decisions. It consumes governed, aggregated and redacted reporting projections. It does not expose administrative mutations or call domain command APIs.

If the Owner also has an administrative role, `Open Admin Console` starts or switches to a separately authorized context. Context, session and visual shell make the boundary unmistakable.

## 2. Executive shell

- Compact navigation for Overview, Commercial, Operations, Finance, Inventory, Growth, Risk, Map, Business Health and future AI Supervisor.
- Persistent scope, period, comparison, currency and time-zone controls.
- `As of`, source coverage and metric version visible on every tile.
- Briefing mode provides a linear summary; analysis mode provides drill-down.
- Export creates an expiring, audited owner report; scheduled board packs are future.

Personal and small-cohort data is suppressed. Search is limited to aggregate dimensions such as region, location, machine group, product and campaign.

## 3. KPI framework

| KPI family | Measures | Decision supported |
|---|---|---|
| Commercial | paid revenue, orders, units, AOV, product mix, refunds | growth and offer performance |
| Profit | governed gross contribution/profit projection with definition and source coverage | economic health |
| Cash flow | inflows, refunds, settlement lag, expected/actual cash positions | liquidity |
| ROI | machine/location/campaign return with capital/cost inclusion rules | capital allocation |
| Fleet | active machines, availability, utilization, failed dispense, stockout impact | network productivity |
| Customer | active/repeat customers, retention, Club participation, consent-governed acquisition | sustainable growth |
| Risk | incidents, reconciliation exceptions, expiry/waste, access/audit exceptions | intervention priority |

Forecast, target and actual are distinct series. Profit, cash flow and ROI remain unavailable until their governed metric contracts and source coverage are approved; they are never approximated silently.

## 4. Screens

### 4.1 Executive Overview

**Purpose:** answer “Is the business healthy today and versus plan?”
**Data:** revenue, orders, AOV, profit, cash position, ROI, active/available machines, stockout impact, repeat customers and top risks.
**Actions:** change context, inspect definition/evidence, drill to executive dashboards, export briefing.
**Filters:** period, comparison, organization, region, currency, time zone.
**Sorting/search/bulk:** KPI rankings sortable; aggregate dimension search; no bulk actions.
**Permission:** `executive.overview.read`; finance tiles require finance permission.
**Related:** all governed reporting projections.
**Future:** targets, plan variance and board narrative.

### 4.2 Commercial Performance

**Purpose:** identify products, locations, channels and campaigns driving results.
**Data:** revenue/orders/AOV, product mix, top/bottom locations, promotion/advertising attribution and refund impact.
**Actions:** compare periods/dimensions, open metric definition, export.
**Filters:** product family, region, machine group, channel, campaign.
**Sorting/search/bulk:** rank by revenue/growth/margin/ROI where governed; aggregate search; no bulk.
**Permission:** `executive.overview.read`, advertising aggregates separately.
**Related:** Orders, Products, Pricing, Advertising.
**Future:** elasticity, scenario comparison.

### 4.3 Operations and Fleet

**Purpose:** expose availability and service-capacity risk.
**Data:** uptime, online/degraded/offline, utilization, failed dispenses, incident aging, task SLA, repeat failures and lost-sales estimate definition.
**Actions:** drill to aggregate region/group/machine summary, open map, export.
**Filters:** region, model, group, severity, period.
**Sorting/search/bulk:** rank by downtime/risk/impact; machine/location search within scope; no bulk.
**Permission:** `executive.operations.read`.
**Related:** Machine, Machine Operations, Inventory.
**Future:** maintenance-demand prediction.

### 4.4 Finance and Cash Flow

**Purpose:** explain payment completeness, cash movement and profitability.
**Data:** accepted payments, settlements, refunds, net revenue, reconciliation exceptions, cash inflow/outflow projection, profit and working-capital indicators.
**Actions:** compare actual/target/forecast, inspect reconciliation coverage, export.
**Filters:** legal entity, provider, currency, period.
**Sorting/search/bulk:** rank exceptions/providers/entities; safe reference search only with grant; no bulk.
**Permission:** `executive.finance.read`.
**Related:** Payment, Ledger, Finance, Accounting Adapter.
**Future:** runway and scenarios.

### 4.5 Inventory and Waste

**Purpose:** assess supply continuity and control.
**Data:** expected stock, days/servings remaining, stockout exposure, in-transit, variance, expiry, test/service use and waste.
**Actions:** compare regions/items, open metric definition, export.
**Filters:** item family, location type, region, risk, period.
**Sorting/search/bulk:** rank stockout/expiry/waste risk; aggregate item/location search; no bulk.
**Permission:** `executive.inventory.read`; cost data separate.
**Related:** Inventory, Warehouse, Machine Operations.
**Future:** demand and purchase forecast.

### 4.6 Customer and Growth

**Purpose:** assess acquisition and retention safely.
**Data:** active customers, new/repeat, retention cohorts, Club membership, loyalty activity, channel acquisition and consent eligibility aggregates.
**Actions:** compare cohorts/segments, export suppressed aggregates.
**Filters:** cohort, region, channel, safe segment, period.
**Sorting/search/bulk:** rank segments/channels; aggregate search; no bulk.
**Permission:** `executive.growth.read`.
**Related:** Customer, Consent, Loyalty, Advertising.
**Future:** churn and lifetime-value forecasts with governance.

### 4.7 Risk and Compliance

**Purpose:** prioritize threats to continuity and control.
**Data:** unresolved critical incidents, payment/inventory exceptions, break-glass activity, failed privileged actions, access-review debt, evidence gaps and source-health issues.
**Actions:** open aggregated evidence, acknowledge briefing item personally, export. Acknowledgement does not resolve source risk.
**Filters:** risk family, severity, age, organization.
**Sorting/search/bulk:** severity/impact/age; reference search; no bulk.
**Permission:** `executive.risk.read`; detailed audit separately scoped.
**Related:** Audit, Security, Operations, Finance.
**Future:** governed risk appetite/thresholds.

### 4.8 Machine Network Map

**Purpose:** visualize network performance and expansion/risk geography.
**Data:** aggregated clusters and permitted machine points with availability, utilization, revenue, stockout and incident overlays.
**Actions:** select overlay, compare territory, open executive fleet summary.
**Filters:** metric, model/group, region, period.
**Sorting/search/bulk:** side ranking; location/machine search; no bulk.
**Permission:** `executive.operations.read`; location scope.
**Related:** Fleet, Locations, Sales.
**Future:** candidate sites and cannibalization scenarios.

### 4.9 Business Health

**Purpose:** provide a transparent balanced scorecard.
**Data:** commercial, profitability, liquidity, fleet, inventory, customer and compliance dimensions; each shows formula, weight, threshold, freshness and evidence.
**Actions:** inspect dimension, compare periods, export.
**Filters:** organization/region, period, approved scorecard version.
**Sorting/search/bulk:** risks ranked by contribution; metric search; no bulk.
**Permission:** all required executive family permissions; missing families produce partial status.
**Related:** Metric Governance.
**Future:** Owner-approved targets. The score is never an opaque AI-generated number.

### 4.10 AI Supervisor (future)

**Purpose:** summarize evidence, predict material risks and recommend human review.
**Data:** observations, predictions, risks and recommendations; confidence ranges, evidence, metric versions, model/policy version, limitations, review status and expiry.
**Actions:** inspect evidence, mark reviewed, dismiss/report unsafe output, open an Admin Console draft if separately authorized.
**Filters:** type, risk, horizon, confidence, status, source scope.
**Sorting/search/bulk:** severity/confidence/expiry; evidence/metric search; bulk dismissal prohibited.
**Permission:** future `executive.ai.read/review` plus every source permission.
**Related:** Reporting, Audit; downstream only.
**Future:** no autonomous execution under v1 architecture.

## 5. Map and network design

The map defaults to clusters and region summaries to avoid clutter. Marker status uses shape, icon and label in addition to color. Selecting a cluster opens a ranked side panel. Revenue and utilization overlays state normalization and period. Coordinates and operator locations follow least privilege.

## 6. Predictions, risks and recommendations

Predictions show horizon, confidence interval, baseline and error/quality status. Risk cards show likelihood, impact, time horizon and governed evidence. Recommendations state expected benefit, prerequisites, uncertainty and expiration.

No recommendation is rendered as a one-click operational command. The path is:

```text
recommendation → evidence review → separate Admin Console context
→ typed draft → authorized human submission → owning-domain validation → audit
```

## 7. Freshness and completeness

Every executive response identifies `as_of`, projection watermark, source coverage, missing-source flags, metric version and comparison method. Partial values state excluded sources; stale values show the last valid timestamp. If financial/inventory reconciliation is incomplete, the relevant total is labelled provisional or unavailable according to metric policy.

## 8. Accessibility and responsive behavior

The surface is desktop/tablet-first and briefing-friendly. On mobile, sections become a narrative sequence with the highest risks first. Charts include text summaries and tables. All interactions are keyboard operable and printable/exported reports retain titles, units, definitions, freshness and page context.

## 9. Non-implementation statement

This document adds no Executive Console UI, routes, reports, AI model, prompt, schema, automation, API or business logic.
