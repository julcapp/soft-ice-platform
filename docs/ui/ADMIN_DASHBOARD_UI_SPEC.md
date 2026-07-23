# Soft ICE Admin Dashboard v1

Status: Specification  
Version: 1.0  
Date: 2026-07-23  
Classification: DOCUMENTED_ONLY  
Scope: Platform UI Specification; no runtime implementation

## 1. Purpose

This document defines the main Dashboard of Soft ICE Platform Admin Console: page structure, widget layout, metrics, data contracts, access, interaction, navigation and responsive behavior.

The Dashboard is a permission-composed, exception-oriented read surface. It helps an Owner, Administrator or Regional Manager understand network health, commercial results and urgent work, then continue in the owning screen. It does not own or edit machine, inventory, operator, CRM, advertising, payment, finance or audit facts.

This specification does not create frontend or backend code, API routes, projections, schemas, Prisma models, tests, permissions or business logic. Names of projections and permissions are implementation-facing contracts to be approved in the corresponding implementation increments.

## 2. Governing principles

1. Authoritative facts remain in owning domains; Dashboard reads governed projections.
2. Metrics are calculated server-side by an approved reporting/projection owner, never in UI components.
3. Every widget shows scope, period, time zone, `as of`, freshness and completeness.
4. Missing, inaccessible, partial or stale data is never represented as zero.
5. Widget visibility follows effective backend access: permission, resource scope and field policy.
6. A widget may open a permission-scoped workflow, but does not perform complex or high-risk mutations in place.
7. Every drill-down retains period, scope, filters and comparison context where the target supports them.
8. Money shows currency and metric definition; stock shows unit and threshold basis.
9. Color is never the only status signal.
10. Dashboard preferences change presentation only and cannot broaden access or hide policy-mandatory critical alerts.

## 3. Users and access profiles

### 3.1 Owner

The Owner receives a network-wide, read-oriented administrative overview: operating status, sales, stock, CRM, campaigns, finance and significant risks. Owner access to this Dashboard does not grant administrative mutation rights. Strategic analysis remains in the separate Executive Console.

### 3.2 Administrator

The Administrator receives operational queues and permitted workflow entry points across the assigned organization scope. Actions such as task assignment, alert acknowledgement or campaign review are available only with the corresponding explicit permission and remain audited in the owning workflow.

### 3.3 Regional Manager

Regional Manager is a future region-scoped permission bundle for this UI specification, not a newly implemented security role. It uses the same effective-access formula as other Admin Console roles and is limited to assigned regions, locations, machines and permitted aggregates. Cross-region finance, customer-level PII, access administration and platform settings are denied unless separately granted.

Recommended bundle:

```text
dashboard.read
fleet.read
machine.telemetry.read
inventory.read
operations.tasks.read
operators.read
reports.sales.read
crm.analytics.read
campaigns.read
advertising.analytics.read
audit.events.read_limited
```

Optional region-scoped workflow permissions:

```text
operations.tasks.manage
operations.assignments.manage
inventory.transfers.manage
alerts.acknowledge
reports.sales.export
```

Exact permission keys require a future Auth/Admin implementation increment. Backend enforcement remains mandatory.

## 4. Page shell and global controls

### 4.1 Route and title

UI route:

```text
/admin/dashboard
```

Page header:

- title `Dashboard`;
- current organization/region scope;
- selected period and comparison;
- last successful Dashboard composition time;
- projection state: `Fresh`, `Delayed`, `Stale`, `Partial` or `Unavailable`;
- `Refresh` action;
- `Export dashboard` action when permitted;
- link to metric definitions and data-quality details.

### 4.2 Application shell

Desktop uses the persistent Admin Console sidebar and top bar. The top bar contains scope selector, global search, notification center, help and session menu. Breadcrumb is `Admin Console / Dashboard`.

Mobile and tablet use the standard navigation drawer. Dashboard controls remain available without horizontal page scrolling.

### 4.3 Global filter bar

The sticky filter bar appears below the page header:

| Control | Values and behavior |
|---|---|
| Period | Today, Yesterday, Last 7 days, Last 30 days, Month to date, custom range |
| Comparison | Previous comparable period, previous year when supported, approved target, none |
| Scope | Organization, region, location, machine group, individual machine where meaningful |
| Sales channel | All permitted, Mini App, terminal, web or future approved channels |
| Time zone | User default or permitted reporting time zone |
| Currency | Reporting currency when multi-currency support is approved |
| More filters | Product, campaign, operator team and status filters where supported |

