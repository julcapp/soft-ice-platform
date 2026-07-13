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
| API-006 | Domain Events Contract | Platform Core Sprint 1 | Documentation completed | Created `docs/architecture/DOMAIN_EVENTS_CONTRACT.md` with canonical domain event naming, shared envelope, Runtime ownership, Payment, Club Account, Order, Machine and Customer event families, Telegram notification triggers, idempotency and audit requirements |
| API-007 | API Contract v1 | Platform Core Sprint 1 | Documentation completed | Created `docs/api/API_CONTRACT_V1.md` with MVP REST API principles, authentication flow, Customer, Club Account, Payment, Order, Machine Dispatch and Telegram endpoint groups, standard error format and idempotency requirements without implementation code |
| SECURITY-001 | Auth Core Contract | Platform Core Sprint 1 | Documentation completed | Created `docs/security/AUTH_CORE_CONTRACT.md` with authentication model, user identity model, Telegram and Mini App auth flows, session/token model, User, Project Admin and Platform Owner roles, permission boundaries, API authorization rules, audit logging requirements and security decisions without implementation code |

## Data Platform

| Task | Title | Sprint | Status | Comment |
|---|---|---|---|---|
| EPIC-350 | Platform Data Model | Data Platform Sprint 1 | Architecture documented | Logical platform data model direction documented for entities, owners, aggregate boundaries, storage, immutable records, audit, retention and expansion |
| DATA-001 | Logical Platform Data Model | Data Platform Sprint 1 | Documentation completed | Created `docs/data/PLATFORM_DATA_MODEL.md` as the canonical documentation-only logical data model with required entities, identifiers, required/optional fields, ownership, immutability, registries, reconciliation and retention direction |
| EPIC-351 | Database Foundation | Data Platform Sprint 1 | Architecture documented | PostgreSQL and Prisma database foundation documented with domain-separated ownership, immutable financial records, auditability, core entities, relationships and future readiness |
| DATA-002 | Database Foundation v1 | Data Platform Sprint 1 | Documentation completed | Created `docs/data/DATABASE_FOUNDATION.md` as documentation-only database strategy for PostgreSQL, Prisma, Customer, Club Account, Bonus Account, Payment Intent, Payment Operation, Order, Machine and Machine Event without migrations, tables, webhooks or production database |

## Architecture Governance

| Task | Title | Sprint | Status | Comment |
|---|---|---|---|---|
| EPIC-355 | Architecture Consistency Audit | Architecture Governance Sprint 1 | Architecture documented | Full documentation repository consistency audit created for duplicate concepts, ownership drift, references, naming, glossary, chronology and architecture risks |
| ARCH-001 | Documentation Consistency Audit | Architecture Governance Sprint 1 | Documentation completed | Created `docs/architecture/ARCHITECTURE_AUDIT.md` and updated active governance tracking without application code changes |
| ARCH-002 | Architecture Status Dashboard | Architecture Governance Sprint 1 | Documentation completed | Created `docs/architecture/ARCHITECTURE_STATUS.md` as the executive architecture dashboard with version, completion, EPIC rollup, layer status, documentation statistics, risks, priorities, readiness and roadmap |

## Release Readiness

