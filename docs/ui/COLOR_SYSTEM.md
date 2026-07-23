# Soft ICE Platform Color System v1

Status: Approved  
Version: 1.0  
Date: 2026-07-23  
Scope: Documentation only

## Required semantic roles

Semantic roles must work in light and dark themes and must always be paired with text plus icon, shape or pattern.

| Role token | Meaning |
|---|---|
| `color.status.normal` | normal operation |
| `color.status.info` | neutral information |
| `color.status.warning` | elevated risk |
| `color.status.critical` | critical impact/action |
| `color.status.success` | successful completion |
| `color.status.offline` | disconnected or heartbeat expired |
| `color.status.maintenance` | planned maintenance |
| `color.intent.operator` | operator action required |
| `color.intent.administrator` | administrator action/approval required |
| `color.data.financial` | governed monetary data |
| `color.data.ai` | AI observation/forecast/recommendation |
| `color.operation.test` | test operation, explicitly not a sale |
| `color.status.shortage` | inventory shortage/refill risk |
| `color.status.paymentIssue` | payment or reconciliation issue |

These roles do not map one-to-one to unique hues. Accessibility, label and icon carry the meaning. `financial`, `AI`, `test`, `operator` and `administrator` are classifications, not severity.

## Purpose

The color system provides a shared brand and semantic palette for all Soft ICE applications. Components consume semantic tokens, not raw hex values.

## Primitive palette

| Token | Value | Role |
|---|---:|---|
| `teal.50` | `#E8F7F5` | light brand tint |
| `teal.100` | `#C7ECE8` | selected background |
| `teal.500` | `#168F87` | brand/action |
| `teal.600` | `#117A73` | primary action |
| `teal.700` | `#0D655F` | hover/emphasis |
| `teal.800` | `#094E4A` | pressed/dark text |
| `raspberry.50` | `#FFF0F4` | warm accent tint |
| `raspberry.500` | `#D93667` | selective customer accent |
| `raspberry.700` | `#A91F49` | accent emphasis |
| `amber.50` | `#FFF7E6` | warning tint |
| `amber.600` | `#9A5B00` | accessible warning foreground |
| `green.50` | `#EAF8F0` | success tint |
| `green.700` | `#167443` | success foreground |
| `red.50` | `#FFF0F0` | critical tint |
| `red.700` | `#B4232A` | critical/action foreground |
| `blue.50` | `#EEF5FF` | information tint |
| `blue.700` | `#245EA8` | information foreground |
| `cream.50` | `#FFFDF9` | customer canvas |
| `cream.100` | `#F8F2E9` | warm surface |
| `neutral.0` | `#FFFFFF` | raised surface |
| `neutral.50` | `#F7F8FA` | console canvas |
| `neutral.100` | `#EEF1F4` | subtle surface |
| `neutral.200` | `#DDE2E7` | border |
| `neutral.500` | `#66717D` | secondary text |
| `neutral.700` | `#37414B` | strong secondary text |
| `neutral.900` | `#182029` | primary text |

## Semantic tokens

| Token | Default value | Use |
|---|---|---|
| `color.surface.canvas` | `neutral.50` | Admin, Executive, Operator canvas |
| `color.surface.canvasCustomer` | `cream.50` | Customer canvas |
| `color.surface.default` | `neutral.0` | card/panel |
| `color.surface.subtle` | `neutral.100` | grouped content |
| `color.surface.brandSubtle` | `teal.50` | selected/brand context |
| `color.text.primary` | `neutral.900` | main text |
| `color.text.secondary` | `neutral.500` | supporting text |
| `color.text.inverse` | `neutral.0` | text on dark surface |
| `color.text.link` | `teal.700` | link |
| `color.border.default` | `neutral.200` | standard boundary |
| `color.border.strong` | `neutral.500` | strong boundary |
| `color.action.primary` | `teal.600` | primary action |
| `color.action.primaryHover` | `teal.700` | hover |
| `color.action.primaryPressed` | `teal.800` | pressed |
| `color.action.accent` | `raspberry.500` | selective customer accent |
| `color.status.info.*` | `blue.50` / `blue.700` | informational |
| `color.status.success.*` | `green.50` / `green.700` | successful/healthy |
| `color.status.warning.*` | `amber.50` / `amber.600` | attention/degraded |
| `color.status.critical.*` | `red.50` / `red.700` | failed/danger |
| `color.focus.ring` | `teal.700` | keyboard focus |
| `color.overlay` | `rgba(24,32,41,0.56)` | modal overlay |

`*` indicates paired background, foreground and border tokens.

## Application expression

- **Executive:** neutral canvas, white widgets, teal for selected scope and interaction; semantic colors only for interpreted state.
- **Admin:** neutral canvas and compact borders; teal primary actions; red only for destructive/critical states.
- **Operator:** neutral canvas with high-contrast cards; semantic machine/task state plus text/icon; teal for the next safe action.
- **Customer:** cream canvas, teal primary action and sparing raspberry/warm accents for delight, loyalty or promotion—not error or payment truth.

## Rules

- Do not use status colors for decoration.
- Do not use raspberry as a danger color.
- Do not rely on red/green distinction alone.
- Text on tinted status backgrounds uses the paired accessible foreground.
- Disabled state reduces prominence but must remain readable; opacity alone is insufficient.
- Product photography must not reduce text contrast; place text on a controlled surface or overlay.
- Charts use a categorical sequence distinct from semantic status colors unless the data itself represents status.

## Chart palette

Recommended ordered categorical colors:

```text
#117A73
#4D6FD1
#A45CC5
#D07A2D
#2F8FB3
#8A6A52
```

Use direct labels and patterns/markers where series must remain distinguishable without color. Reserve green, amber and red for states with those meanings.

## Accessibility and validation

All final foreground/background pairs must be contrast-tested in their actual size and weight. Target WCAG 2.2 AA: 4.5:1 for normal text, 3:1 for large text and 3:1 for meaningful non-text UI. High-contrast and forced-color modes must retain focus, boundaries and state labels.
