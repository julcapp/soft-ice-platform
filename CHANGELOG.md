# CHANGELOG

Все значимые изменения проекта Soft ICE Platform фиксируются в этом файле.

Формат версий следует Semantic Versioning.

## [v0.3.0-alpha.1] — In progress

### Added

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