Applied filters are visible as removable chips. `Reset` returns to the safe role default. Filter state is reflected in allow-listed URL parameters and contains no PII or secrets.

Widgets inherit global filters. A widget with a local filter shows a `Local filter` badge and offers `Reset to dashboard context`.

### 4.4 Search

Global search is permission-filtered and groups results by machine, location, operator, customer, order/payment, campaign and audit reference. Dashboard-specific quick search supports:

- machine semantic ID, serial/display name and permitted location;
- operator name or semantic ID;
- campaign name or semantic ID;
- event/correlation reference;
- customer phone suffix only with sensitive-search permission.

Search does not reveal inaccessible record existence. Selecting a result opens its owning detail screen rather than filtering unrelated widgets.

## 5. Desktop information architecture

Dashboard uses the approved 12-column grid with 24 px gutters.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Page header: Dashboard · scope · freshness · Refresh · Export              │
├─────────────────────────────────────────────────────────────────────────────┤
│ Global period / comparison / scope / channel / more filters                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Critical notification panel (12 columns, conditional but policy-mandatory) │
├──────────────────┬──────────────────┬──────────────────┬────────────────────┤
│ Network state    │ Sales            │ Revenue          │ Finance health     │
│ KPI, 3 cols      │ KPI, 3 cols      │ KPI, 3 cols      │ KPI, 3 cols        │
├─────────────────────────────────────┬───────────────────────────────────────┤
│ Sales trend, 8 cols                 │ Machine state, 4 cols                 │
├─────────────────────────────────────┼───────────────────────────────────────┤
│ Ingredient stock, 8 cols            │ Cup stock, 4 cols                     │
├─────────────────────────────────────┼───────────────────────────────────────┤
│ Operator state, 6 cols              │ Recent service, 6 cols                │
├─────────────────────────────────────┼───────────────────────────────────────┤
│ Recent incidents, 6 cols            │ Campaigns, 6 cols                     │
├─────────────────────────────────────┼───────────────────────────────────────┤
│ CRM statistics, 6 cols              │ Financial indicators, 6 cols         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Event log, 12 cols                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

The first viewport prioritizes the alert panel, four KPIs, sales trend and machine state. Lower sections explain drivers and expose actionable queues.

## 6. Shared widget anatomy

Every widget contains:

- stable title and short metric definition;
- current state/value and unit;
- comparison value, baseline and direction where meaningful;
- inherited scope/period plus any local filters;
- `as of` timestamp, freshness target and coverage;
- visualization and accessible textual summary;
- state-specific content for loading, empty, partial, stale, unavailable and denied;
- `Open details` drill-down;
- overflow menu for permitted export, data table and metric definition;
- source-domain and projection-version information in the info popover.

Refresh periods below are product requirements for future projections. They are not evidence that polling, streaming or reporting jobs exist.

## 7. Widget specifications

### W-01. Network state

**Purpose and layout.** Shows total visible machines and distribution across `Operating normally`, `Degraded`, `Offline`, `Maintenance`, `Critical` and `Unknown/stale`. The KPI card shows network availability percentage; the analytical panel uses a status donut with no more than five visible segments and a ranked problem list for overflow states.

**Data contract.**

| Attribute | Requirement |
|---|---|
| Authoritative sources | Machine identity/state, Machine Gateway heartbeat/telemetry, active maintenance and incidents |
| Projection owner | Fleet/operations reporting projection |
| Refresh | Heartbeat-derived state up to 30 seconds; aggregate refresh up to 60 seconds |
| Freshness rule | A machine beyond its declared heartbeat SLA becomes `Unknown/stale`, never healthy |
| Permissions | `dashboard.read` + `fleet.read`; telemetry details require `machine.telemetry.read` |
| Scope | Organization, region, location, machine group, machine |

**Actions.** Filter by state/region, refresh, open map, open filtered machine list, acknowledge an alert if separately permitted.

**Connections.** `/admin/fleet`, `/admin/machines`, machine detail, incident detail and Digital Twin when available.

### W-02. Sales

**Purpose and layout.** Shows paid orders, dispensed servings, average order value, successful-dispense rate and change against the selected comparison. An 8-column line/stacked-column chart displays sales over time and optionally separates channel or region.

**Data contract.**

