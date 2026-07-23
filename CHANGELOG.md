# CHANGELOG

## [Unreleased] - Machine Operations Architecture Checkpoint

### Added

- Architecture roadmap and next-phase plan separating Machine Operations from CRM while retaining CRM/Admin Console as the central management surface.
- Machine Operations Platform domain checkpoint covering Operator App responsibilities and restrictions, administrator permissions, versioned checklists, service-report review, audit and future field-operations expansion.
- Mandatory non-sales inventory-consumption classifications for `TEST_CUP`, `TEST_ICECREAM`, `TEST_TOPPING`, `TEST_FULL_CYCLE`, `CALIBRATION`, `CLEANING` and `WASTE`, all included in total stock reconciliation.
- Advertising Platform foundation with authenticated-customer and verified-phone eligibility, mandatory consent enforcement, separate advertiser/campaign/creative/placement/referral-link/click entities and deferred delivery algorithms.
- Accepted ADRs for Machine Operations separation and the Advertising Platform foundation, plus an updated architecture status snapshot.

### Scope

- Documentation only; application code, Prisma schema and business logic were not changed.

## [Unreleased] - Machine Operations Platform v1

### Added

- Separate `machine_operations` backend domain with Operator permissions, maintenance tasks/checklists, service-report approval, test runs, inventory movements, photo-evidence metadata, and admin-managed operational machine settings.
- Transactional test-run consumption records for cups, ice cream mix, and toppings.
- API v1 routes/contracts, Prisma migration, authorization/domain documentation, and focused tests.

## [Unreleased] - Consent Privacy Core v1

### Added

- Dedicated Consent entity, repository, service and runtime with immutable customer history.
- Constrained legal consent types and source channels, server timestamps, authenticated API, document evidence, idempotency conflict protection, Prisma migration and automated tests.
- Advertising consent classification without advertising execution, profiling, targeting or delivery behavior.

## [Unreleased] - Production Platform Foundation v1

### Added

- Customer Identity Core v1 with canonical Customer entity state, verified E.164 phone as the primary identifier, existing Telegram identity binding, fail-closed SberID and MAX provider boundaries, immutable/idempotent versioned consent decisions, Customer repository/service/runtime layers, authenticated API v1 contracts, Prisma migration, audit integration, automated tests, and architecture/domain/test documentation. Loyalty, promotions and advertising remain out of scope.
- Project baseline checkpoint in `docs/architecture/ARCHITECTURE_STATUS.md`, recording the executable Auth Core, customer portal API foundation, machine runtime/gateway, Huaxin-isolated adapter boundary, deterministic machine simulator, and Mini App backend/frontend state; distinguishing the Payment Core foundation and documented-only Sber/YooKassa/webhook integrations from production-ready runtime capability; and listing Customer Profile Core, Loyalty Engine, Promotion Engine, Analytics Engine, and SberID authentication as future modules.
- Deterministic vending machine simulator v1 in `backend/src/modules/machine_simulator`, implemented only through the vendor-neutral `MachineGateway` interface. It covers the `OFFLINE`, `ONLINE`, `READY`, `BUSY`, `DISPENSING`, `CLEANING` and `ERROR` lifecycle, heartbeat and telemetry generation, cup and ingredient consumption, scripted/seeded dispense outcomes, simulated machine errors, and automated order-to-payment-to-dispense coverage without changing existing business services or adding vendor-specific behavior.
- Central validated backend configuration with profiles, secret abstraction and feature flags.
- Structured tracing logs, liveness/readiness probes, platform metrics primitives, graceful shutdown and production exception normalization.
- Platform foundation tests and deployment environment examples.

Все значимые изменения проекта Soft ICE Platform фиксируются в этом файле.

Формат версий следует Semantic Versioning.

## [v0.3.0-alpha.1] — In progress

### Added

- MVP vertical slice 004 Machine Integration and Dispense Flow in the backend modular monolith, including a Machine Runtime with `MachineEntity`, `MachineRepository`, `MachineService`, `MachineRuntime` and DTOs; Prisma `MachineStatus` and `DispenseRequestState` enums; `Machine` identity fields and `DispenseRequest` persistence with Machine 1:N and Order 1:1 relations; protected `POST /api/v1/machines/register`, `GET /api/v1/machines/:id` and `GET /api/v1/orders/:id/dispense` endpoints; paid-order dispense request creation from `OrderPaid`; in-process domain events for `MachineDispenseRequested`, `DispenseStarted`, `DispenseCompleted` and `DispenseFailed`; and tests for paid dispatch, command receipt, completed/failed dispense and unauthorized access while keeping vendor SDKs, Huaxin integration, real telemetry, payment providers and Telegram notifications out of scope.

