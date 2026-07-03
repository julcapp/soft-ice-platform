# ENGINEERING_JOURNAL

Status: Active
Project: Soft ICE Platform / Utimoshi

## 2026-07-03 - Platform Kernel Registries and Lifecycle

- Created `docs/kernel/RUNTIME_REGISTRY.md`, `docs/kernel/SERVICE_REGISTRY.md`, `docs/kernel/PLATFORM_BOOTSTRAP.md`, `docs/kernel/PLATFORM_CONFIGURATION.md` and `docs/kernel/PLATFORM_LIFECYCLE.md` as documentation-only Platform Kernel contract references.
- Documented all known runtimes, runtime manifest fields, runtime registration, service registration, engine registration, dependency rules, bootstrap sequence, configuration loading, health monitoring, lifecycle states and graceful shutdown.
- Kept Kernel responsibilities limited to coordination, registration, configuration shape validation, health observation and lifecycle control while preserving business logic ownership in runtimes and engines.
- Updated `CHANGELOG.md`, `docs/architecture/PROJECT_DECISIONS.md` and `docs/tasks/TASK_INDEX.md` to register the documentation increment.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, UI code, runtime configuration or generated build output modified.

## 2026-07-03 - Platform Kernel Architecture

- Created `docs/kernel/PLATFORM_KERNEL.md` as a documentation-only architecture reference for the Platform Kernel.
- Defined the Kernel as infrastructure coordination only: runtime startup, configuration, registries, event bus, platform services, health monitoring, security primitives, lifecycle coordination and fault tolerance.
- Documented that the Kernel never contains business logic, Runtime owns business logic, Engine owns implementation and configuration is preferred over code changes.
- Updated `CHANGELOG.md`, `docs/architecture/PROJECT_DECISIONS.md` and `docs/tasks/TASK_INDEX.md` to register the documentation increment.
- Verification: documentation-only change; no application source code, frontend code, UI code, runtime config or generated build output modified.

## 2026-07-03 - Runtime Completeness Audit

- Created `docs/releases/RUNTIME_COMPLETENESS_AUDIT.md` as a documentation-only audit of runtime completeness after Architecture Baseline 1.0.
- Evaluated Platform, Catalog, Configuration, Media, Recipe, Pricing, Finance, Ledger, Wallet, Bonus, Discount, Payment, Accounting Adapter, Order, Event, Machine, Notification, Customer/CRM, Analytics and AI runtimes.
- Recorded overall runtime readiness 34/100 and architecture readiness 76/100.
- Updated `CHANGELOG.md` to register the audit report.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, UI code, infrastructure runtime config or generated build output modified.

## 2026-07-03 - Architecture Audit

- Created `docs/releases/ARCHITECTURE_AUDIT.md` as a documentation-only repository and architecture audit after Architecture Baseline 1.0.
- Audited repository structure, folders, runtime packages, architecture layers, business/domain layers, ADR, tasks, releases, naming, cross references, consistency, quality gates and exit criteria.
- Recorded architecture score 82/100 and repository readiness score 64/100.
- Updated `CHANGELOG.md` to register the audit report.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, infrastructure runtime config or generated build output modified.

## 2026-07-03 - Release Governance Documentation

- Created release governance documentation in `docs/releases/RELEASE_TEMPLATE.md`, `docs/releases/RELEASE_POLICY.md`, `docs/releases/VERSIONING.md` and `docs/releases/RELEASE_1_0.md`.
- Defined release structure, freeze process, approval process, GitHub Release policy, documentation requirements, quality gates, architecture versioning, runtime SemVer rules and ADR release rules.
- Recorded Architecture Release 1.0 as an architecture-only release with no runtime artifact, no frontend changes and no UI changes.
- Updated `CHANGELOG.md` and `docs/architecture/PROJECT_DECISIONS.md` to register the release governance increment and ADR-025.
- Verification: documentation-only change; no application source code or frontend files modified.

## 2026-07-03 - ORDER-008 Machine Dispatch Architecture

- Updated `docs/architecture/ORDER_PLATFORM.md` with Machine Dispatch architecture, lifecycle, machine selection, queue handling, delivery protocol, command acknowledgement, timeout handling, retry policy, failure recovery, event publication, monitoring, audit and architecture principles.
- Updated `docs/tasks/ORDER-008_MACHINE_DISPATCH.md` as the detailed machine dispatch task record.
- Updated `docs/tasks/TASK_INDEX.md`, `CHANGELOG.md` and `docs/architecture/PROJECT_DECISIONS.md` to register ORDER-008 and ADR-024.
- Verification: documentation-only change; no application source code or frontend files modified.

## 2026-07-03 - ORDER-007 Refund Architecture

- Updated `docs/architecture/ORDER_PLATFORM.md` with refund architecture, lifecycle, financial coordination, Ledger interaction, Wallet interaction, provider interaction, event publication, audit, fraud prevention and architecture principles.
- Added `docs/tasks/ORDER-007_REFUND.md` as the detailed refund task record.
- Updated `docs/tasks/TASK_INDEX.md`, `CHANGELOG.md` and `docs/architecture/PROJECT_DECISIONS.md` to register ORDER-007 and ADR-023.
- Verification: documentation-only change; no application source code or frontend files modified.

## 2026-07-03 - ORDER-006 Cancellation Architecture

- Updated `docs/architecture/ORDER_PLATFORM.md` with cancellation architecture, lifecycle, business rules, financial impact, machine interaction, compensation strategy, event publication, audit, monitoring and architecture principles.
- Added `docs/tasks/ORDER-006_CANCELLATION.md` as the detailed cancellation task record.
- Updated `docs/tasks/TASK_INDEX.md`, `CHANGELOG.md` and `docs/architecture/PROJECT_DECISIONS.md` to register ORDER-006 and ADR-022.
- Verification: documentation-only change; no application source code or frontend files modified.

## 2026-07-03 - ORDER-005 Fulfillment Architecture

- Updated `docs/architecture/ORDER_PLATFORM.md` with paid-order fulfillment lifecycle, queue management, machine assignment, preparation, dispensing, completion, failure handling, retry, compensation, event publication, audit and monitoring rules.
- Added `docs/tasks/ORDER-005_FULFILLMENT.md` as the detailed fulfillment task record.
- Updated `docs/tasks/TASK_INDEX.md`, `CHANGELOG.md` and `docs/architecture/PROJECT_DECISIONS.md` to register ORDER-005 and ADR-021.
- Verification: documentation-only change; no application source code or frontend files modified.

## 2026-07-03 - ORDER-004 Order Events Architecture

- Updated `docs/architecture/ORDER_PLATFORM.md` with the canonical Order Platform business event catalog and the rule that every accepted Order transition emits exactly one business event.
- Added `docs/tasks/ORDER-004_ORDER_EVENTS.md` with event catalog, payload principles, versioning, ordering, idempotency, consumers, producers, failure handling, replay strategy and audit requirements.
- Updated `docs/tasks/TASK_INDEX.md`, `CHANGELOG.md` and `docs/architecture/PROJECT_DECISIONS.md` to register ORDER-004 and ADR-020.
- Verification: documentation-only change; no application source code or frontend files modified.

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
