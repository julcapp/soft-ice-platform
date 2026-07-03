# PROJECT_DECISIONS

Статус: Active

Журнал ключевых архитектурных и продуктовых решений проекта Soft ICE Platform.

## ADR-001
Дата: 2026-06-29
Решение: Основной репозиторий переименован в `soft-ice-platform`.
Причина: единое название для всей экосистемы.

## ADR-002
Дата: 2026-06-29
Решение: Конфигурации Nginx хранятся в репозитории.
Причина: воспроизводимость инфраструктуры.

## ADR-003
Дата: 2026-06-29
Решение: Все интерфейсы строятся на единой Design System.
Причина: единый UX на всех платформах.

## ADR-004
Дата: 2026-06-29
Решение: Все экраны проектируются адаптивными.
Причина: поддержка Mini App, Web, CRM, терминалов и будущих устройств без создания отдельных интерфейсов.

## ADR-005
Дата: 2026-06-29
Решение: Используется единая медиатека и модель изображений.
Причина: один источник изображений для всех каналов.

## ADR-006
Дата: 2026-06-29
Решение: Каталог продукции является единым источником данных.
Причина: цены, доступность и изображения не должны храниться в коде интерфейса.

## ADR-007
Дата: 2026-07-01
Решение: Mini App получает DDD Lite структуру доменов в `frontend/miniapp/src/domain/*`, где каждый домен содержит Repository, Service или Engine и `index.js`.
Причина: Product Engine требует стабильных границ для каталога, цен, медиа, рецептов, заказов, лояльности, клиентов, платежей и интеграции с автоматом до подключения JSON, API и PostgreSQL.
Ожидаемый эффект: следующие задачи Sprint 1.1 смогут добавлять источники данных и бизнес-логику без переписывания UI-компонентов и без смешивания доменов.

## ADR-008
Дата: 2026-07-01
Решение: Записи Product Engine Catalog нормализуются через чистые фабрики доменных сущностей перед возвратом из CatalogRepository.
Причина: Каталог должен поддерживать будущие категории продуктов и backend-источники данных без переноса валидации, recipe references или media references в UI.
Ожидаемый эффект: CatalogService остается публичной точкой доступа, а Product, Flavor, Syrup, Topping, RecipeReference и MediaReference задают первую явную границу доменных сущностей для расширения каталога.

## ADR-009
Date: 2026-07-01
Decision: PRODUCT-004 adds the Configuration Engine foundation in `frontend/miniapp/src/domain/configuration/*` with ConfigurationEntity, ConfigurationRepository, ConfigurationService and module exports.
Reason: Product configuration needs an isolated, UI-independent source of truth that validates product, flavor, size, syrup, topping and extras before Pricing, Recipe, Media and Machine engines consume the result.
Expected effect: Future screens and channels can request a normalized ConfigurationEntity without embedding configuration validation in React, and removing `domain/configuration` fully rolls back the feature.

## ADR-010
Date: 2026-07-02
Decision: PRODUCT-005 adds the Recipe Engine core in `frontend/miniapp/src/domain/recipe/*` with RecipeEntity, RecipeRepository, RecipeService and module exports.
Reason: A validated ConfigurationEntity must map to a machine-independent preparation recipe before later Machine Engine integration, without mixing recipe logic into UI, pricing, media or vending commands.
Expected effect: Future order, CRM, analytics and vending flows can consume a normalized RecipeEntity from RecipeService while repository-backed recipe definitions remain replaceable by API or PostgreSQL.

## ADR-011
Date: 2026-07-02
Decision: PRODUCT-006 adds the Pricing Engine core in `frontend/miniapp/src/domain/pricing/*` with PricingEntity, PricingRepository, PricingService and PricingEngine facade.
Reason: Product pricing must be calculated from Product, Configuration and Recipe domain entities without embedding financial rules in UI, Wallet, Payment or Machine code.
Expected effect: Future checkout, wallet and payment flows can consume a normalized PricingEntity while pricing rules remain repository-backed and replaceable by API or PostgreSQL.

## ADR-012
Date: 2026-07-02
Decision: Event Platform is defined as a Platform Core architecture layer for formal domain and integration events across Product, Finance, Machine, CRM, AI, Analytics and Notification modules.
Reason: The platform needs stable event contracts so every meaningful state change can be published without creating direct dependencies between domains.
Expected effect: Future modules can react to order, payment, machine, customer and notification lifecycle changes through versioned event contracts while preserving domain ownership and allowing a future cloud event bus.

