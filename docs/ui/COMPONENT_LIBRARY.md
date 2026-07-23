# Soft ICE Platform Component Library v1

Status: Approved  
Version: 1.0  
Date: 2026-07-23  
Scope: Documentation only

## Purpose

This catalog defines shared component contracts for Admin Console, Executive Console, Operator App and Customer Mini App. It describes behavior and presentation; it is not a code inventory.

Every future component must document anatomy, variants, states, responsive behavior, accessibility and content. Domain rules and authorization remain outside components.

## Normative component inventory

The following matrix is the minimum v1 catalog. Detailed family guidance below supplements it. For every component, default interaction states are `default`, `hover` where applicable, `focus`, `pressed/selected`, `loading`, `disabled` and `error` where meaningful.

| Component | Purpose and variants | Permission / responsive / accessibility / restriction |
|---|---|---|
| `Button` | Named action; primary, secondary, tertiary, danger | Hide or explain unavailable actions; full-width allowed on compact screens; keyboard and loading state; one primary per group |
| `IconButton` | Compact familiar action; standard, danger | Same authorization as labelled action; 44/48 px target; accessible name and tooltip; never for ambiguous consequences |
| `Link` | Navigation or external resource | Permission-scoped destination; wrapping allowed; meaningful text; not styled as a button for commands |
| `Input` | Short typed value | Redact by policy; full width mobile; visible label/error; not for read-only facts |
| `Select` | Choose from bounded options | Options permission-filtered; sheet on mobile; keyboard/typeahead; do not use for very large search sets |
| `DatePicker` | Date/range with timezone context | Scope may restrict period; native-friendly mobile; typed alternative; never hide timezone |
| `SearchField` | Search defined fields | Sensitive fields permission-gated; expands on compact screens; labelled clear action; not a substitute for filters |
| `Checkbox` | Multi-selection or acknowledgement | Does not authorize action; large target; programmatic checked state; not an immediate setting |
| `Radio` | One option from a small set | Filter unavailable choices safely; stacked mobile; grouped legend; not for more than roughly seven choices |
| `Switch` | Immediate binary setting | Backend permission and confirmation where risky; labelled; announced state; not for multi-step or delayed changes |
| `Badge` | Compact category/count | Redact count if needed; wraps; text meaning; not for urgent action |
| `StatusBadge` | Domain state; semantic variants | Scope-aware; text + icon/shape; named state, never color name |
| `Alert` | Persistent impact/recovery message | Action permission-aware; full-width compact; live announcement by urgency; critical alerts do not auto-dismiss |
| `Toast` | Non-blocking result | No privileged details; stacks safely; announced; never only record of failure/action |
| `Modal` | Consequential focused decision | Re-authorize commands; full-screen compact if needed; focus trap/return; not routine navigation |
| `Drawer` | Filters/supporting detail | Content scoped; full-screen sheet compact; focus managed; not for deep workflows |
| `Tabs` | Peer views in one object/scope | Hide unauthorized tabs without changing URL security; scroll compact; tab semantics; not global navigation |
| `Breadcrumbs` | Hierarchical console path | Omit inaccessible ancestors; collapse middle on compact; nav landmark; not for linear steps |
| `Pagination` | Bounded collection navigation | Preserves scope; compact next/previous; labelled current page; no unbounded page sizes |
| `Card` | Group one subject | Fields/action scoped; stacks; semantic heading; avoid nested cards |
| `StatisticCard` | KPI, comparison and freshness | Metric permission; reflows; accessible value/context; no value without unit/period |
| `ChartCard` | Governed visualization | Data permission; summary-first compact; table alternative; no 3D or unexplained dual axis |
| `MachineCard` | Machine identity, state, stock and task summary | Machine scope; priority facts compact; freshness announced; never issues direct vendor commands |
| `CustomerCard` | Permission-scoped customer/support summary | PII redaction; single column compact; clear identity context; no inferred sensitive traits |
| `OperatorCard` | Operator assignment/workload summary | Operations scope; compact task facts; status text; no commercial controls |
| `InventoryCard` | Stock, variance and refill risk | Inventory permission; material rows stack; observed/expected labels; never edits ledger totals |
| `PaymentCard` | Payment/order/reconciliation summary | Finance/support redaction; stack identifiers; state and recovery accessible; never displays secrets |
| `CampaignCard` | Campaign lifecycle and governed metrics | Advertising permission; compact metric subset; state text; does not infer consent |
| `TaskCard` | Assigned operational work and next action | Assignment/scope enforced; mobile primary; priority text/icon; explicit completion only |
| `Timeline` | Ordered domain history | Redact events; vertical mobile; list semantics; distinguish occurred vs recorded time |
| `AuditLog` | Immutable accountable activity | Audit permission; record list compact; searchable labels/correlation; never editable |
| `DataTable` | Dense governed collections | Column/action scope; `RecordList` compact; semantic headers/sort; not for customer purchase flows |
| `FilterBar` | Query, filter and saved scope | Saved view does not grant access; drawer compact; labelled chips; never silently persists hidden filters |
| `SavedView` | Named query/display preference | Owner/share permissions; selector compact; accessible current state; stores no authorization |
| `CommandPalette` | Fast navigation/allowed commands | Results permission-filtered and rechecked; full-screen compact; combobox semantics; destructive commands still confirm |
| `GlobalSearch` | Cross-entity discovery | Search domains and fields permission-filtered; grouped mobile results; accessible result counts; no secret/raw payload search |
| `PhotoEvidenceViewer` | Evidence, metadata and review | Evidence permission/retention; full-screen compact; alt text/zoom controls; no silent editing of originals |
| `MapMarker` | Geographic object/status reference | Location scope; paired list on compact; accessible name/status; color never sole state |
| `DigitalTwinMachineNode` | Read-model machine snapshot | Field-level scope; card/list fallback; provenance/freshness; never source of truth or command bypass |
| `AIRecommendationCard` | Evidence-linked advisory output | Same evidence permissions; stacks; labelled recommendation/confidence; no autonomous command |

