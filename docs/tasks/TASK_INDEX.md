# Task Index

Статус: Active
Версия: 0.1
Проект: Soft ICE Platform / «У Тимоши»

## Product Engine

| Task | Название | Sprint | Статус | Комментарий |
|---|---|---|---|---|
| PRODUCT-001 | DDD Lite Domain Foundation | Sprint 1.1 | Done | Создан каркас доменной архитектуры |
| PRODUCT-002 | Catalog Domain Foundation | Sprint 1.1 | Review / Commit pending | Создан первый домен каталога |
| PRODUCT-003 | Domain Entity Normalization | Sprint 1.1 | Review / Commit pending | Нормализация сущностей Product, Flavor, Syrup, Topping |
| PRODUCT-004 | Product Configurator | Sprint 1.1 | Planned | Конфигурация выбора пользователя |
| PRODUCT-005 | Recipe Engine Foundation | Sprint 1.2 | Planned | Связь конфигурации с приготовлением |
| PRODUCT-006 | Media Engine Foundation | Sprint 1.2 | Planned | Выбор изображений и fallback |
| PRODUCT-007 | Pricing Engine Foundation | Sprint 1.2 | Planned | Базовая цена, скидки, подготовка бонусов |

## Finance Platform

| Task | Название | Sprint | Статус | Комментарий |
|---|---|---|---|---|
| FINANCE-001 | Finance Core Architecture | Finance Platform Sprint 1 | Planned | Общая рамка финансовых доменов |
| FINANCE-002 | Transaction Domain | Financial Core | Draft | Единая модель финансовых операций |
| FINANCE-003 | Ledger Domain | Financial Core | Draft | Неизменяемый финансовый журнал |
| FINANCE-004 | Wallet Domain | Finance Platform Sprint 1 | Architecture documented | Wallet как проекция над Ledger |
| FINANCE-005 | Bonus Engine | Finance Platform Sprint 1 | Architecture documented | Бонусы как немонетарные права на скидку |
| FINANCE-006 | Discount Engine | Finance Platform Sprint 1 | Architecture documented | Discounts as non-monetary price reductions before payment |
| FINANCE-007 | Payment Engine | Finance Platform Sprint 1 | Architecture documented | Payment as financial settlement execution with provider abstraction |
| FINANCE-008 | Accounting Adapter | Finance Platform Sprint 1 | Architecture documented | Ledger-backed export/import boundary for external accounting systems |

## Order Platform

| Task | Title | Sprint | Status | Comment |
|---|---|---|---|---|
| EPIC-230 | Order Platform | Order Platform Sprint 1 | Architecture documented | Order as business aggregate with immutable snapshots and event-driven checkout boundary |
| ORDER-001 | Order Domain | Order Platform Sprint 1 | Architecture documented | Order lifecycle, states, snapshots, payment binding, fulfillment and recovery policy |
| ORDER-002 | Checkout Pipeline | Order Platform Sprint 1 | Architecture documented | Deterministic checkout from product selection to payment confirmation and machine queue handoff |
| ORDER-003 | Order State Machine | Order Platform Sprint 1 | Architecture documented | Canonical Order states, allowed transitions, invalid transitions, events, compensation, idempotency and audit rules |

## Future Epics

| Epic | Статус |
|---|---|
| Event Platform | Architecture documented |
| Customer Engine | Planned |
| Loyalty Engine | Planned |
| Payment Engine | Architecture documented |
| Machine Engine | Planned |
| CRM Engine | Planned |
| Analytics Engine | Planned |
| AI Engine | Planned |