- MVP vertical slice 003 Order and Purchase Core in the backend modular monolith, including the first Order Runtime with customer-owned order creation, `PAYMENT_PENDING` to `PAID` confirmation flow, MVP order DTOs, Prisma `OrderStatus` core fields and migration, protected `POST /api/v1/orders`, `GET /api/v1/orders/:id` and `GET /api/v1/customer/orders` endpoints, lightweight in-process domain event generation for `OrderCreated`, `OrderPaid` and `OrderCancelled`, and a Club Account integration point for future bonus accrual, deposit usage and loyalty rules while keeping YooKassa, machine dispatch and Telegram notifications out of scope.

- MVP vertical slice 002 Club Account and Loyalty Core in the backend modular monolith, including a completed Club Account status and balance projection model, immutable Club Account transaction ledger records with credit/debit direction, reason, reference entity and timestamps, initial deposit/top-up support through `POST /api/v1/club-account/top-up`, own account/history reads through `GET /api/v1/club-account/me` and `GET /api/v1/club-account/history`, singular route aliases alongside existing plural Club Account routes, backend tests for automatic account creation, balance calculation, ledger credit/debit and unauthorized access, while keeping YooKassa, real payments, machine integration and order fulfillment out of scope.

- MVP vertical slice 001 customer registration flow in the backend modular monolith, including API v1 routes for Telegram Mini App session creation, own customer profile, own Club Account and Mini App bootstrap; Auth Core Telegram init data verification; opaque hashed bearer sessions; Customer Runtime identity resolution through `customer_id`; automatic zero-balance Club Account creation after registration; Prisma persistence and migration for customer identity links, auth sessions, idempotency records and audit events; backend tests and a backend build check while keeping payments, top-ups and machine integration out of scope.

- Compatibility API aliases for MVP Vertical Slice 001: `POST /api/auth/telegram` and `GET /api/customer/me` now route to the same Auth Core, customer session middleware and Customer Runtime contracts as the canonical API v1 endpoints.

- Auth Core Contract in `docs/security/AUTH_CORE_CONTRACT.md`, defining the documentation-only authentication and authorization foundation for actor identity, canonical `customer_id` user identity, Telegram Mini App and Bot authentication flows, Mini App session exchange, session/token model, User, Project Admin and Platform Owner roles, permission boundaries, deny-by-default API authorization rules, audit logging requirements and security decisions while keeping Runtime-owned business validation and creating no backend middleware, routes, storage, JWT signing, secrets, migrations, provider integrations, machine credential code or build output.

- API Contract v1 in `docs/api/API_CONTRACT_V1.md`, defining documentation-only MVP REST API principles, Telegram Mini App authentication flow, Customer, Club Account, Payment, Order, Machine Dispatch and Telegram integration endpoint groups, standard error format and idempotency requirements while preserving Runtime-owned business logic, Payment ledger-backed completion, immutable Club Account transactions, Domain Events contract boundaries and no backend routes, schemas, migrations, provider calls, machine adapter behavior or build output.

- Domain Events Contract in `docs/architecture/DOMAIN_EVENTS_CONTRACT.md`, defining canonical `<Domain>.<Fact>` event naming, shared Event API envelope structure, Runtime-owned domain event ownership, Payment, Club Account, Order, Machine and Customer event families, Telegram notification triggers, idempotency key patterns, replay suppression and audit requirements while keeping the change documentation-only with no event bus code, handlers, schemas, migrations, Telegram bot behavior, payment provider calls, machine commands or build.

- Club Account Domain Contract in `docs/domain/CLUB_ACCOUNT_CONTRACT.md`, defining the implementation-facing aggregate model, immutable transaction rules, top-up/deposit lifecycle, minimum balance policy, discount eligibility boundary, bonus accrual and spending boundary, referral and birthday reward integration, Ledger-backed `PaymentCompleted` top-up consumption, audit and idempotency requirements while keeping the change documentation-only with no runtime code, event handlers, provider calls, database migrations, Bonus implementation, Discount implementation, Order transitions or build.