| Task | Title | Sprint | Status | Comment |
|---|---|---|---|---|
| EPIC-205 | MVP Backend Architecture | MVP Launch Sprint 1 | Architecture documented | First production backend architecture specified as a modular monolith with module boundaries, PostgreSQL ownership, REST API, event layer, integrations, security, deployment and future scaling path |
| TECH-001 | MVP Backend Architecture Specification | MVP Launch Sprint 1 | Documentation completed | Created `docs/architecture/MVP_BACKEND_ARCHITECTURE.md` with backend goal, modular monolith approach, high-level architecture, Customer, Club Account, Bonus, Payment, Order, Machine and Notification modules, database, API, events, integrations, security, deployment and scaling |
| TECH-002 | Backend Foundation | MVP Launch Sprint 1 | Foundation completed | Created backend modular monolith foundation with Express entrypoint, module boundary folders, PostgreSQL environment configuration, local Docker Compose, Prisma connection/readiness layer, migration documentation and backend foundation architecture note without business logic, payment operations, YooKassa API calls, Telegram integration or machine dispatch |
| EPIC-204 | MVP Implementation Roadmap | MVP Launch Sprint 1 | Roadmap documented | First production implementation roadmap created for one machine, one product, real customer, real payment and real loyalty across infrastructure, customer, payment, machine, Mini App and testing phases |
| PLAN-001 | MVP Implementation Roadmap | MVP Launch Sprint 1 | Documentation completed | Created `docs/releases/MVP_IMPLEMENTATION_ROADMAP.md` with MVP goal, implementation phases, priority table, release criteria and post-MVP backlog |
| EPIC-203 | First Machine Launch Readiness | MVP Launch Sprint 1 | Audit documented | First production launch readiness for one vending machine audited across customer journey, machine, payment, data, missing items, first launch scenario and risks |
| MVP-001 | First Machine Launch Readiness Audit | MVP Launch Sprint 1 | Documentation completed | Created `docs/releases/MVP_LAUNCH_READINESS.md` as a documentation-only audit and recorded that the platform is architecture-ready but not yet production-launch-ready |

## Mini App / UX

| Task | Title | Sprint | Status | Comment |
|---|---|---|---|---|
| EPIC-200 | Mini App Experience | Mini App Sprint 1 | MVP specified | Telegram Mini App implementation readiness reviewed and first practical customer account, loyalty and payment MVP specification documented |
| UX-001 | Mini App Architecture Audit | Mini App Sprint 1 | Documentation completed | Created `docs/product/MINI_APP_AUDIT.md` with current status, existing and missing components, user journey analysis, required screens, API dependencies, authentication readiness, payment readiness, CRM readiness and MVP roadmap |
| UX-002 | Mini App MVP Specification | Mini App Sprint 1 | Documentation completed | Created `docs/product/MINI_APP_MVP_SPEC.md` with Mini App purpose, MVP user journey, Home, Club Account, Payments, Purchases, Bonus Account and Profile screens, authentication, API dependencies, business rules, out-of-scope boundaries, UI/UX principles and future extensions |

## Brand Website / UX

| Task | Title | Sprint | Status | Comment |
|---|---|---|---|---|
| EPIC-201 | Brand Website Landing | Website Sprint 1 | Landing specified | Customer-facing "У Тимоши" landing structure documented for brand introduction, vending concept explanation, Telegram handoff and Club customer conversion |
| UX-003 | Landing Specification | Website Sprint 1 | Documentation completed | Created `docs/product/LANDING_SPEC.md` with landing purpose, audiences, customer journey, Hero, About, How it works, Product, Club, Machine, Telegram, Trust, SEO, design principles, MVP scope, integrations and future extensions |

## Telegram Bot / UX

| Task | Title | Sprint | Status | Comment |
|---|---|---|---|---|
| EPIC-202 | Telegram Bot Experience | Bot Sprint 1 | Flow specified | Customer bot flow documented for entry point, notifications, Mini App launch, customer communication, identity binding and backend-owned business boundaries |
| BOT-001 | Telegram Bot User Flow Specification | Bot Sprint 1 | Documentation completed | Created `docs/product/TELEGRAM_BOT_FLOW.md` with bot purpose, first launch, main menu, registration/profile completion, payments, notifications, errors, security and integration boundaries |

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
| FINANCE-009 | Payment Domain v2 | Finance Platform Sprint 1 | Architecture documented | Provider-independent PaymentIntent, PaymentSession, PaymentOperation, PaymentRegistry and refund architecture documented in `docs/domain/PAYMENT_DOMAIN_V2.md` without payment code, YooKassa calls, webhooks, database migrations or accounting integration |

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
| DOMAIN-005 | Club Account Domain Contract | Customer Platform Sprint 1 | Documentation completed | Created `docs/domain/CLUB_ACCOUNT_CONTRACT.md` with aggregate, immutable transaction, top-up/deposit, minimum balance, discount, bonus, referral, birthday, `PaymentCompleted`, audit and idempotency contracts without implementation code |

## Future Epics

| Epic | Статус |
|---|---|
| Loyalty Engine | Planned |
| Machine Engine | Architecture documented; runtime planned |
| CRM Engine | Planned |
| Analytics Engine | Planned |
| AI Engine | Planned |
