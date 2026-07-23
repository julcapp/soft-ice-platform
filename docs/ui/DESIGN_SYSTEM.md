# Soft ICE Platform Design System v1

Status: Approved  
Version: 1.0  
Date: 2026-07-23  
Scope: Documentation only

## Purpose

This document defines the unified interface language for:

- Admin Console;
- Executive Console;
- Operator App;
- Customer Mini App;
- Customer Portal;
- service and support interfaces.

It is the cross-application UI authority. Existing documents in `docs/design/` remain useful for brand, terminal and earlier Mini App context; where guidance conflicts for the four applications above, this v1 UI system takes precedence.

The system specifies presentation and interaction contracts only. It does not authorize frontend, backend, data-model or business-rule changes.

## Design principles

1. **One platform, distinct jobs.** Shared foundations create recognition; application principles adapt density, navigation and emphasis to the actor's work.
2. **Meaning before decoration.** Hierarchy, labels and state must remain understandable without color or imagery.
3. **Next action is obvious.** Each view presents one primary purpose and a clear next step.
4. **Truth is visible.** Data source, scope, filters, freshness and exceptional states are shown where decisions depend on them.
5. **Safe by default.** Destructive, financial and privileged actions require explicit labels, confirmation proportional to risk and auditable reason where the domain requires it.
6. **Responsive by composition.** Components reflow, condense or change presentation; they are not merely scaled down.
7. **Accessible by default.** Keyboard, screen reader, contrast, focus, motion and touch requirements are component acceptance criteria.
8. **Domain-neutral UI.** Components present data and intent; they do not own pricing, permissions, machine, payment, loyalty or other business rules.

## Shared visual language

The platform uses a warm, trustworthy brand layer over a restrained neutral foundation:

- teal communicates brand identity and primary interaction;
- raspberry is a selective customer-facing accent, not a default console action color;
- cream supports welcoming customer surfaces;
- neutral white and cool-light surfaces support dense operational work;
- semantic green, amber, red and blue communicate state only.

Use Inter where available, with the system sans-serif stack as fallback. Numbers in metrics and tables should use tabular figures when supported. Typography, colors, spacing, radii and elevation must reference semantic design tokens documented in `COLOR_SYSTEM.md` and the Design tokens section below.

## Application principles

### Shared governance

- All future screens use shared semantic tokens and documented component contracts.
- Role interfaces remain separate; a shared visual language does not merge their permissions or navigation.
- UI controls never substitute for backend authorization.
- Optional modules collapse cleanly when disabled.
- Recommendations, forecasts and inferred values remain visually and textually distinct from confirmed facts.

### Executive Console

- Read-mostly, summary-first and decision-oriented.
- Lead with business health, trend, variance, target and confidence/freshness—not raw operational detail.
- Use calm surfaces, generous whitespace and a limited number of high-value KPIs.
- Progressive disclosure moves from portfolio to region, location and machine.
- Comparison context is mandatory for KPIs: prior period, target or forecast.
- Recommendations and forecasts must show evidence, uncertainty and human ownership.
- Administrative mutations do not appear implicitly; any separately authorized handoff is clearly marked as leaving the Executive Console.

### Operator App

- Mobile-first, task-first and usable with one hand in field conditions.
- Home prioritizes assigned tasks, urgent machine states, route/location and sync state.
- Instructions are sequential, concise and checklist-based.
- Primary controls sit within the natural thumb zone; touch targets are at least 48 by 48 pixels.
- Evidence capture, test runs and inventory movements show explicit progress and result.
- Offline, syncing, conflict and stale-data states are persistent and unambiguous.
- Commercial settings, pricing, loyalty, advertising and customer administration are absent.

### Admin Console

- Desktop-first, information-dense and optimized for scanning, comparison and controlled action.
- Persistent side navigation, page header, filters and data workspace form the default shell.
- Tables are the primary high-volume pattern; cards support summaries and object overviews.
- Permission, organization and resource scope must be visible when it affects data or actions.
- Privileged actions display consequence, target, reason requirements and audit expectations.
- Bulk actions are explicit, show selection count and never rely on row position alone.
- Mobile supports oversight and urgent actions, not forced parity with complex desktop workflows.