- Payment Ledger and Settlement Contract in `docs/domain/PAYMENT_LEDGER_CONTRACT.md` after `PAYMENT_DOMAIN_V2_REVIEW`, defining Payment ledger entries and method lines, PaymentRegistry records, YooKassa status/webhook mapping, settlement reconciliation, refund lifecycle, Ledger-backed `PaymentCompleted` semantics for Club Account top-up and idempotency rules while keeping the change documentation-only with no payment runtime, provider calls, webhooks, migrations, Club Account transaction code, Order transitions or build.

- Payment Domain v2 architecture documentation in `docs/domain/PAYMENT_DOMAIN_V2.md` for FINANCE-009 / PAYMENT-DOMAIN-V2, defining provider-independent PaymentIntent, concrete PaymentSession attempts for YooKassa, SBP link, QR payment and Telegram payment, immutable PaymentOperation financial events, internal PaymentRegistry reconciliation/reporting/export direction, refund model, Club Account top-up, product purchase, QR and YooKassa boundary flows, PaymentIntent and PaymentSession state models, explicit non-implementation scope and readiness for multiple machines, products, providers, sales channels and future ERP/accounting integration while keeping the change documentation-only with no API keys, YooKassa calls, SBP production integration, webhooks, database migrations or accounting integration.

- Database Foundation v1 documentation in `docs/data/DATABASE_FOUNDATION.md` for EPIC-351 / DATA-002, defining PostgreSQL as the primary datasource, Prisma as the ORM/migration layer, domain-separated storage ownership, immutable financial records, auditability requirements, core Customer, Club Account, Bonus Account, Payment Intent, Payment Operation, Order, Machine and Machine Event entities, relationships, explicit non-implementation scope and readiness for multiple machines, products, payment providers and sales channels while keeping the change documentation-only with no migrations, tables, payment processing, webhooks or production database.

- Backend foundation for the MVP modular monolith, including `backend/src/main.js`, module boundary folders for Customer, Club Account, Bonus, Payment, Order and Machine, PostgreSQL environment configuration, local PostgreSQL Docker Compose, Prisma database connection/readiness layer, migration structure documentation and `docs/architecture/BACKEND_FOUNDATION.md`, while removing active payment test endpoints from the runtime and keeping YooKassa, Telegram, payment operations, order checkout and machine dispatch out of scope.

- MVP Backend Architecture specification in `docs/architecture/MVP_BACKEND_ARCHITECTURE.md` for EPIC-205 / TECH-001, defining the first production backend as a modular monolith with clear Customer, Club Account, Bonus, Payment, Order, Machine and Notification module boundaries, PostgreSQL ownership and audit rules, REST API, internal event/outbox direction, Telegram, YooKassa/SBP and machine integrations, MVP deployment shape, first-machine launch constraints, future scaling path and DECISION-040 while keeping the change documentation-only and avoiding unnecessary technology expansion.

- MVP Implementation Roadmap in `docs/releases/MVP_IMPLEMENTATION_ROADMAP.md` for EPIC-204 / PLAN-001, converting current launch readiness, product, domain, data and architecture documentation into a first-production implementation roadmap with one-machine/one-product MVP goal, infrastructure, customer, payment, machine, Mini App and testing phases, priority table, release criteria and post-MVP backlog while keeping the change documentation-only.

- First Machine Launch Readiness Audit in `docs/releases/MVP_LAUNCH_READINESS.md` for EPIC-203 / MVP-001, defining current platform status, customer journey readiness, machine readiness, payment readiness, data readiness, missing must-have and postponable launch items, first one-machine/one-product/one-payment-flow launch scenario and technical, operational and business risks while confirming the current platform is architecture-ready but not yet production-launch-ready for a real vending machine.

- Telegram Bot user flow specification in `docs/product/TELEGRAM_BOT_FLOW.md` for EPIC-202 / BOT-001, defining the bot as entry point, notification channel, Mini App launcher and customer communication layer, with first launch flow, main menu, registration/profile completion, payment scenarios, notifications, error scenarios, security rules and Bot/Mini App/Backend integration boundaries while keeping the change documentation-only.

