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

## Правило
Каждое значимое техническое или продуктовое решение должно добавляться в этот журнал с датой, причиной и ожидаемым эффектом.
