# Admin Console UI/UX Specification v1

Status: Specification
Version: 1.0
Date: 2026-07-23
Scope: Documentation only
Architecture references: ADR-014, ADR-015

## 1. Purpose

This document defines the future Soft ICE Platform Admin Console experience. It is the product-level UI contract for administration, operations, finance, marketing, support, inventory control and audit. It does not define executable routes, APIs, storage, domain rules or authorization middleware.

Admin Console is a permission-scoped orchestration and read-projection surface. It never becomes the source of truth for customers, payments, machines, inventory, products, recipes, loyalty, advertising or audit. Mutations are submitted to the owning module, validated there and recorded in audit.

The complete route hierarchy is in `docs/ui/NAVIGATION_MAP.md`; every screen is specified in `docs/ui/SCREEN_CATALOG.md`; access is defined in `docs/ui/ROLE_PERMISSION_MATRIX.md`.

## 2. Users and surfaces

| Surface | Primary users | Character |
|---|---|---|
| Admin Console | Administrator, Support, Marketing, Accountant, Auditor, Owner | Desktop-first, responsive management surface |
| Operator workspace | Operator; Administrator for oversight | Mobile-first task execution and evidence capture |
| Executive Console | Owner only | Separate, read-only decision surface |

An Owner who needs to perform an administrative action switches to a separately authorized Admin Console context. Executive Console itself exposes no business mutation.

## 3. Experience principles

1. **Decision before detail.** Each landing page shows exceptions, status and next safe actions before dense records.
2. **Source and freshness are visible.** Aggregates show period, time zone, currency/unit, `as of`, completeness and metric-definition version.
3. **No false certainty.** Loading, empty, stale, partial, unavailable, permission-redacted and error states are visually distinct.
4. **Progressive disclosure.** Lists lead to detail pages; technical payloads and histories live in tabs or drawers.
5. **Safe operations.** Destructive, financial, machine and access actions require explicit confirmation, reason and, where policy requires, step-up or dual approval.
6. **Traceability.** Every privileged action exposes its outcome, correlation/reference ID and audit link.
7. **Accessible and responsive.** Keyboard operation, visible focus, screen-reader labels, non-color status cues, reduced motion and 44 px minimum touch targets are required.
8. **Domain language.** Labels use business terms; stable semantic IDs may be copied from detail views but are not primary labels.

## 4. Application shell

### 4.1 Desktop

- Persistent left navigation, collapsible to icons.
- Top bar: organization/scope selector, global date context, global search, notification center, help, user/session menu.
- Breadcrumbs above page title.
- Page header: title, status/freshness, primary action and overflow actions.
- Main content uses responsive cards, tables and split views.
- Optional right contextual drawer preserves list position during quick review.

### 4.2 Tablet and mobile

- Navigation becomes an off-canvas drawer.
- Tables switch to priority columns plus expandable rows or cards.
- Filter panel becomes a full-height sheet with applied-filter count.
- Sticky primary action and safe-area spacing are used where appropriate.
- Operator workspace uses bottom-level task actions and supports camera/signature controls.

### 4.3 Large touch and vending-service layouts

- Minimum 48 px controls, simplified column density and no hover-only affordances.
- Critical machine status remains visible at arm's length.
- Operator checklist can be used in landscape or portrait.

## 5. Shared page patterns

### 5.1 Index/list

Contains summary counters, search, saved views, filters, sortable table/card view, column chooser, pagination/cursor state and selection. Query state is reflected in the URL. Empty state distinguishes “no records exist” from “no matches.”

### 5.2 Detail

Contains identity/status header, critical summary, tabbed related data, activity timeline, related-module links and permission-aware actions. Deep links restore the selected tab.

### 5.3 Create/edit

Uses grouped fields, inline validation, unsaved-change warning, preview/diff and explicit submit. A successful command shows accepted/pending/rejected/conflict, never optimistic success without confirmation.

### 5.4 Review/approval

Shows immutable submitted version, evidence, policy checks, related facts and side-by-side changes. Approve/reject requires permission and reason; self-approval is disallowed where separation-of-duties policy applies.

### 5.5 Reports

Requires explicit period, time zone, scope and dimensions. The result shows metric version, freshness, coverage, comparison basis and suppressed fields. Export is asynchronous, expiring, watermarked where required and audited.

## 6. Global interaction contracts

### Search

Global search returns permission-filtered grouped results for customers, machines, payments, operators, products, campaigns and audit references. Exact semantic ID, phone suffix and provider reference searches are supported only when the role has the corresponding sensitive-search permission. Search never reveals the existence of inaccessible records.

### Filters and saved views

Filters are composable, removable chips. Users may save private views; shared views require administrative permission. Default dates use the user's chosen time zone. Reset returns to the role's safe default.

### Sorting and pagination

All lists have deterministic default ordering and stable tie-breakers. Server-backed lists use opaque cursors. Changing filters or sort resets pagination.

### Bulk actions