- Landing specification in `docs/product/LANDING_SPEC.md` for EPIC-201 / UX-003, defining the customer-facing "У Тимоши" brand website structure, target audiences, visitor-to-Club customer journey, Hero, About, How it works, Product, Club, Machine, Telegram and Trust sections, SEO requirements, design principles, MVP scope, integration points and future extensions while keeping the change documentation-only and preserving existing platform boundaries.

- Mini App MVP specification in `docs/product/MINI_APP_MVP_SPEC.md` for EPIC-200 / UX-002, defining the first practical Telegram Mini App MVP as customer self-service interface, personal account, loyalty interface and payment entry point, with MVP journey, Home, Club Account, Payments, Purchases, Bonus Account and Profile screens, Telegram WebApp authentication, API dependencies, business rules, out-of-scope boundaries, UI/UX principles and future extensions while keeping the change documentation-only.

- Mini App architecture audit in `docs/product/MINI_APP_AUDIT.md` for EPIC-200 / UX-001, reviewing current Telegram Mini App status, existing and missing components, user journey, required screens, API dependencies, Telegram WebApp authentication readiness, payment integration readiness, CRM integration readiness and MVP roadmap while preserving existing architecture decisions and keeping the change documentation-only.

- Machine Events and Telemetry documentation in `docs/machine/MACHINE_EVENTS_TELEMETRY.md` for EPIC-374 / MACHINE-004, defining event-driven communication between the Machine Digital Twin and Platform, including the machine event model, lifecycle events, order execution events, hardware events, telemetry model, JSON examples, reliability rules, integration boundaries, security requirements and future extension while preserving the rule that machines report facts and the platform makes business decisions.

- Machine State Model documentation in `docs/machine/MACHINE_STATE_MODEL.md` for EPIC-373 / MACHINE-STATE-001, defining machine lifecycle, runtime status, operation and command state models, transitions, commands, events, error states, recovery flows, offline behavior, maintenance mode, security rules and integration boundaries while preserving the rules that machines execute commands, the platform controls business decisions, payment confirmation is required before preparation and machines report results through events.

- Machine model consistency review in `docs/machine/MACHINE_MODEL_REVIEW.md` for EPIC-372 / MACHINE-003, documenting reviewed Machine documents, fixed identifier and relationship inconsistencies in the platform data model, decisions required and recommendations while keeping the change documentation-only.

- Machine Passport documentation in `docs/machine/MACHINE_PASSPORT.md` defining EPIC-372 / MACHINE-002 official equipment passport with verified general machine context, verified platform/equipment boundaries, documented cup and option counts where already approved, explicit unknowns for manufacturer, model, dimensions, power, sensors, actuators, connectivity, maintenance intervals and hardware payment details, and references for future manufacturer confirmation.

- Machine Domain documentation in `docs/domain/MACHINE_DOMAIN.md` defining EPIC-370 / MACHINE-001 DDD Lite machine model with machine entity, lifecycle, statuses, location, configuration, capabilities, components, paid-order dispensing rules, payment-to-dispatch boundary, inventory, telemetry, commands, events, error scenarios, maintenance, service operator actions, audit trail and integrations with Order, Payment and Product domains while preserving the rules that machines receive only paid orders and report physical execution results.

- Architecture status dashboard in `docs/architecture/ARCHITECTURE_STATUS.md` for EPIC-355 / ARCH-002 summarizing the current architecture version, completion and readiness scores, completed and in-progress EPICs, core layer status, documentation statistics, top risks, next priorities, readiness assessment and short roadmap while keeping the change documentation-only.

- Architecture consistency audit report in `docs/architecture/ARCHITECTURE_AUDIT.md` for EPIC-355 / ARCH-001 covering every Markdown document under `docs/`, documentation statistics, duplicate concepts, terminology conflicts, ownership drift across Domain/Data/Finance/API, cross-reference integrity, folder and naming organization, glossary status, decision-log coverage, task-index coverage, changelog and journal chronology, obsolete references, recommended moves and merges, architecture risks, documentation debt and a documentation quality score while keeping the change documentation-only.