| Attribute | Requirement |
|---|---|
| Authoritative sources | Accepted Order facts, accepted Payment facts and validated Machine dispense outcomes |
| Projection owner | Sales analytics projection with versioned metric definitions |
| Refresh | Up to 5 minutes; daily reconciliation may revise provisional figures |
| Freshness rule | Paid and dispensed measures expose their separate cut-off times |
| Permissions | `reports.sales.read`; revenue/AOV additionally require financial field permission |
| Scope | Organization, region, location, machine, product, channel |

`Paid orders`, `dispensed servings`, failed dispenses and test operations are separate measures. Test operations are never counted as sales.

**Actions.** Change measure and granularity, compare regions/products/channels, show accessible table, export, open filtered Orders or Sales Report.

**Connections.** Orders, product analytics, machine performance and revenue report.

### W-03. Ingredient inventory

**Purpose and layout.** Shows low-stock ingredient count, affected machines, estimated servings remaining, earliest predicted stockout, expiry risk and unresolved variance. The main view is a ranked table by severity with ingredient, machine/location, on-hand amount, threshold, servings/time remaining and freshness.

**Data contract.**

| Attribute | Requirement |
|---|---|
| Authoritative sources | Inventory ledger/projection, recipes for serving conversion, machine telemetry/counts, transfer/refill/service movements |
| Projection owner | Inventory reporting projection |
| Refresh | Machine stock up to 2 minutes; warehouse/transfer state up to 5 minutes |
| Freshness rule | Prediction is suppressed when recipe, count or telemetry is stale/incomplete |
| Permissions | `inventory.read`; movement detail requires `inventory.movements.read` |
| Scope | Region, warehouse, location, machine, ingredient, batch when available |

Sales, test, cleaning, calibration, service and waste consumption remain distinct in drill-down and reconciliation.

**Actions.** Filter by material/risk, open stock card, create replenishment/transfer proposal if separately permitted, export shortages.

**Connections.** Machine inventory, warehouse balances, transfers, inventory movements, recipes and reconciliation.

### W-04. Cup inventory

**Purpose and layout.** Dedicated card because zero cups blocks every sale regardless of ingredient stock. Shows cups on hand, estimated servings, machines below threshold, machines at zero and the nearest predicted depletion. A compact bar list ranks critical machines.

**Data contract.**

| Attribute | Requirement |
|---|---|
| Authoritative sources | Cup inventory ledger, machine counts/telemetry, sales/test/service/waste movements |
| Projection owner | Inventory reporting projection |
| Refresh | Up to 2 minutes for machines; up to 5 minutes for transfers |
| Freshness rule | Unknown physical count is shown as unknown, not inferred from last sales alone |
| Permissions | `inventory.read`; replenishment requires explicit inventory permission |
| Scope | Region, location, machine, cup type |

**Actions.** Open machines without cups, inspect consumption, create transfer/refill proposal, export filtered list.

**Connections.** Machine inventory tab, warehouse, operator refill tasks and inventory reconciliation.

### W-05. Operator state

**Purpose and layout.** Shows active/on-task/unavailable operators, unassigned tasks, overdue tasks, SLA risk and submitted reports awaiting review. A queue groups `Critical unassigned`, `Overdue`, `Due soon` and `Awaiting approval`.

**Data contract.**

| Attribute | Requirement |
|---|---|
| Authoritative sources | Machine Operations operator status, assignments, tasks and service-report lifecycle |
| Projection owner | Machine Operations reporting projection |
| Refresh | Up to 60 seconds |
| Freshness rule | Last activity is not presented as live location; GPS is absent until separately approved |
| Permissions | `operators.read` + `operations.tasks.read`; manage actions require explicit operations permissions |
| Scope | Organization, region, operator team, operator, task type |

**Actions.** Filter queue, assign/reassign a task if permitted, open operator or task, open submitted report review.

**Connections.** Operators, assignments, task detail, service reports and machine detail.

### W-06. Recent service

**Purpose and layout.** Table of latest completed/submitted/rejected maintenance and refill activities with time, machine, operator, task type, checklist version, evidence state and review outcome.

**Data contract.**

| Attribute | Requirement |
|---|---|
| Authoritative sources | Machine Operations tasks, immutable checklist results, service reports and evidence metadata |
| Projection owner | Machine Operations service-history projection |
| Refresh | Up to 60 seconds |
| Freshness rule | Evidence binaries are not embedded; only permitted metadata and availability state appear |
| Permissions | `service_reports.read`; evidence requires evidence-specific permission |
| Scope | Region, location, machine, operator, task/review state |