Commercial, destructive, financial, permission and machine actions always require backend authorization; confirmation requirements are described in `FORMS_AND_VALIDATION.md`.

## Foundations

### Button

Variants: `primary`, `secondary`, `tertiary`, `danger`, `icon`. Sizes: `sm`, `md`, `lg`. States: default, hover, focus, pressed, loading, disabled.

- One primary button per action group.
- Danger is reserved for destructive or hard-to-reverse actions.
- Loading preserves width and prevents duplicate activation.
- Icon-only buttons require an accessible name and tooltip on pointer-capable devices.

### Icon

Sizes: 16, 20, 24 and 32 px. Icons support navigation, action, object and status comprehension but do not replace critical text. See `ICONOGRAPHY.md`.

### StatusBadge

Variants: `neutral`, `info`, `success`, `warning`, `critical`. Anatomy: optional icon, text label and optional count.

- Labels state the domain status, not the color.
- Use for compact state; use an alert for required attention.
- Avoid more than one badge per meaning.

### FormField

Anatomy: visible label, optional/required indicator, control, helper text and error text. Variants include text, search, number, currency, date/time, select, multi-select, textarea, checkbox, radio, switch and upload.

- Placeholder is an example, never the only label.
- Validation appears near the field and in a form-level summary for multi-error submissions.
- Switch is only for an immediate binary setting; checkbox is for selection or acknowledgment.

### Tooltip

Provides short supplemental explanation for unfamiliar icons or terms. It is never the only location for required instructions, errors or touch-critical content.

### Divider and Skeleton

Divider separates related groups sparingly. Skeleton mirrors the stable shape of loading content, uses no misleading values and respects reduced motion.

## Actions and feedback

### AlertBanner

Variants: `info`, `success`, `warning`, `critical`. Anatomy: icon, concise title, explanation, optional action and dismiss control.

- Page alerts describe cross-view state.
- Inline alerts describe a local section.
- Critical alerts are not auto-dismissed.
- Color, icon and text jointly communicate severity.

### Toast

Confirms a non-blocking, completed result. It must not contain the only record of a failure or action required. Provide Undo only when the underlying action is safely reversible.

### ConfirmationDialog

Use for consequential actions, not routine navigation. Anatomy: consequence-led title, target summary, impact, optional reason input, primary named action and Cancel.

- Focus enters the dialog and returns to the trigger.
- Destructive confirmation does not use `OK`.
- High-risk actions may require step-up authentication based on backend policy; the dialog does not decide that policy.

### Drawer

Use for supporting detail, filters or a short secondary task that benefits from retaining page context. On compact screens it becomes a full-screen sheet.

### EmptyState

Anatomy: plain-language title, explanation and optional permitted action. Distinguish no data, no results, no access and unavailable source.

