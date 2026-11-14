<!-- diagram-design-profile
name: У Тимоши · Soft_ICE
slug: utimoshi
source-url: none
created: 2026-11-15
updated: 2026-11-15
notes: Project-only pilot; reviewed colors from approved project direction, not scraped production CSS.
-->
# Style Guide · У Тимоши / Soft_ICE
## Semantic roles
| Role | Light | Dark |
|---|---|---|
| paper | #FBF8F3 | #211F29 |
| paper-2 | #F3EEE7 | #302D39 |
| ink | #292431 | #FAF7F2 |
| ink-strong | #111111 | #111111 |
| muted | #5A5165 | #C9C1D2 |
| soft | #665E6D | #C3BCD0 |
| rule | rgba(41,36,49,0.16) | rgba(250,247,242,0.16) |
| rule-solid | #BEB4C5 | #60586C |
| accent | #6536A6 | #B994FA |
| accent-tint | rgba(101,54,166,0.10) | rgba(185,148,250,0.12) |
| link | #155E75 | #83C5D4 |
## Typography
| Role | Family | Size | Weight |
|---|---|---|---|
| title | Georgia, serif | 28px | 400 |
| node-name | system-ui, sans-serif | 15px | 650 |
| sublabel | system-ui, sans-serif | 12px | 400 |
| eyebrow | system-ui, sans-serif | 11px | 600 |
| arrow-label | system-ui, sans-serif | 12px | 500 |
| callout | Georgia, serif | 16px | 400 |
## Font source
Font source: system
## Conventions
- Offline-first: no Google Fonts, remote scripts, fonts or images.
- 1280×720 viewBox for slide/docs-wide. SVG inline in a self-contained HTML.
- Editorial style: no shadows, 8px node radius, ~4px placement grid, one violet focal node per diagram.
- Every critical transition is labeled. Explicitly distinguish production fact, prototype and planned integration.
- Include legend and fact/assumption note outside SVG.
- Finance: separate cash flow, advances/liabilities, redemption and physical ingredient consumption; no duplicated revenue.
- Accessibility: SVG role=img, title, desc, descriptive text, scalable layout.
- This project-specific profile is NOT installed as an upstream skill profile and is independent from auto-updates.