**Actions.** Search/filter, open report, approve/reject only in the owning review screen with permission and independence checks, export metadata where permitted.

**Connections.** Service report, checklist version, evidence viewer, operator, machine maintenance history and Audit.

### W-07. Recent incidents

**Purpose and layout.** Severity-ranked table of latest unresolved and recently resolved machine failures, dispense failures, inventory blockers, payment/integration failures and safety alerts. Critical unresolved incidents precede chronological items.

**Data contract.**

| Attribute | Requirement |
|---|---|
| Authoritative sources | Machine incidents/events, normalized gateway failures, payment/reconciliation exceptions, inventory alerts and platform health alerts |
| Projection owner | Alert/incident composition projection; owning domain remains source of resolution |
| Refresh | Critical machine facts up to 30 seconds; other sources up to 2 minutes |
| Freshness rule | Duplicates are grouped by governed incident identity and correlation |
| Permissions | `alerts.read` plus source-specific read permission; inaccessible source detail is redacted |
| Scope | Region, location, machine, source domain, severity, status |

Acknowledgement means an actor has seen the alert. It does not resolve the originating incident.

**Actions.** Acknowledge, assign, create/open maintenance task, inspect correlation chain, filter and export permitted incident metadata.

**Connections.** Incident detail, machine, task, payment exception, integration health and Audit.

### W-08. Advertising campaigns

**Purpose and layout.** Shows active/scheduled/paused/attention-required campaigns, spend or budget when governed, impressions/clicks/conversions, CTR and attributed sales with explicit attribution definition. A campaign table ranks status and delivery risk.

**Data contract.**

| Attribute | Requirement |
|---|---|
| Authoritative sources | Advertising campaign/creative/placement facts, consent-safe delivery aggregates and attributed analytics |
| Projection owner | Advertising analytics projection |
| Refresh | Status up to 5 minutes; performance aggregates up to 15 minutes |
| Freshness rule | Attribution window/model and consent coverage are visible; unavailable delivery runtime is not shown as zero performance |
| Permissions | `campaigns.read` + `advertising.analytics.read`; financial fields require financial campaign permission |
| Scope | Organization, region/placement where applicable, campaign, advertiser, channel |

**Actions.** Filter by state, open campaign, review validation problems, open create/edit/activate workflow only when separately permitted, export aggregate report.

**Connections.** Campaign detail, advertiser, creative/Media Library, placements, segments and advertising report.

### W-09. CRM statistics

**Purpose and layout.** Shows active customers, new customers, repeat-purchase rate, Club/loyalty participation when available, customers at risk and support workload. A funnel or cohort chart is shown only when its metric definition and minimum cohort size are governed.

**Data contract.**

| Attribute | Requirement |
|---|---|
| Authoritative sources | Customer Identity/Profile, accepted Orders, Club Account/Loyalty and consent-safe CRM/segmentation projections |
| Projection owner | CRM analytics projection |
| Refresh | Up to 15 minutes; cohort measures may update daily |
| Freshness rule | Future loyalty/CRM modules display `Not available`, not synthetic values |
| Permissions | `crm.analytics.read`; customer-level list requires separate customer permission |
| Scope | Organization, region derived from governed purchase/location relation, channel, segment |

Dashboard presents aggregates by default. PII, segment criteria and customer-level targeting data are not exposed to Regional Manager unless explicitly permitted.

**Actions.** Select metric/cohort, open permitted segment or customer list, compare periods, export aggregate statistics.

**Connections.** Customers, segments, loyalty analytics, order history and CRM report.

### W-10. Financial indicators

**Purpose and layout.** Shows gross paid revenue, refunds, net paid revenue, unsettled amount, reconciliation exceptions and cash/settlement freshness. Profit, contribution margin, costs or ROI appear only when an approved definition and source exist. A trend plus exception summary occupies six columns.

**Data contract.**

| Attribute | Requirement |
|---|---|
| Authoritative sources | Payment ledger, Ledger, refunds, settlements, reconciliation and approved accounting projections |
| Projection owner | Finance reporting projection |
| Refresh | Operational payment totals up to 5 minutes; settlement/reconciliation up to 15 minutes or source schedule |
| Freshness rule | Provisional, reconciled and settled values are visually distinct |
| Permissions | `reports.finance.read` and field-level finance permission; export requires `reports.finance.export` |
| Scope | Owner: permitted organization; Administrator: explicit finance scope; Regional Manager: regional sales summary only by default |