- Platform Data Model documentation in `docs/data/PLATFORM_DATA_MODEL.md` defining EPIC-350 / DATA-001 logical platform data model with required core entities, entity identifiers, required and optional fields, relationships, cardinality, aggregate boundaries, data owners, storage rules, soft delete policy, immutable records, audit policy, retention policy, registry and reconciliation direction and future extensions while keeping the change documentation-only and independent from application code.

- Payment Domain documentation in `docs/domain/PAYMENT_DOMAIN.md` defining EPIC-300 / DOMAIN-004 DDD Lite payment model with provider-agnostic payment intents, limited-lifetime sessions, YooKassa as primary provider, SBP, QR, payment links, saved payment methods, one-click top-up, voluntary auto top-up, webhook and polling confirmation, expiration, failure, cancellation, full and partial refunds, internal operations registry, reports, reconciliation, accounting, Club Account, Bonus, Order and machine dispatch boundaries.

- YooKassa API configuration documentation and `.env.example` template with `YOOKASSA_SHOP_ID=1368517`, `YOOKASSA_API_URL=https://api.yookassa.ru/v3` and secret-key handling through environment variables only.

- Bonus Domain documentation in `docs/domain/BONUS_DOMAIN.md` defining EPIC-300 / DOMAIN-003 DDD Lite bonus system model with Bonus Account, Bonus Transaction, bonus batches, projection model, expiration, Burn Scheduler, Notification Scheduler, Referral Bonus, Birthday Bonus, Trusted Customer Bonus, Seasonal Bonus, Manual Adjustment, audit, state machines, sequence diagrams, events, edge cases, error scenarios, business rules and roadmap while preserving the boundary that bonuses are non-monetary discount rights, not Wallet balance, Club Account balance, cash or payment method.

