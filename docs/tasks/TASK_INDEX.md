# Task Index

Статус: Active
Версия: 0.1
Проект: Soft ICE Platform / «У Тимоши»

## Platform Core

| Task | Title | Sprint | Status | Comment |
|---|---|---|---|---|
| EPIC-050 | Platform Kernel | Platform Core Sprint 1 | Architecture documented | Kernel coordinates Runtime, provides infrastructure services and stays free of business logic |
| EPIC-210 | Event Platform | Platform Core Sprint 1 | Architecture documented | Event Bus, event contracts, naming, versioning, delivery, storage, security and initial event catalog documented |
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

## Data Platform

| Task | Title | Sprint | Status | Comment |
|---|---|---|---|---|
| EPIC-350 | Platform Data Model | Data Platform Sprint 1 | Architecture documented | Logical platform data model direction documented for entities, owners, aggregate boundaries, storage, immutable records, audit, retention and expansion |
| DATA-001 | Logical Platform Data Model | Data Platform Sprint 1 | Documentation completed | Created `docs/data/PLATFORM_DATA_MODEL.md` as the canonical documentation-only logical data model with required entities, identifiers, required/optional fields, ownership, immutability, registries, reconciliation and retention direction |

## Architecture Governance

| Task | Title | Sprint | Status | Comment |
|---|---|---|---|---|
| EPIC-355 | Architecture Consistency Audit | Architecture Governance Sprint 1 | Architecture documented | Full documentation repository consistency audit created for duplicate concepts, ownership drift, references, naming, glossary, chronology and architecture risks |
| ARCH-001 | Documentation Consistency Audit | Architecture Governance Sprint 1 | Documentation completed | Created `docs/architecture/ARCHITECTURE_AUDIT.md` and updated active governance tracking without application code changes |
| ARCH-002 | Architecture Status Dashboard | Architecture Governance Sprint 1 | Documentation completed | Created `docs/architecture/ARCHITECTURE_STATUS.md` as the executive architecture dashboard with version, completion, EPIC rollup, layer status, documentation statistics, risks, priorities, readiness and roadmap |

## Product Engine

| Task | Название | Sprint | Статус | Комментарий |
|---|---|---|---|---|
| PRODUCT-001 | DDD Lite Domain Foundation | Sprint 1.1 | Done | Создан каркас доменной архитектуры |
| PRODUCT-002 | Catalog Domain Foundation | Sprint 1.1 | Review / Commit pending | Создан первый домен каталога |
| PRODUCT-003 | Domain Entity Normalization | Sprint 1.1 | Review / Commit pending | Нормализация сущностей Product, Flavor, Syrup, Topping |
| PRODUCT-004 | Configuration Engine Foundation | Sprint 1.1 | Done | ConfigurationEntity, ConfigurationRepository, ConfigurationService and module exports completed |
| PRODUCT-005 | Recipe Engine Core | Sprint 1.2 | Done | RecipeEntity, RecipeRepository definitions, RecipeService validation and module exports completed |
| PRODUCT-006 | Pricing Engine Core | Sprint 1.2 | Done | PricingEntity, repository-backed MVP pricing rules, PricingService and PricingEngine facade completed |
| PRODUCT-007 | Media Engine Foundation | Sprint 1.2 | Planned | Выбор изображений и fallback |

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

## Machine Platform

| Task | Title | Sprint | Status | Comment |
|---|---|---|---|---|
| EPIC-370 | Machine Platform | Machine Platform Sprint 1 | Architecture documented | Machine equipment execution boundary documented for paid-order dispatch, machine state, inventory, telemetry, maintenance and physical outcomes |
| EPIC-373 | Machine State Model | Machine Platform Sprint 1 | Architecture documented | Machine lifecycle, runtime states, operation states, command states, transitions, recovery, offline behavior, maintenance mode, security and integration boundaries documented |
| EPIC-374 | Machine Events and Telemetry | Machine Platform Sprint 1 | Architecture documented | Event-driven communication between Machine Digital Twin and Platform documented with event model, lifecycle events, order execution events, hardware events, telemetry, reliability, boundaries and security |
| MACHINE-001 | Machine Domain | Machine Platform Sprint 1 | Documentation completed | Created `docs/domain/MACHINE_DOMAIN.md` as the DDD Lite machine model covering machine entity, lifecycle, statuses, location, configuration, capabilities, components, paid dispensing rules, payment-to-dispatch boundary, inventory, telemetry, commands, events, errors, maintenance, operator actions, audit and Order/Payment/Product integrations |
| MACHINE-002 | Machine Passport | Machine Platform Sprint 1 | Documentation completed | Created `docs/machine/MACHINE_PASSPORT.md` as the official equipment passport with verified machine context, explicit Unknown and To be confirmed hardware fields, section-level verification statuses and manufacturer confirmation references |
| MACHINE-003 | Machine Documentation Consistency Review | Machine Platform Sprint 1 | Documentation completed | Created `docs/machine/MACHINE_MODEL_REVIEW.md` for EPIC-372 / MACHINE-003 and fixed concrete Machine data-model identifier and relationship drift without application code changes |
| MACHINE-STATE-001 | Machine State Model | Machine Platform Sprint 1 | Documentation completed | Created `docs/machine/MACHINE_STATE_MODEL.md` for EPIC-373 with lifecycle, runtime status, operation and command state models, transitions, commands, events, errors, recovery flows, offline behavior, maintenance mode, security rules and integration boundaries |
| MACHINE-004 | Machine Events and Telemetry | Machine Platform Sprint 1 | Documentation completed | Created `docs/machine/MACHINE_EVENTS_TELEMETRY.md` for EPIC-374 with machine event model, lifecycle events, order execution events, hardware events, telemetry model, JSON examples, duplicate/delayed/offline/retry behavior, integration boundaries and security requirements |

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
| Loyalty Engine | Planned |
| Machine Engine | Architecture documented; runtime planned |
| CRM Engine | Planned |
| Analytics Engine | Planned |
| AI Engine | Planned |