Provider reports are reconciliation evidence, not the sole financial source of truth. Raw provider payloads and credentials never appear.

**Actions.** Change metric, open reconciliation exceptions, inspect payment/settlement detail, export audited report. No refund or correction occurs inside the widget.

**Connections.** Finance report, payments, refunds, settlements, reconciliation and Ledger/audit views.

### W-11. Event log

**Purpose and layout.** Full-width, paginated journal of recent permitted domain events, administrative actions, integrations and system alerts. Columns: time, severity/category, event name, subject, actor/source, result, correlation ID and freshness/ingestion state.

**Data contract.**

| Attribute | Requirement |
|---|---|
| Authoritative sources | Versioned domain-event registry/projection and privileged-action Audit |
| Projection owner | Event/Audit read projection; neither changes original events |
| Refresh | Up to 30 seconds for critical events; standard feed up to 60 seconds |
| Freshness rule | Ingestion delay and unavailable producers are visible |
| Permissions | `audit.events.read_limited` or `audit.read`; sensitive payload fields remain redacted |
| Scope | Organization, region, resource, domain, event, severity, actor and correlation |

The Dashboard never exposes raw secrets, provider payloads, personal data or unrestricted event payload JSON. Event names, versions and summaries follow the event catalog.

**Actions.** Search event/correlation ID, filter, pause/resume live refresh, copy safe reference, open event/audit detail, export when separately permitted.

**Connections.** Audit, Notifications, source resource detail, incident timeline and data-quality view.

### W-12. Critical notification panel

**Purpose and layout.** Persistent full-width panel above KPI cards when one or more permitted critical/high alerts or data-quality blockers exist. It shows grouped counts and the top three items, impact, age, owner/assignment and next safe action.

**Data contract.**

| Attribute | Requirement |
|---|---|
| Authoritative sources | Same governed alert/incident sources as W-07 plus Dashboard projection-health signals |
| Projection owner | Notification/alert composition projection |
| Refresh | Up to 30 seconds |
| Freshness rule | Panel shows its own composition time; stale critical status remains visible with warning |
| Permissions | Source-specific read; counts include only accessible items |
| Scope | Current Dashboard scope |

**Actions.** Open notification center, acknowledge if permitted, assign if permitted, retry a failed read projection, open source. The panel cannot be dismissed while policy-mandatory unresolved critical items remain; it may collapse to a summary.

**Connections.** Notifications, incidents, data-quality details and owning source screens.

## 8. KPI definitions

The first row contains four cards, selected by effective access:

| KPI | Definition requirement | Default drill-down |
|---|---|---|
| Network availability | Machines in fresh eligible operating states / all in-scope eligible machines | Filtered Fleet |
| Paid sales | Count of accepted paid orders; test operations excluded | Orders/Sales report |
| Net paid revenue | Accepted gross paid amount minus accepted completed refunds for the same governed period definition | Finance report |
| Finance health | Reconciliation exceptions and unsettled amount; not a client-calculated score | Reconciliation |

If financial access is absent, `Net paid revenue` and `Finance health` are replaced by `Critical incidents` and `Overdue operator tasks`. A redacted financial card is not left as an empty placeholder.

## 9. Tables, charts and panel behavior

### 9.1 Tables

- Deterministic server-side sorting and bounded pagination.
- Default sort prioritizes severity/SLA before recency for actionable queues.
- Primary identity and status remain visible.
- Column chooser cannot expose denied fields.
- Mobile switches to `RecordList` with identity, status, essential facts and primary drill-down.
- Row actions use named verbs and re-check authorization.

### 9.2 Charts

- Line charts for trends; bars for comparison; stacked bars for composition; donut only for simple status share.
- Axes, currency/unit, time zone and comparison basis are explicit.
- Tooltips are keyboard accessible.
- Every chart has a textual summary and viewable/exportable table when permitted.
- Missing intervals are gaps, not zeros.
- Incident annotations do not claim causality.

### 9.3 Notification panels

- Critical, warning, informational and data-quality states use label, icon and semantic token.
- Panels show impact and next action, not only a technical error.
- Acknowledgement, assignment and resolution are distinct states.
- Repeated alerts are deduplicated by governed incident identity.

