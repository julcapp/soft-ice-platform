# Soft ICE Platform Iconography v1

Status: Approved  
Version: 1.0  
Date: 2026-07-23  
Scope: Documentation only

Required semantic concepts include information, warning, critical, success, offline, maintenance, operator action, administrator action, financial data, AI recommendation, test operation, inventory shortage and payment issue. Each icon is accompanied by a visible label in critical or actionable contexts.

## Purpose

Iconography provides a consistent visual vocabulary across all Soft ICE applications. Icons support recognition; labels and accessible names carry meaning.

## Style

- Simple rounded outline style.
- 2 px optical stroke at the 24 px base size.
- Round caps and joins where the icon family permits.
- Clear silhouette with no decorative internal detail at small sizes.
- Default sizes: 16, 20, 24 and 32 px.
- Use filled variants only for selected navigation or high-salience state when the meaning remains consistent.
- Align optically, not only geometrically.

Do not mix unrelated icon families in one application. Brand illustrations, mascot artwork and product photography are not icons.

## Categories

### Navigation

Home, dashboard, machines, tasks, inventory, orders, customers, payments, reports, campaigns, audit, settings and profile.

### Actions

Add, edit, delete, search, filter, sort, export, download, upload, refresh, assign, approve, reject, retry, open external and more actions.

### Status

Information, success, warning, critical, offline, syncing, locked and pending.

### Domain objects

Machine, location, operator, product, syrup, topping, cup, order, payment, wallet/club account, gift/bonus and receipt.

Domain icons aid scanning but never redefine domain state or ownership.

## Usage rules

- Pair unfamiliar and consequential icons with visible text.
- Icon-only controls are limited to universally familiar actions in constrained space.
- Every interactive icon has an accessible name.
- Decorative icons are hidden from assistive technology.
- Tooltips supplement desktop icon buttons but are not required to discover mobile actions.
- Use the same icon for the same concept across applications.
- Do not use the same icon for materially different concepts.
- Do not place text inside icons.
- Avoid emoji as interface icons because rendering and meaning vary.

## Color and state

Icons inherit the semantic foreground of their context. A status icon uses the corresponding semantic token and remains paired with a text label. Disabled icons remain legible. Multicolor icons are reserved for approved brand or provider marks.

## Direction and localization

Directional navigation icons may mirror in right-to-left locales. Object and status icons do not mirror unless their meaning is inherently directional. Do not embed locale-specific letters, currency or numerals in the base icon.

## Accessibility

- Meaningful non-text contrast is at least 3:1.
- Touch target surrounds the glyph and meets application minimums; the glyph itself need not fill the target.
- Focus appears on the entire control, not only the path.
- Animated icons respect reduced-motion preference.
- Loading animation includes a textual status where duration or outcome matters.

## Naming

Use English lowercase kebab-case for asset concepts:

```text
machine
machine-offline
task-complete
payment-pending
inventory-low
chevron-right
external-link
```

Names describe meaning, not drawing geometry. Avoid `icon-` prefixes inside an icon-only catalog. Variants append a stable suffix such as `-filled` only where both forms are approved.

## Governance

Before adding an icon:

1. confirm no existing icon communicates the concept;
2. define its semantic name and category;
3. validate it at 16, 20, 24 and 32 px;
4. confirm accessible label guidance;
5. check consistency with the approved family;
6. document any selected/filled or directional behavior.
