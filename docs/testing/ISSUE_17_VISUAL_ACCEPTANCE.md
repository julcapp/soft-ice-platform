# Issue #17 — deterministic visual acceptance

Date: 2026-09-24
Scope: `frontend/miniapp/?mode=terminal`
Fixture: `npm run visual:acceptance` (local deterministic catalog and pricing quote; no production calls)

## Viewport matrix

| Viewport | Orientation | Result | Document geometry |
| --- | --- | --- | --- |
| 1920 × 1080 | landscape | Pass | 1920 × 1080; no page overflow |
| 1080 × 1920 | portrait | Pass | 1080 × 1920; no page overflow |
| 1280 × 720 | landscape | Pass | 1280 × 720; no page overflow |
| 768 × 1024 | portrait/tablet | Pass | 768 × 1024; no page overflow |

## Flow evidence

- idle screen renders the approved hero asset and Russian call to action;
- home screen displays the machine-specific current flavor and server catalog price;
- paid sprinkle and topping choices recompute the server quote from 150 RUB to 160 RUB and then 175 RUB;
- summary displays the quoted line items and the final 175 RUB total;
- payment screen is cashless and remains in `Payment Runtime` confirmation state; the UI has no control that can mark payment or dispense success;
- browser console error count was zero for the full idle → home → choice → summary → payment path.

This evidence is reproducible and intentionally uses only the local acceptance fixture. It does not assert production readiness and does not exercise the production deployment.

## Final verification

- Prisma validation passed;
- catalog/pricing backend tests passed: 16/16;
- the complete backend suite passed against a fresh isolated local PostgreSQL cluster: 604/604, no skipped tests;
- Admin Console tests passed: 28/28, and its production build passed;
- Mini App/display production build passed;
- `git diff --check` passed and the display UI contains no hardcoded commercial prices.