## 10. Navigation and drill-down

All widget drill-downs:

1. pass only allow-listed scope, period, status and dimension filters;
2. open the owning index/detail screen;
3. preserve comparison context when supported;
4. show a `Back to Dashboard` return that restores filters and scroll position;
5. apply permission and field redaction again at the destination;
6. never place PII, secrets or raw provider references in the URL.

When the destination module is not implemented, the widget shows `Capability not available` with approved roadmap language. It must not link to a dead route.

Cross-links:

```text
Network / incident -> Machine -> telemetry -> task -> service report -> audit
Stock risk -> Inventory -> transfer/refill -> operator task -> reconciliation
Sales -> Orders -> payment -> dispense outcome
Campaign -> creative/placement -> aggregate performance
CRM aggregate -> permitted segment/customer list -> orders
Finance exception -> reconciliation -> payment/settlement -> audit
Event -> correlation timeline -> source resource
```

## 11. Export

### 11.1 Widget export

Permitted widgets support CSV/XLSX-compatible tabular export and image/PDF-ready snapshot only through the reporting/export contract. Each artifact includes:

- title and metric-definition version;
- actor and effective scope;
- period, comparison and time zone;
- filters;
- currency/units;
- generated-at and source `as of`;
- completeness/freshness note;
- export ID and expiry where applicable.

### 11.2 Dashboard export

`Export dashboard` creates an asynchronous snapshot of visible, permitted widgets. Hidden or inaccessible values are omitted, not inferred. Critical warnings and partial/stale states remain in the artifact.

Sensitive and financial exports require explicit permission, purpose, audit and expiry. Regional Manager exports remain region-scoped. Export never grants access to underlying rows unavailable in the UI.

## 12. User scenarios

### 12.1 Owner: morning business review

1. Owner opens Dashboard with organization-wide scope and `Yesterday`.
2. Reviews critical notification panel and data completeness.
3. Compares network availability, paid sales, net revenue and finance health with the previous day.
4. Opens an underperforming region from Sales.
5. Reviews stockout risk, campaigns and CRM repeat-purchase trend.
6. Opens Finance Report for reconciled detail or switches to Executive Console for strategic analysis.

Expected result: Owner receives a read-oriented, source-labelled overview and performs no implicit administrative mutation.

### 12.2 Administrator: operational incident response

1. Administrator opens `Today`; a critical machine incident is first.
2. Opens the incident, then machine telemetry and existing tasks.
3. Creates or assigns a maintenance task in the owning workflow when permitted.
4. Returns to Dashboard; Operator state shows assignment and Event log shows an audited action.
5. After submitted service, opens Recent service and reviews evidence.

Expected result: Dashboard coordinates navigation; Machine Operations owns task and report state.

### 12.3 Administrator: stockout prevention

1. Ingredient inventory flags predicted depletion and Cup inventory flags two machines below threshold.
2. Administrator opens filtered inventory detail.
3. Reviews warehouse availability and creates a transfer/refill proposal.
4. Opens generated operator task and monitors completion.
5. Checks expected-versus-observed variance in reconciliation.

Expected result: no stock balance is edited in the Dashboard; all movements remain ledger-backed and auditable.

### 12.4 Regional Manager: regional shift control

1. Regional Manager enters with assigned region fixed in the scope selector.
2. Reviews offline machines, overdue tasks, low cups and current sales.
3. Filters by location and assigns an eligible task if granted.
4. Exports a regional sales/stock report.
5. Attempts to open another region or full financial settlement data and receives a safe denied/out-of-scope state.

Expected result: all counts, rows, searches, exports and drill-downs remain inside effective regional scope.

### 12.5 Regional Manager: campaign review

1. Opens active regional campaign statistics.
2. Reviews consent-safe aggregate delivery and attributed sales.
3. Opens campaign detail.
4. If campaign management is absent, sees read-only status and contacts an authorized Marketing/Administrator user.

Expected result: aggregate insight does not expose customer-level targeting or grant campaign mutation.

## 13. Responsive requirements

### Desktop `>= 1200 px`

- 12-column layout as specified.
- Four KPI cards in one row.
- Sales chart 8 columns; state card 4 columns.
- Paired 6/6 tables and 8/4 inventory row.
- Sticky filters; tables use full permitted columns.

### Tablet `768–1199 px`

- 8-column grid; two KPI cards per row.
- Analytical widgets use full width or 4/4 split when readable.
- Sidebar becomes collapsible rail/drawer.
- Tables use priority columns and expandable details.