### Customer Mini App

- Mobile-first, friendly, product-led and focused on completing the purchase with minimal effort.
- Product imagery and plain language carry the experience; internal platform terminology does not.
- One primary CTA per step; checkout keeps product, price and next action visible.
- Registration language is avoided in favor of customer benefit and continuation.
- Errors explain recovery without exposing technical details.
- Customer delight never obscures price, consent, availability, payment or fulfillment state.

### Customer Portal

- Extends the Customer language to account, purchase history, consent, loyalty and support journeys.
- Uses low cognitive load, plain-language status and responsive single-column forms.
- Does not expose internal machine, payment-provider or operator terminology.

### Service and support interfaces

- Prioritize identity verification, issue context, safe recovery and visible audit/correlation.
- Separate customer-reported facts, platform facts and agent notes.
- Hide sensitive fields by default and show only permission-scoped actions.

## Layout grid

| Surface | Columns | Outer margin | Gutter | Content behavior |
|---|---:|---:|---:|---|
| Compact mobile, 320–479 px | 4 | 16 px | 12 px | Single primary column |
| Large mobile, 480–767 px | 4 | 20 px | 16 px | Single column; optional paired compact cards |
| Tablet, 768–1023 px | 8 | 24 px | 20 px | Split list/detail or two-column dashboard |
| Desktop, 1024–1439 px | 12 | 32 px | 24 px | Persistent console navigation |
| Wide, 1440 px and above | 12 | 40 px | 24 px | Bounded content; denser comparison views |

Recommended maximum readable content widths:

- Customer Mini App: 640 px;
- form workflow: 720 px;
- console content: 1600 px;
- long-form text: 760 px.

Use an 8 px layout rhythm with 4 px for fine alignment. Major page sections use 24–40 px separation. Alignment to the grid is more important than filling every column.

## Typography

| Role | Desktop | Mobile | Weight | Typical use |
|---|---:|---:|---:|---|
| Display | 40/48 | 32/40 | 700 | Executive or customer hero only |
| Heading 1 | 32/40 | 28/36 | 700 | Page title |
| Heading 2 | 24/32 | 22/30 | 600 | Section title |
| Heading 3 | 20/28 | 18/26 | 600 | Card or panel title |
| Body large | 18/28 | 18/28 | 400 | Emphasized explanation |
| Body | 16/24 | 16/24 | 400 | Default content |
| Body compact | 14/20 | 14/20 | 400 | Tables and supporting text |
| Label | 14/20 | 14/20 | 600 | Controls and fields |
| Caption | 12/16 | 12/16 | 400 | Metadata and timestamps |
| Metric | 32/40 | 28/36 | 700 | KPI value |

Do not use viewport-width type scaling. Do not use all caps for sentences or long labels. Preserve at least 1.5 line height for body copy.

## Navigation patterns

### Admin Console

Use a persistent left rail on desktop, collapsible to icons only when labels remain available by tooltip and accessible name. The page header contains title, scope, breadcrumbs when depth exceeds one level and contextual actions. Tabs switch peer views within one object; they do not replace global navigation.

### Executive Console

Use a compact persistent rail or top-level section navigation. Default route is the portfolio overview. Global period and scope controls remain visible and apply consistently across widgets. Drill-down preserves the parent context and offers a clear return path.

### Operator App

Use three to five bottom navigation destinations. Task detail is a focused stack with a persistent back path and progress indicator. Deep links must land on the assigned object with task and machine identity visible.

### Customer Mini App

Use bottom navigation only for persistent customer destinations. Purchase configuration uses a linear step flow with visible progress, Back and a sticky primary CTA. Do not mix step navigation with unrelated global actions.

## Interaction and content

- Use sentence case for labels.
- Name actions with verb + object: `Assign task`, `Export report`, `Pay 250 ₽`.
- Avoid vague labels such as `OK`, `Yes` or `Submit` when a consequence can be named.
- Dates and times include timezone when operational interpretation depends on it.
- Empty states explain what the view represents and, where permitted, how to proceed.
- Loading uses skeletons for stable layouts and progress/status text for indeterminate operations longer than two seconds.
- Errors preserve user input where safe and provide a recovery action.
- Disabled controls require a discoverable reason; prefer hiding actions the user can never perform.

