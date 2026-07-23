# Soft ICE Platform Dashboard Design Guide v1

Status: Approved  
Version: 1.0  
Date: 2026-07-23  
Scope: Documentation only

Command Center widgets additionally follow `COMMAND_CENTER_UI_SPEC.md`. Every KPI must declare source domains, refresh/freshness, calculation owner, permission scope and drill-down destination before implementation.

## Purpose

This guide defines dashboard composition for Executive Console, Admin Console and limited Operator App summaries. Customer Mini App does not use an enterprise dashboard pattern.

Dashboards are governed projections, not editable source facts. They must expose scope, metric definition/version where relevant, active filters, period, comparison basis, timezone and freshness.

## Dashboard hierarchy

Use this reading order:

1. page purpose, scope and period;
2. critical alerts or data-quality warnings;
3. primary KPIs;
4. trends and comparisons;
5. drivers and breakdowns;
6. actionable queues or drill-down records.

The first viewport should answer: What is happening? Is it good or bad relative to what? Where should I look next?

## Grid

- Desktop: 12 columns with 24 px gutters.
- Tablet: 8 columns with 20 px gutters.
- Mobile: 4 columns with 16 px gutters.
- Standard widget widths: 3, 4, 6, 8 or 12 desktop columns.
- Widget height follows content; align related comparison cards to a common height.
- Do not create a masonry layout that changes reading order unpredictably.

## Widget contract

Every widget documents:

- stable name and purpose;
- audience and permission;
- metric/query owner;
- scope and filters;
- calculation definition and version;
- unit and formatting;
- current value and comparison;
- visualization;
- freshness and last successful update;
- loading, empty, partial, stale and error states;
- drill-down destination;
- accessibility summary;
- export behavior where authorized.

## KPI cards

A KPI card contains label, value, unit, comparison, direction, comparison period/target and freshness. Optional elements are a sparkline, target marker and drill-down.

Rules:

- never show percent change without its baseline;
- distinguish zero from missing data;
- label estimates and forecasts;
- use semantic color only when the direction has a defined meaning;
- prefer four to six primary KPIs, not a wall of numbers.

## Charts

### Selection

| Question | Preferred visualization |
|---|---|
| How did it change over time? | Line chart |
| Which category is larger? | Bar chart |
| What contributed to the total? | Stacked bar |
| What is the simple share? | Donut, maximum five segments |
| Where are the outliers? | Scatter plot |
| Where is it happening? | Map plus list/table |
| What requires action now? | Ranked table or queue |

### Presentation rules

- Axes start at zero for bars; line axes may use a disclosed non-zero range when needed for variation.
- Units and timezone are explicit.
- Legends follow visual order and remain close to the plot.
- Use direct labels when practical.
- Tooltips are keyboard reachable.
- Do not encode more than six series by color.
- Provide a table or downloadable accessible equivalent according to authorization.
- Annotations identify material incidents, policy changes or missing periods without claiming causality.

## Executive Console dashboard

Principles:

- portfolio health before operational queues;
- outcome metrics before activity metrics;
- current value + target + prior period + forecast where governed;
- business risks and anomalies are evidence-linked;
- summaries use plain language and avoid system jargon.

Recommended composition:

1. scope and period;
2. revenue, gross contribution/profit where governed, transactions, availability and cash-flow health;
3. trend versus target;
4. network/region comparison;
5. machine/location performance drivers;
6. risks, forecasts and recommendations;
7. timestamped data-quality note.

Executive dashboards are primarily read-only. Drill-downs retain filters. Forecasts display confidence or uncertainty and model/as-of information. AI recommendations are visually distinguished from verified facts and require human review.

## Admin Console dashboard

Principles:

- operational state and controllable exceptions first;
- permission-aware widgets and actions;
- denser comparison and queue layouts;
- direct, audited handoff to owning workflows.

Recommended families:

- operations and machine health;
- payments and reconciliation;
- inventory and variance;
- operator tasks and service review;
- commercial/catalog performance;
- customer/support signals;
- advertising administration when authorized;
- audit/access and platform health.

Each actionable widget links to a filtered destination rather than performing complex mutation in place. Critical actions show target, consequence and audit context.

## Operator App summary

The Operator home is a work queue, not an analytics dashboard:

- next assigned task;
- overdue/urgent count;
- machines requiring attention;
- route/location context;
- offline/sync status;
- recently completed tasks.

Avoid financial KPIs, network-wide league tables and commercial performance. Use cards and ranked lists, not dense chart grids.

## Responsive behavior

- Primary KPIs become a horizontally scrollable, snap-aligned group only when all cards remain individually understandable; otherwise stack.
- Charts simplify labels and series but keep data meaning.
- Tables become record lists with preserved sorting/filtering.
- Global period/scope controls move to a filter sheet and active values remain visible.
- Widget reading order follows the documented priority, not desktop coordinates.

## Data and state integrity

- `Fresh`: within the metric's declared service level.
- `Delayed`: update is late but prior data is still shown with warning.
- `Stale`: data must not be interpreted as current.
- `Partial`: one or more sources are missing; affected scope is named.
- `Unavailable`: no reliable result can be shown.

Never silently reuse cached data as current. Never replace missing values with zero. Exported reports preserve scope, filters, metric version, generation time and actor/audit metadata according to platform policy.