## Cards and widgets

### Card

Base variants: `standard`, `interactive`, `selected`, `outlined`. A card groups one subject; nested cards are avoided.

### MetricCard

Anatomy: metric label, value, unit, comparison, trend, period, freshness and optional drill-down. It must never show a trend arrow without the comparison basis.

### SummaryCard

Presents a compact object overview with identity, primary state, key facts and one contextual action. Used for machines, tasks, orders and customer-visible products where appropriate.

### TaskCard

Operator-focused anatomy: priority, task type, machine/location, due time, progress/sync state and next action. Urgency uses text and icon in addition to color.

### ProductCard

Customer-focused anatomy: governed media, product name, short description, price presentation, availability and CTA. The component displays values supplied by product, pricing and media services; it does not calculate or select them.

## Tables

### DataTable

Anatomy: title/summary, search and filters, column headers, rows, selection, pagination, result count and loading/empty/error states.

- Default alignment: text left, numbers right, state centered only when scanability improves.
- Headers remain concise; units belong in headers where consistent.
- Sorting is explicit and indicates direction.
- Row actions use a consistent final column and descriptive menu labels.
- Selection exposes count and scoped bulk actions.
- Sticky headers are preferred for long desktop tables.
- Horizontal scrolling is a last resort on mobile; use priority columns or `RecordList`.

### RecordList

Mobile alternative to a table. Each record preserves identity, status, two or three key facts and the primary action. It must retain the same filter scope and data meaning as the table.

## Forms

### Form

- Group fields by user intent, not database structure.
- Use a single column for most workflows; use two columns only for short, related fields.
- Put Save/Create at the end and optionally in a sticky action bar for long Admin forms.
- Preserve input after recoverable errors.
- Show unsaved-change protection where losing work is plausible.
- Read-only values appear as definition lists, not disabled inputs.

### FilterBar

Contains search, high-value filters, date/period, saved view where supported, Reset and result count. Advanced filters open in a drawer. Active filters remain visible as removable chips.

### FileUpload

Shows allowed type/size, progress, success/failure and retry. Operator evidence capture prioritizes camera input and offline queue state. Upload UI does not define retention or evidence policy.

## Navigation

Shared navigation components:

- `SideNavigation` for Admin and Executive desktop shells;
- `BottomNavigation` for Operator and Customer persistent mobile destinations;
- `Breadcrumbs` for hierarchical console context;
- `Tabs` for peer views of one scope;
- `Stepper` for linear Customer and Operator workflows;
- `Pagination` for server-governed collections.

Navigation labels are nouns for destinations and verbs for actions. Current location is exposed visually and programmatically.

## Charts

Shared chart components:

- `LineChart` for time trends;
- `BarChart` for category comparison;
- `StackedBarChart` for composition over categories or time;
- `DonutChart` only for simple part-to-whole with five or fewer segments;
- `AreaChart` for cumulative volume when overlap is not misleading;
- `ScatterPlot` for relationship/outlier analysis;
- `MapView` for geographic status, paired with a list or table;
- `Sparkline` only as supporting context inside a metric.

Every chart includes title, metric/unit, time range, legend when needed, freshness, hover/focus detail, a plain-language summary and accessible tabular data. Do not use 3D charts, decorative gauges or dual axes without an explicit analytical need.

## Component use by application

| Component family | Executive | Operator | Admin | Customer |
|---|---|---|---|---|
| MetricCard / charts | Primary | Limited operational | Primary | Rare |
| DataTable | Supporting drill-down | Replace with RecordList | Primary | Avoid |
| TaskCard / Stepper | Rare | Primary | Oversight | Purchase steps |
| ProductCard | No | Inventory reference only | Catalog management summary | Primary |
| ConfirmationDialog | Rare handoff | Consequential field action | Privileged action | Payment/cancel only |
| FilterBar | Period/scope | Compact chips | Full | Lightweight |
| AlertBanner | Risks/freshness | Urgency/sync | System/action state | Recovery/status |

## Naming and extension

Names use English PascalCase and semantic purpose. Prefer composition:

```text
MetricCard + Sparkline
FormField + Select
DataTable + StatusBadge
ConfirmationDialog + FormField(reason)
```

Create an application-specific component only when semantics or behavior differ, not to encode a different color. Examples: `OperatorTaskCard`, `CustomerProductCard`, `ExecutiveKpiGroup`.
