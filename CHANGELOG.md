# CHANGELOG

Все значимые изменения проекта Soft ICE Platform фиксируются в этом файле.

Формат версий следует Semantic Versioning.

## [v0.3.0-alpha.1] — In progress

### Added

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