### Mobile `< 768 px`

Required order:

1. critical notification panel;
2. network and incident KPIs;
3. stock blockers;
4. operator queues;
5. sales/finance when permitted;
6. campaigns and CRM;
7. event journal.

All widgets stack in one column. Filters open in a full-height sheet, while active period and scope remain visible. Charts reduce labels/series but retain data meaning and table alternative. Tables become record cards. There is no hover-only action or horizontal page scroll.

### Large touch

- Two or three columns according to width.
- Minimum 48 px controls and reduced table density.
- Critical machine and stock status stays visible at arm's length.
- No operation depends on fine pointer precision.

### Accessibility

- WCAG 2.2 AA direction from the platform accessibility guide.
- Logical heading order and landmark regions.
- Complete keyboard navigation, visible focus and skip links.
- Status labels and icons accompany color.
- Live refresh does not unexpectedly move focus or reorder the active row.
- Charts have accessible summaries and data tables.
- Reduced-motion preference is respected.

## 14. Loading, empty, stale and failure states

| State | Required behavior |
|---|---|
| Loading | Structure-preserving skeleton; no fake values |
| Empty | `No activity in this scope/period`; offer filter reset |
| No access | Safe explanation; do not reveal hidden value or record existence |
| Out of scope | Show assigned scope and permitted alternative |
| Partial | Name unavailable source/coverage; exclude it from totals |
| Delayed | Show last successful update and expected refresh |
| Stale | Mark values unsafe as current; retain prior value only with warning |
| Unavailable | Isolate failed widget; keep unaffected Dashboard usable |
| Conflict | Refresh projection/context; never overwrite source facts |
| Export pending/failed | Show job state, retry and audit/reference ID |

Manual refresh requests a new projection read and does not command source systems. Repeated refresh is throttled in the future implementation contract.

## 15. Personalization

V1 permits:

- hide/show non-mandatory permitted widgets;
- reorder widgets within policy zones;
- select default permitted scope/period;
- save private filter views;
- choose table density and visible permitted columns.

Critical notification panel and policy-mandatory operational widgets cannot be hidden. Personalization is presentation metadata only. Shared layouts and administrator-published templates are future.

## 16. Acceptance criteria for future implementation

- Every mandatory widget implements the data/access/action/drill-down contract above.
- Effective permissions and scope are enforced server-side for values, search, rows, exports and drill-down.
- Every KPI has an approved formula owner, definition version, source lineage and freshness SLA.
- Dashboard performs no authoritative business calculation and no source-of-truth mutation.
- Test, service, waste and sales consumption remain distinguishable.
- Financial provisional/reconciled/settled states remain distinguishable.
- Loading, empty, denied, partial, delayed, stale and unavailable states are verified.
- Responsive behavior is verified on mobile, tablet, desktop and large touch.
- Keyboard, screen-reader and reduced-motion journeys are verified.
- Export preserves access, context, freshness and audit metadata.
- No inaccessible module is represented as implemented or as a zero metric.

## 17. Related documents

- `docs/ui/ADMIN_CONSOLE_UI_SPEC.md`
- `docs/ui/DASHBOARD_WIDGETS.md`
- `docs/ui/DASHBOARD_DESIGN_GUIDE.md`
- `docs/ui/ROLE_PERMISSION_MATRIX.md`
- `docs/ui/NAVIGATION_MAP.md`
- `docs/ui/TABLES_AND_FILTERS.md`
- `docs/ui/STATUS_AND_ALERTS.md`
- `docs/ui/ACCESSIBILITY_GUIDE.md`
- `docs/ui/COMMAND_CENTER_UI_SPEC.md`
- `docs/architecture/ADR/ADR-014-admin-console-foundation-v1.md`
- `docs/architecture/ARCHITECTURE_ROADMAP.md`
- `docs/architecture/ARCHITECTURE_STATUS.md`
- `docs/domain/MACHINE_OPERATIONS_PLATFORM.md`
- `docs/domain/ADVERTISING_PLATFORM.md`
- `docs/architecture/EVERYTHING_IS_EVENT.md`

## 18. Non-implementation statement

This is a Platform UI Specification only. It does not change backend, frontend, Prisma, database schema, API, tests, authorization, events, projections or business logic. All named refresh targets, projection owners, permission keys and routes require separately approved implementation work.