## Accessibility baseline

Target WCAG 2.2 AA:

- normal text contrast at least 4.5:1 and large text at least 3:1;
- non-text UI and focus indicators at least 3:1 against adjacent colors;
- visible focus ring on every interactive element;
- full keyboard operation for console workflows;
- accessible name, role and state for controls and icons;
- errors identified in text and associated with the field;
- status never conveyed by color alone;
- zoom and text resizing supported without loss of function;
- reduced-motion preference respected;
- minimum touch target 44 by 44 px, increased to 48 px in Operator and Customer apps;
- charts include a text summary and accessible data alternative.

## Component naming

Use English PascalCase for component concepts and lower camel case for variants and properties:

```text
Button
StatusBadge
MetricCard
DataTable
FormField
AlertBanner
ConfirmationDialog
```

Rules:

- name by role, not appearance: `StatusBadge`, not `GreenPill`;
- specialize only when behavior or semantics differ: `MachineStatusBadge`;
- suffix structural families consistently: `Card`, `Table`, `Dialog`, `Field`, `Chart`;
- variants describe intent: `primary`, `secondary`, `danger`, `compact`;
- states use stable terms: `default`, `hover`, `focus`, `pressed`, `loading`, `disabled`, `error`, `success`;
- business entity IDs and UI component names remain separate.

## Design tokens

Token hierarchy:

1. **Primitive tokens** hold raw palette and scale values.
2. **Semantic tokens** express purpose, such as `color.text.primary`.
3. **Component tokens** express controlled component decisions, such as `button.height.md`.
4. **Application aliases** may tune a semantic role without changing its meaning, such as a cream Customer canvas and neutral Admin canvas.

Canonical token groups:

```text
color.brand.*
color.surface.*
color.text.*
color.border.*
color.action.*
color.status.*
font.family.*
font.size.*
font.weight.*
font.lineHeight.*
space.*
radius.*
shadow.*
size.control.*
layout.*
motion.*
zIndex.*
```

Core non-color tokens:

| Token | Value |
|---|---:|
| `space.1`–`space.12` | 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 px |
| `radius.sm` | 8 px |
| `radius.md` | 12 px |
| `radius.lg` | 16 px |
| `radius.xl` | 24 px |
| `radius.round` | 999 px |
| `size.control.sm` | 36 px |
| `size.control.md` | 44 px |
| `size.control.lg` | 48 px |
| `size.control.xl` | 56 px |
| `motion.fast` | 120 ms |
| `motion.base` | 200 ms |
| `motion.slow` | 320 ms |

Tokens must be platform-neutral, versioned and reviewed before removal. Do not encode business values, media paths or permission logic as design tokens.

## Governance

A component is ready for future implementation only when its purpose, anatomy, variants, states, responsive behavior, accessibility behavior and content guidance are documented. New components should reuse existing tokens and patterns before adding primitives.

Product Owner approval is required for changes to brand identity. Accessibility corrections and semantic clarifications may be proposed without changing product policy.

## Related documents

- `docs/ui/COMPONENT_LIBRARY.md`
- `docs/ui/DASHBOARD_DESIGN_GUIDE.md`
- `docs/ui/COLOR_SYSTEM.md`
- `docs/ui/MOBILE_GUIDELINES.md`
- `docs/ui/ICONOGRAPHY.md`
- `docs/ui/TYPOGRAPHY_SYSTEM.md`
- `docs/ui/LAYOUT_AND_SPACING.md`
- `docs/ui/TABLES_AND_FILTERS.md`
- `docs/ui/FORMS_AND_VALIDATION.md`
- `docs/ui/STATUS_AND_ALERTS.md`
- `docs/ui/ACCESSIBILITY_GUIDE.md`
- `docs/ui/COMMAND_CENTER_UI_SPEC.md`
- `docs/ui/ADMIN_CONSOLE_UI_SPEC.md`
- `docs/ui/EXECUTIVE_CONSOLE.md`
- `docs/design/PHOTO_STANDARD.md`
