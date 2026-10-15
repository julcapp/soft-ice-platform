# Issue #22 — display visual integration acceptance

Scope: `frontend/miniapp/?mode=terminal` only. `frontend/terminal` is reference-only and is not a runtime target.

Fixture: `npm run visual:acceptance` (local deterministic catalog and pricing quote; no production or staging calls).

## Viewport matrix

| Viewport | Orientation | Result | Acceptance |
| --- | --- | --- | --- |
| 1920 × 1080 | landscape | Pass | document 1920 × 1080; no overflow; hero, price, and primary CTA visible |
| 1280 × 720 | landscape | Pass | document 1280 × 720; no overflow; CTA remains 72px |
| 1080 × 1920 | portrait | Pass | document 1080 × 1920; CTA bottom 1323px and visible in the first viewport |
| 768 × 1024 | portrait/tablet | Pass | document width 753 within 768 viewport; two 354px choice columns; navigation targets 72px |

## Required flow evidence

- idle → home renders the catalog-provided hero asset;
- `catalog.currentFlavor.mediaPath` resolves to the existing `public/media/ice/UT-ICE-Hero-001.png`; the local URL returns PNG bytes and production React contains no SKU-to-path commercial mapping;
- home → choice keeps catalog items and prices server-authoritative;
- home exposes `Получить оплаченный заказ`; it opens a bounded informational state and `Назад` returns home without a code, fake order, success, payment mutation, or dispense;
- summary displays the immutable server quote total;
- payment without a session shows the non-scannable placeholder `QR-код появится после создания платёжной сессии`; no fake/pseudo QR or checker/repeating pattern is rendered;
- payment remains a Payment Runtime confirmation boundary and cannot mark payment or dispense success;
- browser console error count is zero;
- `data-testid="display-idle"` and `data-testid="display-screen-*"` identify screenshot states without coupling tests to copy;
- no production, staging, hardware, payment, dispense, or `frontend/terminal` runtime is used.

Screenshots and final results must be recorded only after the local fixture is launched and each viewport is inspected.

## Recorded result

- The exact local flow `idle → home → choice → summary → payment` passed at all four required viewports.
- The separate `home → prepaid bounded state → back` flow passed; the state exposed only `Назад` and did not call payment or machine behavior.
- The idle hero decoded from `/media/ice/UT-ICE-Hero-001.png` at `1254 × 1254` intrinsic pixels in both required screenshot orientations; no broken-image state appeared.
- No positive horizontal overflow was observed at `1920 × 1080`, `1280 × 720`, `1080 × 1920`, or `768 × 1024`.
- Selecting fixture add-ons changed the server quote from 150 RUB to 175 RUB; summary and payment displayed the same immutable quote total.
- Browser console error count: `0`.
- Browser console warning count: `0`.
- Payment remained waiting for server confirmation with a non-scannable payment-session placeholder; no client control marked payment or dispense successful.