- Club Account domain documentation in `docs/domain/CLUB_ACCOUNT.md` defining EPIC-300 / DOMAIN-002 DDD Lite prepaid Club Account model, lifecycle, available and reserved balance, 150 ₽ minimum recommended balance, 100 ₽ recommended top-up, activation, suspension, restoration, closing, immutable transaction history, top-up, spending, refund, bonus independence, auto top-up, saved payment method consent, payment confirmation, purchase authorization, state machine, sequence diagrams, events, edge cases, error scenarios and roadmap while preserving the boundary that Club Account is not a bank account and no automatic debit occurs without explicit consent.
- Mini App design rules module in `frontend/miniapp/src/shared/design/` with spacing, fixed hierarchy values and shared microcopy, plus active Mini App usage of the shared CTA text `Продолжить с комфортом` in the product flow.
- Applied Mini App design rules documentation in `docs/design/DESIGN_TOKENS.md`, including the approved spacing scale, fixed hierarchy values without viewport-width font scaling and shared microcopy for phone placeholder and continuation CTA.
- Customer Domain documentation in `docs/domain/CUSTOMER_DOMAIN.md` defining EPIC-300 / DOMAIN-001 DDD Lite customer model, customer lifecycle, roles, profile and contact attributes, identity links, consent boundary, Club Timofey status, trusted customer status, Telegram identification, referral relationships, activity history, commands, queries, events, business rules, privacy and fraud controls, storage direction, readiness criteria and cross-domain relationships while keeping customer context separate from Authentication, Authorization, Order, Payment, Bonus, Discount, Wallet, Notification, CRM, Analytics and Promotion ownership.
- Event API documentation in `docs/api/EVENT_API.md` defining Event API vision, event-driven architecture, event categories, domain events, integration events, notification events, event envelope, metadata, versioning, ordering, delivery, retry policy, dead-letter queue, idempotent consumers, event registry, `<Domain>.<Fact>` naming, security, acceptance criteria and roadmap for Orders, Payments, Wallet, Bonus, Products, Promotions, Machines, Customers and Analytics while keeping events immutable, fact-based, Runtime-owned and transport independent.
- REST API documentation in `docs/api/REST_API.md` defining REST vision, API design principles, resource naming, HTTP methods, URI convention, request and response structure, pagination, filtering, sorting, error response format, versioning, idempotency, rate limiting, authentication and authorization integration, resource groups for Customers, Wallet, Bonus, Orders, Payments, Products, Promotions, Machines, Events and Analytics, naming conventions, acceptance criteria and roadmap while keeping REST transport-only and Runtime-owned business rules outside route handlers.
- Authorization documentation in `docs/api/AUTHORIZATION.md` defining authorization vision, authentication vs authorization boundary, CustomerID as the primary platform identity, permission, role and scope models, customer, machine, admin, partner, CRM and API client permissions, least privilege, role assignment, permission checks, access denied handling, audit logging, security rules, acceptance criteria and roadmap while keeping Runtime business rules outside API Gateway policy.
- Authentication documentation in `docs/api/AUTHENTICATION.md` defining authentication vision, identity model, consumer types, human, machine, Telegram Mini App, vending machine and partner authentication, API keys, JWT tokens, refresh tokens, token lifetime, session management, security rules, authentication flow, acceptance criteria and roadmap while keeping authorization and business logic separate.
- API overview documentation in `docs/api/API_OVERVIEW.md` defining API vision, philosophy, consumers, platform services, authentication, authorization, REST API, Event API, webhooks, idempotency, versioning, error handling, security, rate limiting, monitoring, future SDK direction and roadmap while preserving Runtime ownership of business logic.
- Platform Kernel architecture documentation in `docs/kernel/PLATFORM_KERNEL.md` defining kernel scope, runtime coordination, engine boundaries, platform services, event bus, configuration layer, runtime registration, dependency rules, health monitoring, security, lifecycle, fault tolerance, extensibility and acceptance criteria.
- Platform Kernel registry and lifecycle documentation in `docs/kernel/RUNTIME_REGISTRY.md`, `docs/kernel/SERVICE_REGISTRY.md`, `docs/kernel/PLATFORM_BOOTSTRAP.md`, `docs/kernel/PLATFORM_CONFIGURATION.md` and `docs/kernel/PLATFORM_LIFECYCLE.md`, defining all known runtimes, engine registration, bootstrap sequence, configuration loading, dependency rules, health monitoring and graceful shutdown.
- Runtime completeness audit report in `docs/releases/RUNTIME_COMPLETENESS_AUDIT.md` covering Platform, Product, Finance, Order, Event, Machine, Notification, CRM, Analytics and AI runtimes with scores, risks, readiness, exit criteria and recommendations.
- Architecture audit report in `docs/releases/ARCHITECTURE_AUDIT.md` covering repository structure, folders, runtime, architecture layers, business and domain layers, ADR, tasks, release readiness, consistency, scores, recommendations and quality gates.
- Release governance documentation with release template, release policy, versioning rules and Architecture Release 1.0 record.
- ORDER-008 Machine Dispatch documentation defining paid-order machine selection, dispatch queue handling, machine command model, delivery protocol, acknowledgement flow, timeout handling, retry policy, failure recovery, technical and business event publication, monitoring, audit and architecture principles.
- ORDER-007 Refund documentation defining refund as a compensating financial process with lifecycle, allowed scenarios, partial and full refund rules, Ledger coordination, Wallet coordination, provider coordination, failure handling, recovery strategy, audit, fraud controls and future roadmap.
- EPIC-230 Order Platform architecture documentation defining Order as the business aggregate with immutable configuration, pricing and discount snapshots, checkout pipeline, lifecycle, payment binding, fulfillment, events, audit, idempotency, retry and recovery rules.
- ORDER-006 Cancellation documentation defining cancellation as a business process with unpaid cancellation, paid refund compensation, financial coordination, machine coordination, event flow, audit, monitoring, risks and future roadmap.
- ORDER-005 Fulfillment documentation defining the paid-order fulfillment lifecycle, queue management, machine assignment, preparation, dispensing, completion, failure handling, retry policy, compensation strategy, event publication, audit and monitoring rules.
- ORDER-004 Order Events documentation defining the canonical Order Platform event catalog, payload principles, versioning, ordering, idempotency, consumers, producers, failure handling, replay strategy and audit rules.
- ORDER-003 Order State Machine documentation defining canonical Order states, immutable terminal states, allowed and invalid transitions, payment, machine, cancellation, refund, timeout, retry, event publication, compensation, idempotency and audit rules.
- ORDER-002 Checkout Pipeline documentation defining the deterministic product-selection-to-order-confirmation flow, financial calculation boundary before payment, immutable order snapshots, event publication, machine queue handoff, failure handling, retry policy, idempotency and timeout handling.
- EPIC-210 Event Platform architecture documentation with Event Bus rules, formal event contracts, naming, versioning, delivery, storage, security and initial event catalog.
- FINANCE-004 Wallet architecture documentation defining Wallet as a Ledger projection with lifecycle, states, operations, API contracts, finance integrations and future multi-wallet/multi-currency roadmap.
- FINANCE-005 Bonus Engine architecture documentation defining bonuses as non-monetary discount rights with lifecycle, states, expiration, reservation, events, finance boundaries and future promotion integration.
- FINANCE-006 Discount Engine architecture documentation defining discounts as non-monetary price reductions calculated before payment, with lifecycle, types, stacking, priority, finance boundaries, events, fraud controls and future Promotion Engine integration.
- FINANCE-007 Payment Engine architecture documentation defining payment settlement execution with lifecycle, methods, idempotency, capture, refund, provider abstraction, YooKassa boundary, events and finance interactions.
- FINANCE-008 Accounting Adapter architecture documentation defining the Ledger-backed export/import boundary for external accounting systems, synchronization, retry, reconciliation, audit, security and future ERP/API integration.
- PRODUCT-006 Pricing Engine core with PricingEntity, repository-backed MVP pricing rules, PricingService calculation and PricingEngine facade.
- PRODUCT-005 Recipe Engine core with RecipeEntity, in-memory RecipeRepository definitions, RecipeService validation and module exports.
- PRODUCT-004 Configuration Engine foundation with ConfigurationEntity, ConfigurationRepository, ConfigurationService and module exports.
- PRODUCT-003 domain entity normalization for Product, Flavor, Syrup, Topping, RecipeReference and MediaReference.
- PRODUCT-001 DDD Lite domain foundation for Mini App domains and shared infrastructure folders.

