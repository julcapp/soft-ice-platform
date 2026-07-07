# Task Index

Статус: Active
Версия: 0.1
Проект: Soft ICE Platform / «У Тимоши»

## Platform Core

| Task | Title | Sprint | Status | Comment |
|---|---|---|---|---|
| EPIC-050 | Platform Kernel | Platform Core Sprint 1 | Architecture documented | Kernel coordinates Runtime, provides infrastructure services and stays free of business logic |
| KERNEL-001 | Runtime Registry | Platform Core Sprint 1 | Documentation completed | Runtime manifest model, runtime catalog, dependency rules, registration rules and health states documented |
| KERNEL-002 | Service Registry | Platform Core Sprint 1 | Documentation completed | Platform Services, service manifests, Engine registration and engine catalog documented |
| KERNEL-003 | Platform Bootstrap | Platform Core Sprint 1 | Documentation completed | Startup sequence, runtime registration, engine registration, dependency resolution and readiness rules documented |
| KERNEL-004 | Platform Configuration | Platform Core Sprint 1 | Documentation completed | Configuration categories, loading order, snapshots, feature flags, secrets, reload and health rules documented |
| KERNEL-005 | Platform Lifecycle | Platform Core Sprint 1 | Documentation completed | Platform, Runtime, Engine, service and adapter lifecycle states, health escalation and graceful shutdown documented |
| API-001 | API Overview | Platform Core Sprint 1 | Documentation completed | API contract overview documented for consumers, platform services, authentication, authorization, REST, events, webhooks, idempotency, versioning, errors, security, rate limits, monitoring and future SDK |
| API-002 | Authentication | Platform Core Sprint 1 | Documentation completed | Authentication contract documented for identity model, consumers, human, machine, Telegram Mini App, vending machine and partner authentication, API keys, JWT, refresh tokens, sessions, security, flow and roadmap |
| API-003 | Authorization | Platform Core Sprint 1 | Documentation completed | Authorization contract documented for CustomerID identity boundary, permission, role and scope models, least privilege, role assignment, permission checks, access denied handling, audit, security and roadmap |
| API-004 | REST API | Platform Core Sprint 1 | Documentation completed | REST API contract documented for transport-only route design, request and response shape, pagination, filtering, sorting, errors, versioning, idempotency, rate limits, auth integration, resource groups and roadmap |
| API-005 | Event API | Platform Core Sprint 1 | Documentation completed | Event API contract documented for immutable fact events, event-driven architecture, categories, domain, integration and notification events, envelope, metadata, versioning, ordering, delivery, retry, dead-letter, idempotent consumers, registry, `<Domain>.<Fact>` naming, security and roadmap |

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
| ORDER-004 | Order Events | Order Platform Sprint 1 | Architecture documented | Canonical Order event catalog, payload principles, ordering, idempotency, consumers, producers, replay and audit rules |
| ORDER-005 | Fulfillment | Order Platform Sprint 1 | Architecture documented | Paid-order fulfillment lifecycle, queue management, machine assignment, preparation, dispensing, completion, failure handling, retry, compensation, events, audit and monitoring |
| ORDER-006 | Cancellation | Order Platform Sprint 1 | Architecture documented | Cancellation as a business process with unpaid cancellation, paid refund compensation, machine and financial coordination, events, audit and monitoring |
| ORDER-007 | Refund | Order Platform Sprint 1 | Architecture documented | Refund as a compensating financial process with full and partial refund policy, Ledger, Wallet, provider, event, audit and fraud boundaries |
| ORDER-008 | Machine Dispatch | Order Platform Sprint 1 | Architecture documented | Machine dispatch architecture for paid-order machine selection, queue handling, command delivery, acknowledgement, timeout, retry, recovery, events, audit and monitoring |

## Customer Platform

| Task | Title | Sprint | Status | Comment |
|---|---|---|---|---|
| EPIC-300 | Customer Platform | Customer Platform Sprint 1 | Architecture documented | Customer identity, lifecycle, consent, club, trust, referral, activity, Club Account, Bonus and Payment boundaries documented |
| DOMAIN-001 | Customer Domain | Customer Platform Sprint 1 | Architecture documented | DDD Lite Customer domain documented in `docs/domain/CUSTOMER_DOMAIN.md` |
| DOMAIN-002 | Club Account Domain | Customer Platform Sprint 1 | Architecture documented | DDD Lite Club Account prepaid balance, top-up, spending, refund, consent, authorization and history model documented in `docs/domain/CLUB_ACCOUNT.md` |
| DOMAIN-003 | Bonus Domain | Customer Platform Sprint 1 | Architecture documented | DDD Lite Bonus Account, transaction, expiration, scheduler, referral, birthday, trusted, seasonal and manual adjustment model documented in `docs/domain/BONUS_DOMAIN.md` |
| DOMAIN-004 | Payment Domain | Customer Platform Sprint 1 | Architecture documented | DDD Lite provider-agnostic payment model, YooKassa primary provider, SBP, QR, payment links, saved payment methods, refunds, operations registry and reconciliation documented in `docs/domain/PAYMENT_DOMAIN.md` |

## Future Epics

| Epic | Статус |
|---|---|
| Event Platform | Architecture documented |
| Customer Engine | Architecture documented |
| Loyalty Engine | Planned |
| Payment Engine | Architecture documented |
| Machine Engine | Planned |
| CRM Engine | Planned |
| Analytics Engine | Planned |
| AI Engine | Planned |