## ADR-013
Date: 2026-07-02
Decision: Bonus Engine is defined as a separate non-monetary Finance Platform domain that manages discount rights, where one bonus gives the right to a 1 RUB nominal discount according to platform rules.
Reason: Club Timofey, campaigns, referrals, birthday rewards and future partner programs need bonus lifecycle, expiration, reservation and redemption without treating bonuses as Wallet cash, Ledger money or accounting.
Expected effect: Future checkout and loyalty work can coordinate Bonus, Pricing, Discount, Wallet, Ledger, CRM and Notification through events and contracts while preserving the rule that Ledger never stores bonus balance as money.

## ADR-014
Date: 2026-07-02
Decision: Discount Engine is defined as a non-monetary price-reduction domain that calculates discount effects after gross Pricing Result and before Wallet or Payment flows.
Reason: Coupons, campaigns, membership benefits, trusted customer discounts and bonus redemption need one deterministic stacking and priority policy without treating discounts as money or modifying Ledger.
Expected effect: Future checkout, CRM, Reporting, Promotion Engine, Bonus, Wallet and Payment work can rely on a Discount Result that separates gross amount, discount lines and payable amount while preserving the rule that discounts do not create Wallet balance or Ledger entries.

## ADR-015
Date: 2026-07-02
Decision: Payment Engine is defined as the Finance Platform settlement execution domain for card, SBP, Wallet and mixed payments, with provider integrations isolated behind adapters.
Reason: Checkout needs a provider-neutral payment boundary that executes settlement from an approved payable amount without changing product, pricing, discount, bonus or wallet business logic.
Expected effect: Future YooKassa, SBP, Wallet, refund, cancellation and provider expansion work can use stable Payment events and Ledger-backed financial facts while preserving Ledger as the source of truth.

## ADR-016
Date: 2026-07-02
Decision: Accounting Adapter is defined as the Finance Platform integration boundary that exports and imports Ledger-backed accounting synchronization data through replaceable adapters.
Reason: External accounting systems require vendor-specific formats, acknowledgements, retries and reconciliation without becoming the source of platform financial truth or leaking into Payment, Wallet, Ledger, Pricing, Discount, Bonus, Order or UI code.
Expected effect: Future manual file export, accounting API and ERP integrations can share one platform-owned export/import model while preserving Ledger as the source of truth and keeping synchronization idempotent, auditable and retry-safe.

## ADR-017
Date: 2026-07-02
Decision: Order Platform is defined as the business aggregate layer that owns immutable configuration, pricing and discount snapshots, binds payment references, coordinates fulfillment state and publishes Order business events.
Reason: Checkout needs a stable historical purchase record that does not recalculate prices from mutable catalog data and does not let Payment, Machine, UI or Finance domains become the owner of the whole purchase flow.
Expected effect: Future checkout, customer history, CRM, support, analytics, payment recovery and machine fulfillment work can rely on Order snapshots and events while preserving domain ownership for Configuration, Pricing, Discount, Bonus, Payment, Ledger and Machine Platform.

## ADR-018
Date: 2026-07-02
Decision: Checkout Pipeline is defined as a deterministic orchestration sequence from product selection to confirmed order, payment success and machine queue handoff.
Reason: The first purchase flow must calculate configuration, availability, pricing, discounts and bonus effects before payment, then collect only the accepted payable amount and preserve immutable Order snapshots after confirmation.
Expected effect: Future checkout implementation can coordinate Product, Configuration, Pricing, Discount, Bonus, Order, Payment, Ledger, Event and Machine domains without duplicate orders, duplicate payments, duplicate bonus redemption or duplicate machine preparation.

## ADR-019
Date: 2026-07-03
Decision: The Order State Machine uses the canonical states `Draft`, `Configured`, `Priced`, `Discounted`, `BonusReserved`, `PaymentPending`, `Paid`, `Queued`, `Preparing`, `Dispensing`, `Completed`, `Cancelled`, `RefundPending`, `Refunded` and `Expired`; terminal states are immutable.
Reason: Order lifecycle implementation needs one explicit transition contract so Checkout, Payment, Wallet, Ledger, Bonus, Machine, CRM, Notification and Analytics can react to accepted facts without inventing screen-specific or provider-specific states.
Expected effect: Future Order implementation can reject invalid transitions, publish one domain event per accepted transition, keep unpaid cancellation/expiry separate from paid refund compensation and preserve historical auditability.

## Правило
Каждое значимое техническое или продуктовое решение должно добавляться в этот журнал с датой, причиной и ожидаемым эффектом.