- AGENTS.md как главный документ инструкций для AI-агентов и Codex Desktop.
- PROJECT_MEMORY.md как долговременная память проекта для разработчиков и AI-агентов.

### Planned

- Data Layer для Mini App.
- JSON-каталоги продукции, сиропов, топпингов, медиа и цен.
- CatalogService.
- MediaService.
- PricingEngine.
- ProductConfigurator.
- Подготовка экрана Preview.

## [v0.2.0] — First Purchase Flow Draft

### Added

- Главный экран Mini App.
- Экран выбора продукта.
- Выбор сиропа.
- Выбор топпинга.
- Первичные события аналитики.
- Базовая навигация между экранами.

## [v0.1.0-infrastructure-ready] — Infrastructure Ready

### Added

- Репозиторий `soft-ice-platform`.
- Базовая структура frontend/miniapp.
- React + Vite Mini App.
- Nginx-конфигурация для `app.utimoshi.ru`.
- Публикация Mini App на сервере.
- GitHub как единый источник истины.

### Fixed

- Ошибка `React is not defined` в Mini App.
- Настройки `.gitignore`.
- Синхронизация package-lock файлов.

## Documentation baseline

### Added

- Design System.
- Component Library.
- Design Tokens.
- Responsive UI Standard.
- Photo Standard.
- Product Catalog domain model.
- Syrup Catalog domain model.
- Topping Catalog domain model.
- Product Image Model.
- Media Library Structure.
- Project Decisions ADR log.
- Architecture Principles.
- Document Header Standard.
- Test Scenarios.
# 2026-07-21 - Huaxin Machine Gateway v1

- Added a vendor-neutral `MachineGateway` abstraction and Huaxin gateway runtime.
- Added session lifecycle, heartbeat freshness, bounded reconnect, status tracking, serialized command queue, safe XML generation/parsing, error mapping, telemetry retention, metrics and machine events.
- Added authenticated machine status, telemetry, command and reconnect API v1 endpoints.
- Added automated gateway protocol, queue, session, lifecycle, telemetry, event, error and reconnect tests without changing existing order/dispense business rules.
- Documented the API, machine boundary, architecture decision and test scenarios.
# 2026-07-21 — Customer Segmentation Core v1

- Added the Segmentation modular-monolith domain with `Segment`, `SegmentRule`, and append-only `CustomerSegment` assignment periods.
- Added Prisma persistence and migration support for manual/system segments, activation, declarative rules, and assignment history.
- Added runtime/repository/service/DTO layers plus authenticated customer active-segment and history API contracts.
- Added segmentation tests and domain documentation; advertising, rule evaluation, and recommendation execution remain out of scope.
