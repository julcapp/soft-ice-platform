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

## Правило
Каждое значимое техническое или продуктовое решение должно добавляться в этот журнал с датой, причиной и ожидаемым эффектом.
