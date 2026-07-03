# ENGINEERING_JOURNAL

Status: Active
Project: Soft ICE Platform / Utimoshi

## 2026-07-03 - ORDER-003 Order State Machine Architecture

- Updated `docs/architecture/ORDER_PLATFORM.md` with the canonical Order State Machine states, immutable terminal state rule and allowed transition summary.
- Added `docs/tasks/ORDER-003_ORDER_STATE_MACHINE.md` as the task record and detailed state machine contract.
- Documented allowed, invalid, payment, machine, cancellation, refund, timeout and retry transitions with business reasons and domain events.
- Documented event publication, compensation actions, idempotency, audit requirements and architecture principles.
- Verification: documentation-only change; no application source code or frontend files modified.

## 2026-07-02 - ORDER-002 Checkout Pipeline Architecture

- Expanded `docs/architecture/CHECKOUT.md` into a deterministic checkout pipeline from product selection through configuration validation, availability validation, pricing, discounts, bonus reservation, Order snapshot acceptance, payment initialization, payment confirmation, Order confirmation, event publication and machine queue handoff.
- Added `docs/tasks/ORDER-002_CHECKOUT_PIPELINE.md` as the task record for the checkout pipeline documentation increment.
- Documented that all financial calculations happen before payment, Payment collects only the accepted payable amount and confirmed Order snapshots are immutable.
- Documented failure scenarios, retry scenarios, idempotency boundaries, timeout handling and architecture principles.
- Verification: documentation-only change; no application source code or frontend files modified.

## 2026-07-02 - EPIC-230 Order Platform Architecture

- Added documentation-only Order Platform architecture in `docs/architecture/ORDER_PLATFORM.md`.
- Defined Order as the business aggregate that owns immutable configuration, pricing and discount snapshots.
- Documented lifecycle, states, Order Item, bonus reservation, payment binding, fulfillment, machine interaction, events, audit, idempotency, retry, error handling and security.
- Added Checkout architecture in `docs/architecture/CHECKOUT.md` with customer journey, checkout pipeline, validation order, pricing order, payment order, failure scenarios and recovery scenarios.
- Added EPIC-230 and ORDER-001 task documentation.
- Verification: documentation-only change; no application source code or frontend files modified.

## 2026-07-02 - FINANCE-008 Accounting Adapter Architecture

- Added documentation-only Accounting Adapter architecture in `docs/architecture/ACCOUNTING_ADAPTER.md`.
- Defined Accounting Adapter as the Finance Platform integration boundary that translates Ledger-backed facts for external accounting systems.
- Documented Adapter pattern rationale, supported accounting system categories, Ledger integration, export model, import model, synchronization, events, error handling, retry policy, reconciliation, idempotency, audit and security.
- Documented future ERP and API integration rules while keeping external accounting systems outside platform core.
- Added FINANCE-008 task roadmap in `docs/tasks/FINANCE-008_ACCOUNTING_ADAPTER.md`.
- Verification: documentation-only change; no application source code or build output modified.

## 2026-07-02 - FINANCE-007 Payment Engine Architecture

- Added documentation-only Payment Engine architecture in `docs/architecture/PAYMENT_ENGINE.md`.
- Defined Payment as the Finance Platform domain that executes financial settlement without changing business logic.
- Documented lifecycle, states, payment methods, card, SBP, Wallet and mixed payment flows.
- Documented idempotency, authorization, capture, refund, cancellation, retry policy, provider abstraction, YooKassa integration boundary, future provider support, events and fraud controls.
- Kept Ledger as the source of truth and kept Payment separate from Pricing, Discount, Bonus, Wallet projection, Order business rules, Machine commands and UI.
- Added FINANCE-007 task roadmap in `docs/tasks/FINANCE-007_PAYMENT_ENGINE.md`.
- Verification: documentation-only change; no application source code or build output modified.

## 2026-07-02 - FINANCE-006 Discount Engine Architecture

- Added documentation-only Discount Engine architecture in `docs/architecture/DISCOUNT_ENGINE.md`.
- Defined discounts as non-monetary price reductions calculated after gross pricing and before payment.
- Documented lifecycle, discount types, percentage, fixed, coupon, campaign, membership and trusted customer discounts.
- Documented stacking policy, priority rules, Pricing, Wallet, Bonus, Payment, CRM interactions, events, fraud controls and future Promotion Engine integration.
- Kept Discount separate from Wallet balance, Bonus balance, Ledger mutation, Payment provider logic, CRM screens and Notification templates.
- Added FINANCE-006 task roadmap in `docs/tasks/FINANCE-006_DISCOUNT_ENGINE.md`.
- Verification: documentation-only change; no application source code or build output modified.

## 2026-07-02 - FINANCE-005 Bonus Engine Architecture

- Added documentation-only Bonus Engine architecture in `docs/architecture/BONUS_ENGINE.md`.
- Defined bonus as a non-monetary right to receive a 1 RUB nominal discount according to platform rules.
- Documented lifecycle, states, expiration policy, accrual, redemption, cancellation, reservation, events and fraud controls.
- Kept Bonus separate from Wallet balance, Ledger accounting, Pricing calculation, Discount stacking, CRM screens and Notification templates.
- Added FINANCE-005 task roadmap in `docs/tasks/FINANCE-005_BONUS_ENGINE.md`.
- Verification: documentation-only change; no application source code or build output modified.

## 2026-07-02 - PRODUCT-006 Pricing Engine Core

- Added an isolated Pricing Engine domain implementation under `frontend/miniapp/src/domain/pricing/`.
- Implemented PricingEntity, concrete PricingRepository MVP rules, PricingService calculation and PricingEngine facade.
- PricingEngine is the only pricing engine class; no duplicate legacy alias is kept.
- MVP pricing returns basePrice 130, finalPrice 130, currency RUB, bonusAllowed true, bonusNominalRate 1 and bonusLimit 104 for the vanilla cup flow.
- Kept pricing independent from React, App.jsx, pages, routes, styles, assets, analytics, Wallet, Payment, Machine and customer balance mutations.
- Verification: Catalog -> Configuration -> Recipe -> Pricing smoke import passed; `npm run build` passed through `C:\Program Files\nodejs\npm.cmd` after adding `C:\Program Files\nodejs` to PATH for the shell session.

## 2026-07-02 - PRODUCT-005 Recipe Engine Core

- Added an isolated Recipe Engine domain implementation under `frontend/miniapp/src/domain/recipe/`.
- Implemented RecipeEntity, concrete RecipeRepository definitions, RecipeService compatibility validation and module exports.
- Kept recipe logic independent from React, App.jsx, pages, routes, styles, pricing, media lookup, analytics, browser APIs and vending machine commands.
- RecipeService receives a valid ConfigurationEntity, validates recipe compatibility and returns a machine-independent RecipeEntity with base, syrup and topping ingredients.
- Verification: recipe service smoke import passed; `npm run build` passed after adding `C:\Program Files\nodejs` to PATH for the shell session.

## 2026-07-01 - PRODUCT-004 Configuration Engine Foundation

- Added an isolated Configuration Engine domain under `frontend/miniapp/src/domain/configuration/`.
- Implemented ConfigurationEntity, ConfigurationRepository, ConfigurationService and module exports.
- Kept configuration building independent from React, App.jsx, pages, routes, styles, pricing, recipe execution, media lookup and machine control.
- Added MVP configuration rules for `product_soft_ice_vanilla_cup` with one default flavor, one default cup size, allowed syrups, allowed toppings, recipe reference and media reference.
- Verification: service smoke import passed; `npm run build` passed after adding `C:\Program Files\nodejs` to PATH for the shell session.
