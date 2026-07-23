# Soft ICE Platform Mobile Guidelines v1

Status: Approved  
Version: 1.0  
Date: 2026-07-23  
Scope: Documentation only

These rules apply to Operator App, Customer Mini App, Customer Portal, compact Admin oversight and service/support interfaces. Role-specific navigation and permissions remain separate even when components are shared.

## Purpose

These guidelines define compact-screen behavior for Customer Mini App, Operator App and responsive oversight views of Admin and Executive Consoles.

Mobile adaptation preserves task meaning and safety. It does not compress desktop layouts until they fit.

## Mobile foundations

- Design baseline: 320 px minimum viewport width.
- Safe-area insets are respected for fixed headers, bottom navigation and sticky actions.
- Outer margin: 16 px compact, 20 px large mobile.
- Default content is one column.
- Touch targets: minimum 48 by 48 px for Customer and Operator; at least 44 by 44 px elsewhere.
- Adjacent destructive and primary actions require clear separation.
- Body text remains at least 16 px for customer/operator primary workflows.
- Sticky CTA regions do not cover content, validation or system UI.

## Navigation

Bottom navigation contains three to five stable destinations and always includes text labels. A More destination may expose low-frequency sections but must not hide the current critical task.

Focused flows use a top app bar with Back, concise title and optional progress. Back returns to the previous logical state and must not silently discard work.

Deep links show enough context to identify account, task, machine, order or report scope.

## Customer Mini App

- One purchase decision per step.
- Product and current price remain visible near the CTA.
- Use a sticky bottom action for the next purchase step.
- Inputs use appropriate mobile keyboards and autofill where safe.
- Consent is explicit, readable and separate from promotional presentation.
- Payment, processing, success and fulfillment are distinct states.
- Telegram or host-app chrome is treated as part of the available viewport.
- Bottom navigation is hidden when it would distract from payment or a focused checkout step.

## Operator App

- Default screen is assigned work, not global analytics.
- Task cards expose priority, machine/location, due time, state and next action.
- Checklist progress is persistent; completed items remain reviewable.
- Evidence capture supports camera-first input, preview, retake, upload progress and queued/offline status.
- Machine identity is repeated on consequential steps to prevent wrong-target action.
- Offline state remains visible globally. Queued, syncing, synced and conflict states are never conflated.
- Destructive or test actions name the machine and expected consequence.
- Do not expose commercial settings or unrestricted customer data.

## Admin and Executive responsive views

Mobile Admin supports monitoring, acknowledgement and carefully selected urgent actions. Complex configuration, broad bulk edits and dense reconciliation may declare desktop required rather than offer an unsafe reduced workflow.

Executive mobile prioritizes:

1. global period and scope;
2. key business-health metrics;
3. material variance and risks;
4. simplified trends;
5. drill-down lists.

Preserve metric definitions and freshness. Do not hide negative or partial data merely to shorten the page.

## Tables and dense information

At compact widths:

- retain object identity and status;
- show two or three highest-priority facts;
- move secondary facts into disclosure/detail;
- convert row actions to a labelled action menu;
- preserve selection only when the mobile workflow safely supports bulk action;
- keep sort/filter state visible;
- use horizontal scrolling only for comparison grids whose column relationship must remain intact.

## Forms

- Use one column.
- Place labels above controls.
- Keep helper/error text adjacent.
- Use native input affordances where they improve accessibility.
- Avoid long dropdowns; provide searchable selection or a dedicated picker.
- Use sticky Save/Continue only after content remains reachable and errors scroll into view.
- Preserve draft data through recoverable network failure.

## Dialogs and sheets

Short confirmations may use a dialog. Multi-field or explanatory tasks use a full-screen sheet. Bottom sheets are reserved for short choice sets or contextual actions and must support keyboard and screen-reader navigation.

## Connectivity, loading and recovery

- Show skeletons only for expected structure.
- Display operation progress when user action is in flight.
- Differentiate offline, server unavailable, permission denied and stale data.
- Retry never duplicates a consequential action; idempotency is a backend contract and the UI communicates the pending/result state.
- Do not discard captured evidence or form input after connection loss.

## Mobile accessibility

Support portrait and landscape when the host environment allows it, 200% text scaling, reduced motion, screen readers, external keyboards and sufficient contrast in outdoor conditions. Do not require precision gestures, hover or color recognition. Provide alternatives for swipe and drag actions.
