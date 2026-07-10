# CHANGELOG

Все значимые изменения проекта Soft ICE Platform фиксируются в этом файле.

Формат версий следует Semantic Versioning.

## [v0.3.0-alpha.1] — In progress

### Added

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
