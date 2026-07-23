# Soft ICE Platform Typography System v1

Status: Approved  
Version: 1.0  
Date: 2026-07-23  
Classification: DOCUMENTED_ONLY

## Purpose

Typography must make customer journeys warm and operational data fast to scan. The platform uses `Inter`, followed by the operating-system sans-serif stack. Interfaces must remain usable when the preferred font is unavailable. Tabular figures are required for KPIs, prices, inventory, durations and table columns containing numbers.

## Type tokens

| Token | Desktop size/line | Compact size/line | Weight | Use |
|---|---:|---:|---:|---|
| `font.display` | 40/48 | 32/40 | 700 | customer or executive hero only |
| `font.heading.1` | 32/40 | 28/36 | 700 | page title |
| `font.heading.2` | 24/32 | 22/30 | 600 | section |
| `font.heading.3` | 20/28 | 18/26 | 600 | card or panel |
| `font.body.lg` | 18/28 | 18/28 | 400 | emphasized explanation |
| `font.body.md` | 16/24 | 16/24 | 400 | default content |
| `font.body.sm` | 14/20 | 14/20 | 400 | tables and metadata |
| `font.label` | 14/20 | 14/20 | 600 | controls |
| `font.caption` | 12/16 | 12/16 | 400 | secondary metadata |
| `font.metric` | 32/40 | 28/36 | 700 | KPI value |

## Rules

- Use sentence case; all caps is limited to short, established codes.
- Use no more than three weights in one view.
- Do not encode status through weight or size alone.
- Monetary values include currency; operational time includes timezone when relevant.
- Truncation must preserve an accessible full value and must not hide identifiers needed for safe action.
- Body copy supports 200% text resize, reflow and a minimum 1.5 line-height.
- Customer copy uses plain language. Admin and Operator terminology uses approved domain names.
- AI output is labelled `AI recommendation`, `AI forecast` or `AI observation`; it is never styled as an authoritative fact.