Bulk actions operate only on explicitly selected eligible records. The UI shows selected, eligible, skipped and failed counts before submission. V1 excludes generic bulk mutation: only catalogued actions such as assignment, export, acknowledgement or notification state changes are permitted.

### Commands and confirmations

Command dialogs state target, impact, prerequisites and reversibility. High-risk operations require typed confirmation, reason, expected version and/or approval reference. Machine commands show eligibility, safety preconditions, timeout and last contact. UI submission is idempotent and disables duplicate clicks while outcome is pending.

### Notifications and alerts

Toast confirms transient UI results; persistent outcomes enter Notifications and Audit. Severity levels are informational, warning, high and critical, always with text/icon in addition to color. Acknowledgement does not resolve the originating incident.

## 7. Visual and content system

The Admin Console reuses the Soft ICE design tokens and components while favoring a compact professional density:

- brand teal for primary navigation and normal actions;
- accent pink only for prioritized CTA, not status;
- semantic success/warning/error tokens for status with icon and label;
- cream base and white cards, with strong text contrast;
- tabular numerals for financial and telemetry values;
- charts always include labels, accessible summaries and downloadable tabular data;
- product and campaign media come from Media Library and follow the photo standard.

Dates are shown with time zone; money always shows currency; temperatures show unit; inventory shows base and display unit; percentages state denominator in help text.

## 8. Cross-module workflows

### 8.1 Machine incident to resolution

Alert → Machine details → telemetry/errors → create or inspect task → operator execution → evidence/service report → administrator approval/rejection → machine/incident state refresh → audit trail.

The Console does not fabricate completion or call a vendor adapter directly.

### 8.2 Inventory refill and reconciliation

Low-stock signal → machine/warehouse balance → transfer proposal → pick/dispatch/receive → operator refill/count → expected-versus-observed variance → correction request if required → ledger projection refresh.

Original movements remain immutable. FIFO and expiry recommendations are advisory until accepted by Inventory.

### 8.3 Payment support

Customer or payment search → payment/order detail → provider, ledger and settlement projection → permitted refund request or reconciliation case → owning-domain outcome → customer-safe status and audit.

Raw credentials, signatures and full payment payloads never appear.

### 8.4 Campaign lifecycle

Advertiser → campaign draft → target/placement/schedule → Media Library creative version → validation and review → activate/pause through Advertising → clicks/conversions/statistics → report.

Consent-gate aggregates may be shown; customer-level targeting is unavailable without a separately approved purpose and permission.

### 8.5 Operator task lifecycle

Assignment → today's route → arrival → checklist → refill/cleaning/test dispense → before/after photos → digital signature → submit → completion approval/rejection. Checklist version and evidence are immutable after submission.

## 9. State, privacy and failure requirements

- Personally identifiable data is masked by default; reveal requires permission, purpose and audit.
- Sensitive exports require scoped fields, purpose, expiry and download audit.
- Stale projections remain readable only with an explicit banner and timestamp.
- Partial composition identifies missing modules and excludes their values from totals.
- Conflicts show the latest version and offer review/retry, not silent overwrite.
- Offline operator drafts are a future extension; when introduced they must show local/synced/conflict state.
- Permission denial provides a safe explanation and request-access path without exposing hidden data.

## 10. Responsive breakpoints

Follow `RESPONSIVE_UI_STANDARD.md`. As a specification baseline:

| Width | Navigation | Data presentation |
|---|---|---|
| `< 768 px` | Drawer / operator bottom actions | Cards, priority fields, single-column forms |
| `768–1199 px` | Collapsible rail | Reduced tables, two-column summaries |
| `>= 1200 px` | Persistent sidebar | Full tables, multi-column dashboards |
| Large touch | Persistent simplified rail | Large controls, reduced density |

No capability may depend on hover, fixed desktop width or color alone.

## 11. Instrumentation and UX acceptance

Future implementation should measure page load, projection freshness, search success, filter use, command completion, validation failure, task duration, approval time and accessibility errors. Telemetry must not include secrets or unnecessary personal data.

UX acceptance requires:

- every route in `SCREEN_CATALOG.md` implemented or explicitly feature-flagged;
- role/scope and field redaction verified server-side;
- keyboard and screen-reader journeys for critical workflows;
- loading/empty/stale/partial/error/denied states;
- responsive validation for mobile, tablet, desktop and large touch;
- command audit/correlation links;
- metric definitions and freshness on dashboards/reports.

## 12. Future extensions

Approved future design directions include offline operator work, route optimization, GPS arrival, barcode/batch scanning, scheduled reports, configurable dashboard layouts, board packs, anomaly detection, predictive maintenance and AI Supervisor. Each requires its own approved domain/security increment before implementation.

## 13. Non-implementation statement

This specification creates no frontend, backend, Prisma, API, permission, report, AI or business-logic implementation. Screen names and routes are information-architecture identifiers, not evidence that executable endpoints exist.
