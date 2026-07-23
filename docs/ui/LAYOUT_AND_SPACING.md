# Soft ICE Platform Layout and Spacing v1

Status: Approved  
Version: 1.0  
Date: 2026-07-23  
Classification: DOCUMENTED_ONLY

## Spacing tokens

The base unit is 4 px. Use `space.1` through `space.12`: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 and 96 px. Controls use 8–16 px internal spacing; related fields use 16–24 px; sections use 24–40 px. Arbitrary spacing requires design-system review.

## Grid and breakpoints

| Range | Columns | Margin | Gutter | Primary behavior |
|---|---:|---:|---:|---|
| 320–479 | 4 | 16 | 12 | one-column compact |
| 480–767 | 4 | 20 | 16 | one column, paired small cards allowed |
| 768–1023 | 8 | 24 | 20 | split or two-column |
| 1024–1439 | 12 | 32 | 24 | persistent console navigation |
| 1440+ | 12 | 40 | 24 | bounded, comparison-oriented |

Maximum widths are 640 px for Customer purchase flows, 720 px for forms, 760 px for long-form text and 1600 px for console workspaces. Breakpoints describe available space, not device identity.

## Shape, elevation and layers

Radii: `sm` 8 px, `md` 12 px, `lg` 16 px, `xl` 24 px and `round` 999 px. Shadows: `shadow.1` for cards, `shadow.2` for sticky controls and drawers, `shadow.3` for modals. Borders remain visible without shadows. Elevation communicates overlap, never importance or permission.

Layer order is content, sticky content, navigation, drawer, modal, toast and emergency overlay. A layer must not obscure a critical machine or payment alert without a visible route back.

## Responsive rules

- Reflow before reducing type or touch size.
- Convert tables to record lists when priority columns cannot fit.
- Drawers become full-screen sheets on compact layouts.
- Operator and Customer primary actions may be sticky above safe-area insets.
- Optional modules collapse without empty navigation, broken grids or unexplained gaps.
- Dense desktop controls have a 44 px minimum target; Operator and Customer controls use 48 px.

