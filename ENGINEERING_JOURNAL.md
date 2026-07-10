# ENGINEERING_JOURNAL

Status: Active
Project: Soft ICE Platform / Utimoshi

## 2026-07-10 - MVP Backend Architecture Specification

- Created `docs/architecture/MVP_BACKEND_ARCHITECTURE.md` as a documentation-only backend architecture specification for EPIC-205 / TECH-001.
- Defined the first production MVP backend as a modular monolith with one deployable backend, one PostgreSQL database, internal module boundaries, an internal event/outbox layer and isolated integration adapters.
- Documented high-level architecture for Landing, Telegram Bot, Mini App, API Layer, Domain Modules, Database, Event Layer and Integration Layer.
- Defined backend modules for Customer, Club Account, Bonus, Payment, Order, Machine and Notification, including responsibilities and boundaries.
- Captured PostgreSQL schema ownership direction, audit tables, immutable financial record rules, REST API authentication/authorization/versioning, domain/payment/machine/notification events, external integrations, security, MVP deployment and future scaling path.
- Updated `CHANGELOG.md` and `docs/tasks/TASK_INDEX.md` to register EPIC-205 / TECH-001.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified. Build was not run because no executable application behavior changed.

## 2026-07-10 - MVP Implementation Roadmap

- Created `docs/releases/MVP_IMPLEMENTATION_ROADMAP.md` as a documentation-only implementation roadmap for EPIC-204 / PLAN-001.
- Defined the first production milestone as one machine, one product, real customer, real payment and real loyalty.
- Converted current launch readiness, Mini App, landing, Telegram Bot, domain, data and architecture documentation into six implementation phases: Infrastructure, Customer, Payments, Machine, Mini App and Testing.
- Captured the MVP loyalty interpretation as real customer identity, consent, Club Timofey or loyalty state and Bonus/loyalty projection, while moving advanced loyalty campaigns, saved payment methods, auto top-up and bonus redemption to post-MVP unless fully implemented and tested before launch.
- Added a priority table with task, domain, priority, dependency and status columns for production infrastructure, Telegram identity, customer profile, loyalty state, order/payment binding, YooKassa/SBP, refunds, machine registration, inventory, events, Mini App API integration and launch tests.
- Defined release criteria for infrastructure, customer, product/order, payment, machine, Mini App, loyalty and testing readiness before first production launch.
- Updated `CHANGELOG.md` and `docs/tasks/TASK_INDEX.md` to register EPIC-204 / PLAN-001.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified. Build was not run because no executable application behavior changed.

## 2026-07-10 - First Machine Launch Readiness Audit

- Created `docs/releases/MVP_LAUNCH_READINESS.md` as a documentation-only readiness audit for EPIC-203 / MVP-001.
- Audited current documentation for first production launch with one ice cream vending machine.
- Recorded the current platform verdict: architecture and documentation are strong enough to guide implementation, but the runtime is not production-launch-ready for a real vending machine.
- Documented completed domains and specifications across Landing, Telegram Bot, Mini App, Customer, Club Account, Bonus, Payment, Machine, Platform Data Model and architecture decisions.
- Checked customer journey readiness for Landing, Telegram Bot, Mini App, registration, payment, purchase and bonus flows.
- Checked machine readiness for machine profile, inventory, telemetry, events and configuration, including hardware verification gaps from the Machine Passport.
- Checked payment readiness for YooKassa, SBP, QR, refunds and payment registries.
- Checked data readiness for customer data, transactions, orders, audit logs, idempotency and event storage.
- Separated missing implementation items into must-have before launch and items that can be postponed.
- Defined a narrow first launch scenario with one machine, one product, one YooKassa-backed payment flow and one Telegram Bot -> Mini App customer journey.
- Identified technical, operational and business risks for the first launch.
- Updated `CHANGELOG.md` and `docs/tasks/TASK_INDEX.md` to register EPIC-203 / MVP-001.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified. Build was not run because no executable application behavior changed.

## 2026-07-10 - Telegram Bot User Flow Specification

- Created `docs/product/TELEGRAM_BOT_FLOW.md` as a documentation-only Telegram Bot customer flow specification for EPIC-202 / BOT-001.
- Defined Telegram Bot as the entry point, notification channel, Mini App launcher and customer communication channel, while explicitly keeping business logic in backend Runtimes.
- Documented first launch flow from opening the bot through welcome, consent, registration/profile completion, Telegram identity binding and Mini App launch.
- Defined main menu buttons: Open Mini App, Club Account, Bonuses, Purchases, Profile and Help.
- Captured registration/profile completion requirements for name, phone, email and consent management with Customer/Consent backend ownership.
- Documented payment scenarios for Club Account top-up, YooKassa, SBP link, QR payment and payment confirmation, preserving Payment Runtime as source of truth.
- Defined bot notifications for balance low, payment success, purchase completed, bonus received and promotions, including consent and Notification Runtime boundaries.
- Added error scenarios for payment failed, user not registered/customer not resolved, expired payment and unavailable service.
- Documented security rules for user identification, permissions and personal data, and integration boundaries for Bot, Mini App and Backend.
- Updated `CHANGELOG.md` and `docs/tasks/TASK_INDEX.md` to register EPIC-202 / BOT-001.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified. Build was not run because no executable application behavior changed.

## 2026-07-10 - Landing Specification

- Created `docs/product/LANDING_SPEC.md` as a documentation-only landing page specification for EPIC-201 / UX-003.
- Defined the landing purpose as brand introduction, customer acquisition, vending ice cream concept explanation, Telegram ecosystem connection and conversion into Club customers.
- Documented target audiences: children and parents, teenagers, students, casual buyers, repeat customers and Club members.
- Captured the customer journey from visitor through landing page, nearest machine discovery, Telegram Bot / Mini App, Club Account activation, purchase, bonus and return visit.
- Defined the landing structure: Hero, About "У Тимоши", How it works, Product, Club, Machine, Telegram and Trust sections.
- Added SEO requirements, design principles, first-launch MVP scope, non-MVP exclusions, integration points for Telegram Bot, Mini App, CRM and Analytics, and future extensions such as machine map, live availability, promotions, customer stories and loyalty campaigns.
- Updated `CHANGELOG.md` and `docs/tasks/TASK_INDEX.md` to register EPIC-201 / UX-003.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified. Build was not run because no executable application behavior changed.

## 2026-07-10 - Mini App MVP Specification

- Created `docs/product/MINI_APP_MVP_SPEC.md` as a documentation-only MVP specification for EPIC-200 / UX-002.
- Defined Mini App role as customer self-service interface, personal account, loyalty interface and payment entry point, while explicitly excluding CRM, admin panel and machine control responsibilities.
- Documented the MVP customer journey from discovery through Telegram Bot, Mini App launch, Telegram WebApp authentication, customer profile creation, Club Account, payment, purchase history, bonuses and return visit.
- Defined MVP screens: Home, Club Account, Payments, Purchases, Bonus Account and Profile, including required content and core states.
- Mapped screens to Customer, Club Account, Bonus, Payment, Order and Notification API dependencies, and listed relevant Event API facts for customer, account, bonus, payment, order and notification projections.
- Captured MVP business rules, out-of-scope items, UI/UX principles and future extensions while preserving existing Customer, Club Account, Bonus, Payment, REST API and Event API boundaries.
- Updated `CHANGELOG.md` and `docs/tasks/TASK_INDEX.md` to register EPIC-200 / UX-002.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified. Build was not run because no executable application behavior changed.

## 2026-07-10 - Mini App Architecture Audit

- Created `docs/product/MINI_APP_AUDIT.md` as a documentation-only Mini App architecture audit for EPIC-200 / UX-001.
- Reviewed `frontend/miniapp` structure, Telegram bot handoff, backend payment stub, authentication documentation, Telegram Mini App WebApp flow, Customer Domain, Club Account Domain, Bonus Domain, Payment Domain, API documentation and CRM direction.
- Documented current Mini App readiness as a product-selection prototype and UI shell, not yet a paid vending MVP.
- Captured existing UI components, implemented domain service foundations, placeholder repositories, missing authentication, checkout, order, payment, machine fulfillment, club, bonus, CRM and API integration pieces.
- Documented current and required MVP user journeys, required screens, API dependencies, authentication readiness, payment integration readiness, CRM readiness and an incremental MVP roadmap that preserves existing architecture decisions.
- Updated `CHANGELOG.md` and `docs/tasks/TASK_INDEX.md` to register EPIC-200 / UX-001.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified. Build was not run because no executable application behavior changed.

## 2026-07-09 - Machine Events and Telemetry Documentation

- Created `docs/machine/MACHINE_EVENTS_TELEMETRY.md` as a documentation-only Machine Events and Telemetry contract for EPIC-374 / MACHINE-004.
- Defined event-driven communication between the Machine Digital Twin and Platform, including event identity, event type, timestamps, machine identifiers, correlation IDs, payload, source and severity.
- Documented lifecycle, order execution and hardware event families: `MachineConnected`, `MachineDisconnected`, `MachineStarted`, `MachineReady`, `MachineBusy`, `MachineError`, `MachineMaintenanceRequired`, `OrderReceived`, `OrderAccepted`, `PreparationStarted`, `PreparationCompleted`, `PreparationFailed`, `ProductDispensed`, `TemperatureWarning`, `IngredientLow`, `CupMagazineLow`, `ComponentFailure` and `CleaningRequired`.
- Documented telemetry coverage for temperature, consumables, counters, runtime, connectivity and hardware health, with JSON examples for machine readiness, order acceptance, temperature warning, product dispensing and telemetry reporting.
- Captured reliability, offline buffering, duplicate handling, retry, integration boundary and security requirements while preserving that machines report facts and platform domains make business decisions.
- Updated `CHANGELOG.md` and `docs/tasks/TASK_INDEX.md` to register EPIC-374 / MACHINE-004.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified. Build was not run because no executable application behavior changed.

## 2026-07-09 - Machine State Model Documentation

- Created `docs/machine/MACHINE_STATE_MODEL.md` as a documentation-only Machine State Model for EPIC-373 / MACHINE-STATE-001.
- Defined separate state axes for lifecycle, runtime status, connectivity, operation, command, maintenance and incidents so active business lifecycle is not confused with live equipment readiness.
- Documented lifecycle, runtime, operation and command state machines with allowed transitions, command and event catalogs, error states, recovery flows, offline behavior, maintenance mode, security rules and integration boundaries.
- Preserved mandatory boundaries: machine executes commands; platform controls business decisions; payment confirmation is required before preparation; machine reports results through events; Machine Runtime does not own payment, refund, bonus, product catalog or Order lifecycle decisions.
- Updated `CHANGELOG.md` and `docs/tasks/TASK_INDEX.md` to register EPIC-373 / MACHINE-STATE-001.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified. Build was not run because no executable application behavior changed.

## 2026-07-09 - Machine Model Consistency Review

- Created `docs/machine/MACHINE_MODEL_REVIEW.md` as a documentation-only consistency review for EPIC-372 / MACHINE-003.
- Reviewed `docs/machine/MACHINE_PASSPORT.md`, `docs/domain/MACHINE_DOMAIN.md`, `docs/data/PLATFORM_DATA_MODEL.md` and `docs/architecture/PROJECT_DECISIONS.md` for terminology consistency, entity naming, component naming, missing relationships, conflicting definitions and unknown hardware assumptions.
- Fixed concrete platform data model drift by aligning `MachineInventory` on `machine_inventory_id`, aligning `MachineCommand` on `command_id` and adding missing Machine relationship summary rows for capabilities, queue entries, operations, commands, telemetry and incidents.
- Confirmed no conflicting ownership definition was found across Machine, Order, Payment and Product boundaries, and no unmarked hardware assumptions were found in the Machine Passport.
- Updated `CHANGELOG.md` and `docs/tasks/TASK_INDEX.md` to register MACHINE-003.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified. Build was not run because no executable application behavior changed.

## 2026-07-09 - Machine Passport Documentation

- Created `docs/machine/MACHINE_PASSPORT.md` as a documentation-only official engineering passport for EPIC-372 / MACHINE-002.
- Recorded only verified equipment information from repository documentation and explicitly marked unknown hardware facts as `Unknown` or `To be confirmed`.
- Documented verification status for every major passport section, including general information, physical characteristics, hardware components, capacity, sensors, actuators, consumables, connectivity, payments, maintenance, safety, manufacturer limitations, expandability and references.
- Preserved hardware accuracy boundaries: manufacturer, model, dimensions, weight, power, real sensor list, actuator list, exact network interfaces, maintenance intervals, certifications and serial number are not invented and require confirmation.
- Updated `CHANGELOG.md` and `docs/tasks/TASK_INDEX.md` to register MACHINE-002.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified. Build was not run because no executable application behavior changed.

## 2026-07-08 - Machine Domain Documentation

- Created `docs/domain/MACHINE_DOMAIN.md` as a documentation-only DDD Lite Machine Domain contract for EPIC-370 / MACHINE-001.
- Defined Machine as the business entity for physical vending equipment, including lifecycle, operational statuses, location, configuration, capabilities, components, inventory, telemetry, machine commands, machine events, error scenarios, maintenance, service operator actions and audit trail.
- Preserved mandatory boundaries: machine does not start preparation before payment is confirmed; machine receives only paid orders; Machine Domain does not own payment logic, bonus logic, product pricing or Order lifecycle transitions; platform sends commands and machine returns events and execution results.
- Added `DECISION-039` to `docs/architecture/PROJECT_DECISIONS.md`, establishing Machine Domain as the equipment execution boundary.
- Updated `CHANGELOG.md` and `docs/tasks/TASK_INDEX.md` to register MACHINE-001.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified. Build was not run because no executable application behavior changed.

## 2026-07-07 - Architecture Status Dashboard

- Created `docs/architecture/ARCHITECTURE_STATUS.md` as a documentation-only executive dashboard for EPIC-355 / ARCH-002.
- Summarized Architecture Release 1.0, active runtime line `v0.3.0-alpha.1`, architecture readiness, runtime readiness, documentation quality score, completed EPICs, in-progress EPICs, core layer status, documentation statistics, top risks, next priorities, readiness assessment and short roadmap.
- Updated `CHANGELOG.md` and `docs/tasks/TASK_INDEX.md` to register ARCH-002.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified. Build was not run because no executable application behavior changed.

## 2026-07-07 - Architecture Consistency Audit

- Created `docs/architecture/ARCHITECTURE_AUDIT.md` as a documentation-only consistency audit for EPIC-355 / ARCH-001.
- Scanned all Markdown documents under `docs/` and reviewed active root governance files `AGENTS.md`, `CHANGELOG.md`, `ENGINEERING_JOURNAL.md` and `PROJECT_MEMORY.md`.
- Documented repository structure, documentation statistics, duplicate concepts, terminology conflicts, obsolete documents, obsolete references, missing documents, recommended relocations, recommended merges, architecture risks, documentation debt and documentation quality score.
- Fixed obvious documentation reference drift in prior release audits and updated `docs/tasks/TASK_INDEX.md` to include EPIC-355 / ARCH-001, restore EPIC-210 traceability and align PRODUCT-004 through PRODUCT-006 with completed task records.
- Updated `CHANGELOG.md` and `docs/tasks/TASK_INDEX.md` to register the documentation increment.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified. Build was not run because no executable application behavior changed.

## 2026-07-07 - Platform Data Model Documentation

- Created `docs/data/PLATFORM_DATA_MODEL.md` as a documentation-only logical data model for EPIC-350 / DATA-001.
- Documented required platform entities across Customer, CustomerIdentity, CustomerConsent, Club Account, Bonus, Order, Product, Recipe, Machine, MachineGroup, Location, SalesChannel, Payment, PaymentSession, PaymentOperation, RefundOperation, PaymentRegistry, FinancialRegistry, Promotion, Referral, Notification and AuditEvent boundaries.
- Captured key attributes, required fields, optional fields, relationships, cardinality, aggregate boundaries, data owners, source-of-truth rules, storage direction, soft delete policy, immutable records, audit requirements, retention direction, registry/reconciliation rules and future expansion paths.
- Added `DECISION-038` to `docs/architecture/PROJECT_DECISIONS.md`, establishing `docs/data/PLATFORM_DATA_MODEL.md` as the canonical logical data model while keeping physical database schemas implementation-specific.
- Updated `CHANGELOG.md` and `docs/tasks/TASK_INDEX.md` to register DATA-001.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified. Build was not run because no executable application behavior changed.

## 2026-07-07 - Payment Domain Documentation

- Created `docs/domain/PAYMENT_DOMAIN.md` as a documentation-only DDD Lite Payment Domain contract for EPIC-300 / DOMAIN-004.
- Defined Payment Domain as a provider-agnostic bounded context with payment intents, limited-lifetime payment sessions, payment methods, saved payment method references, one-click top-up, voluntary auto top-up, webhook confirmation, status polling, expiration, failure, cancellation, full refunds, partial refunds, operations registry, reports and reconciliation.
- Documented YooKassa as the primary payment provider while keeping YooKassa-specific fields, statuses, payloads and secrets inside the provider adapter boundary.
- Preserved mandatory boundaries: QR codes and payment links have limited lifetime; expired sessions cannot start preparation; product preparation starts only after full confirmed payment; machine receives only paid orders; Club Account and Bonus Account remain separate; Bonus is not money; refunds are new financial operations, not edits to historical records.
- Added `DECISION-033`, `DECISION-034`, `DECISION-035` and `DECISION-036` to `docs/architecture/PROJECT_DECISIONS.md`.
- Updated `CHANGELOG.md` and `docs/tasks/TASK_INDEX.md` to register the documentation increment.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified.

## 2026-07-06 - Bonus Domain Documentation

- Created `docs/domain/BONUS_DOMAIN.md` as a documentation-only DDD Lite Bonus Domain contract for EPIC-300 / DOMAIN-003.
- Defined Bonus Account as the customer-linked account for non-monetary discount rights and Bonus Transaction as the append-only journal for accrual, activation, reservation, redemption, release, expiration, cancellation, reversal and manual adjustment.
- Documented bonus batches, projection fields, account lifecycle, transaction model, expiration policy, Burn Scheduler, Notification Scheduler, Referral Bonus, Birthday Bonus, Trusted Customer Bonus, Seasonal Bonus, Manual Adjustment, audit trail, state machines, sequence diagrams, events, business rules, edge cases, error scenarios and roadmap.
- Preserved domain boundaries: Bonus is not money, not Wallet balance, not Club Account balance, not cash and not a payment method; Discount/Pricing owns the final discount effect and payable amount; Payment collects only the accepted payable amount; Ledger remains the financial source of truth.
- Updated `CHANGELOG.md`, `docs/architecture/PROJECT_DECISIONS.md` and `docs/tasks/TASK_INDEX.md` to register the documentation increment.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified.

## 2026-07-06 - Club Account Domain Documentation

- Created `docs/domain/CLUB_ACCOUNT.md` as a documentation-only DDD Lite Club Account contract for EPIC-300 / DOMAIN-002.
- Defined Club Account as a customer-facing prepaid balance for purchases inside Soft ICE Platform, not a bank account, not saved card storage and not bonus balance.
- Documented lifecycle, available and reserved balance, 150 ₽ minimum recommended balance, automatic low-balance notification rule, 100 ₽ recommended top-up, activation, suspension, restoration, closing, transaction history, top-up, spending, refund, saved payment method consent, auto top-up, payment confirmation, purchase authorization, state machine, sequence diagrams, events, edge cases, error scenarios and roadmap.
- Preserved domain boundaries: Bonus remains an independent right to discount of 1 ₽; Payment Engine owns provider confirmation; Ledger remains the financial source of truth; purchase preparation starts only after successful payment authorization; no automatic debit occurs without explicit consent.
- Updated `CHANGELOG.md`, `docs/architecture/PROJECT_DECISIONS.md` and `docs/tasks/TASK_INDEX.md` to register the documentation increment.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified.

## 2026-07-06 - Mini App Design Rules

- Added a Mini App design rules module under `frontend/miniapp/src/shared/design/` with spacing, fixed hierarchy values and shared microcopy.
- Connected product flow CTA copy to `DESIGN_RULES.microcopy.cta`, changing the order continuation button to `Продолжить с комфортом`.
- Updated active Mini App CSS variables in `frontend/miniapp/src/styles/global.css` for the approved spacing scale and fixed h1/body hierarchy values without viewport-width font scaling.
- Updated `docs/design/DESIGN_TOKENS.md`, `docs/testing/TEST_SCENARIOS.md` and `CHANGELOG.md`.
- Verification: `npm run build` passed in `frontend/miniapp`.

## 2026-07-06 - Customer Domain Documentation

- Created `docs/domain/CUSTOMER_DOMAIN.md` as a documentation-only DDD Lite Customer Domain contract for EPIC-300 / DOMAIN-001.
- Defined Customer Domain ownership of `customer_id`, lifecycle, profile attributes, contact points, identity links, consent summary, Club Timofey status, trusted customer status, referral relationships, activity timeline, commands, queries, events, business rules, privacy and fraud controls.
- Documented Telegram identification as an external alias flow: Authentication verifies Telegram init data, Customer Domain resolves or creates `customer_id`, and Telegram ID remains an external identity link.
- Preserved domain boundaries: Customer does not calculate price, apply discounts, accrue bonuses, mutate wallet balance, execute payment, change Order lifecycle, deliver notifications or enforce API route authorization.
- Updated `CHANGELOG.md`, `docs/architecture/PROJECT_DECISIONS.md` and `docs/tasks/TASK_INDEX.md` to register the documentation increment.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output modified.

## 2026-07-06 - Event API Documentation

- Filled `docs/api/EVENT_API.md` as a documentation-only Event API contract for Soft ICE Platform.
- Defined Event API as an asynchronous fact boundary: events are immutable, events describe facts, Runtime owns business logic and transport can change without changing event contracts.
- Documented event-driven architecture, event categories, domain events, integration events, notification events, envelope, metadata, versioning, ordering, delivery, retry policy, dead-letter handling, idempotent consumers, registry, `<Domain>.<Fact>` naming, security, acceptance criteria and roadmap.
- Covered required event domains: Orders, Payments, Wallet, Bonus, Products, Promotions, Machines, Customers and Analytics.
- Updated `CHANGELOG.md`, `docs/architecture/PROJECT_DECISIONS.md` and `docs/tasks/TASK_INDEX.md` to register the documentation increment.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration or generated build output modified.

## 2026-07-06 - REST API Documentation

- Created `docs/api/REST_API.md` as a documentation-only REST contract direction for Soft ICE Platform.
- Defined REST API as synchronous transport only: endpoints expose capabilities, Runtime owns business rules and route handlers must not contain business logic.
- Documented REST vision, design principles, resource naming, HTTP methods, URI convention, request and response structure, pagination, filtering, sorting, error format, API versioning, idempotency, rate limiting, authentication integration and authorization integration.
- Documented resource groups for Customers, Wallet, Bonus, Orders, Payments, Products, Promotions, Machines, Events and Analytics with endpoint candidates and Runtime ownership boundaries.
- Updated `CHANGELOG.md`, `docs/architecture/PROJECT_DECISIONS.md` and `docs/tasks/TASK_INDEX.md` to register the documentation increment.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration or generated build output modified.

## 2026-07-06 - Authorization Documentation

- Created `docs/api/AUTHORIZATION.md` as a documentation-only authorization contract for Soft ICE Platform API consumers, integrations and platform services.
- Defined authorization as access policy enforcement only, separate from authentication and Runtime business rules.
- Documented CustomerID as the primary platform identity, with TelegramID, phone, email, VK ID and external OAuth IDs treated as external identities only.
- Documented permission, role and scope models, customer, machine, admin, partner, CRM and API client permissions, least privilege, role assignment, permission checks, access denied handling, audit logging, security rules, acceptance criteria and roadmap.
- Updated `CHANGELOG.md`, `docs/architecture/PROJECT_DECISIONS.md` and `docs/tasks/TASK_INDEX.md` to register the documentation increment.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration or generated build output modified.

## 2026-07-06 - Authentication Documentation

- Filled `docs/api/AUTHENTICATION.md` as a documentation-only authentication contract for Soft ICE Platform API consumers and integrations.
- Defined authentication as identity verification only, with authorization documented separately and business logic kept in Runtime contracts.
- Documented identity model, consumer types, human, machine, Telegram Mini App, vending machine and partner authentication, API keys, JWT tokens, refresh tokens, token lifetime, session management, security rules, authentication flow, acceptance criteria and roadmap.
- Updated `CHANGELOG.md`, `docs/architecture/PROJECT_DECISIONS.md` and `docs/tasks/TASK_INDEX.md` to register the documentation increment.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration or generated build output modified.

## 2026-07-06 - API Overview Documentation

- Created `docs/api/API_OVERVIEW.md` as a documentation-only API contract overview for Soft ICE Platform.
- Defined API as a contract and integration layer for REST, Event API, webhooks, authentication, authorization, idempotency, versioning, error handling, security, rate limiting, monitoring and future SDKs.
- Preserved the architecture rule that API never contains business logic, Runtime owns business logic, API is a contract and configuration controls behavior.
- Updated `CHANGELOG.md`, `docs/architecture/PROJECT_DECISIONS.md` and `docs/tasks/TASK_INDEX.md` to register the documentation increment.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, runtime configuration or generated build output modified.

## 2026-07-03 - Platform Kernel Registries and Lifecycle

- Created `docs/kernel/RUNTIME_REGISTRY.md`, `docs/kernel/SERVICE_REGISTRY.md`, `docs/kernel/PLATFORM_BOOTSTRAP.md`, `docs/kernel/PLATFORM_CONFIGURATION.md` and `docs/kernel/PLATFORM_LIFECYCLE.md` as documentation-only Platform Kernel contract references.
- Documented all known runtimes, runtime manifest fields, runtime registration, service registration, engine registration, dependency rules, bootstrap sequence, configuration loading, health monitoring, lifecycle states and graceful shutdown.
- Kept Kernel responsibilities limited to coordination, registration, configuration shape validation, health observation and lifecycle control while preserving business logic ownership in runtimes and engines.
- Updated `CHANGELOG.md`, `docs/architecture/PROJECT_DECISIONS.md` and `docs/tasks/TASK_INDEX.md` to register the documentation increment.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, UI code, runtime configuration or generated build output modified.

## 2026-07-03 - Platform Kernel Architecture

- Created `docs/kernel/PLATFORM_KERNEL.md` as a documentation-only architecture reference for the Platform Kernel.
- Defined the Kernel as infrastructure coordination only: runtime startup, configuration, registries, event bus, platform services, health monitoring, security primitives, lifecycle coordination and fault tolerance.
- Documented that the Kernel never contains business logic, Runtime owns business logic, Engine owns implementation and configuration is preferred over code changes.
- Updated `CHANGELOG.md`, `docs/architecture/PROJECT_DECISIONS.md` and `docs/tasks/TASK_INDEX.md` to register the documentation increment.
- Verification: documentation-only change; no application source code, frontend code, UI code, runtime config or generated build output modified.

## 2026-07-03 - Runtime Completeness Audit

- Created `docs/releases/RUNTIME_COMPLETENESS_AUDIT.md` as a documentation-only audit of runtime completeness after Architecture Baseline 1.0.
- Evaluated Platform, Catalog, Configuration, Media, Recipe, Pricing, Finance, Ledger, Wallet, Bonus, Discount, Payment, Accounting Adapter, Order, Event, Machine, Notification, Customer/CRM, Analytics and AI runtimes.
- Recorded overall runtime readiness 34/100 and architecture readiness 76/100.
- Updated `CHANGELOG.md` to register the audit report.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, UI code, infrastructure runtime config or generated build output modified.

## 2026-07-03 - Architecture Audit

- Created `docs/releases/ARCHITECTURE_AUDIT.md` as a documentation-only repository and architecture audit after Architecture Baseline 1.0.
- Audited repository structure, folders, runtime packages, architecture layers, business/domain layers, ADR, tasks, releases, naming, cross references, consistency, quality gates and exit criteria.
- Recorded architecture score 82/100 and repository readiness score 64/100.
- Updated `CHANGELOG.md` to register the audit report.
- Verification: documentation-only change; no application source code, frontend code, backend code, Telegram bot code, infrastructure runtime config or generated build output modified.

## 2026-07-03 - Release Governance Documentation

- Created release governance documentation in `docs/releases/RELEASE_TEMPLATE.md`, `docs/releases/RELEASE_POLICY.md`, `docs/releases/VERSIONING.md` and `docs/releases/RELEASE_1_0.md`.
- Defined release structure, freeze process, approval process, GitHub Release policy, documentation requirements, quality gates, architecture versioning, runtime SemVer rules and ADR release rules.
- Recorded Architecture Release 1.0 as an architecture-only release with no runtime artifact, no frontend changes and no UI changes.
- Updated `CHANGELOG.md` and `docs/architecture/PROJECT_DECISIONS.md` to register the release governance increment and ADR-025.
- Verification: documentation-only change; no application source code or frontend files modified.

## 2026-07-03 - ORDER-008 Machine Dispatch Architecture

- Updated `docs/architecture/ORDER_PLATFORM.md` with Machine Dispatch architecture, lifecycle, machine selection, queue handling, delivery protocol, command acknowledgement, timeout handling, retry policy, failure recovery, event publication, monitoring, audit and architecture principles.
- Updated `docs/tasks/ORDER-008_MACHINE_DISPATCH.md` as the detailed machine dispatch task record.
- Updated `docs/tasks/TASK_INDEX.md`, `CHANGELOG.md` and `docs/architecture/PROJECT_DECISIONS.md` to register ORDER-008 and ADR-024.
- Verification: documentation-only change; no application source code or frontend files modified.

## 2026-07-03 - ORDER-007 Refund Architecture

- Updated `docs/architecture/ORDER_PLATFORM.md` with refund architecture, lifecycle, financial coordination, Ledger interaction, Wallet interaction, provider interaction, event publication, audit, fraud prevention and architecture principles.
- Added `docs/tasks/ORDER-007_REFUND.md` as the detailed refund task record.
- Updated `docs/tasks/TASK_INDEX.md`, `CHANGELOG.md` and `docs/architecture/PROJECT_DECISIONS.md` to register ORDER-007 and ADR-023.
- Verification: documentation-only change; no application source code or frontend files modified.

## 2026-07-03 - ORDER-006 Cancellation Architecture

- Updated `docs/architecture/ORDER_PLATFORM.md` with cancellation architecture, lifecycle, business rules, financial impact, machine interaction, compensation strategy, event publication, audit, monitoring and architecture principles.
- Added `docs/tasks/ORDER-006_CANCELLATION.md` as the detailed cancellation task record.
- Updated `docs/tasks/TASK_INDEX.md`, `CHANGELOG.md` and `docs/architecture/PROJECT_DECISIONS.md` to register ORDER-006 and ADR-022.
- Verification: documentation-only change; no application source code or frontend files modified.

## 2026-07-03 - ORDER-005 Fulfillment Architecture

- Updated `docs/architecture/ORDER_PLATFORM.md` with paid-order fulfillment lifecycle, queue management, machine assignment, preparation, dispensing, completion, failure handling, retry, compensation, event publication, audit and monitoring rules.
- Added `docs/tasks/ORDER-005_FULFILLMENT.md` as the detailed fulfillment task record.
- Updated `docs/tasks/TASK_INDEX.md`, `CHANGELOG.md` and `docs/architecture/PROJECT_DECISIONS.md` to register ORDER-005 and ADR-021.
- Verification: documentation-only change; no application source code or frontend files modified.

## 2026-07-03 - ORDER-004 Order Events Architecture

- Updated `docs/architecture/ORDER_PLATFORM.md` with the canonical Order Platform business event catalog and the rule that every accepted Order transition emits exactly one business event.
- Added `docs/tasks/ORDER-004_ORDER_EVENTS.md` with event catalog, payload principles, versioning, ordering, idempotency, consumers, producers, failure handling, replay strategy and audit requirements.
- Updated `docs/tasks/TASK_INDEX.md`, `CHANGELOG.md` and `docs/architecture/PROJECT_DECISIONS.md` to register ORDER-004 and ADR-020.
- Verification: documentation-only change; no application source code or frontend files modified.

## 2026-07-03 - ORDER-003 Order State Machine Architecture

- Updated `docs/architecture/ORDER_PLATFORM.md` with the canonical Order State Machine states, immutable terminal state rule and allowed transition summary.
- Added `docs/tasks/ORDER-003_ORDER_STATE_MACHINE.md` as the task record and detailed state machine contract.
- Documented allowed, invalid, payment, machine, cancellation, refund, timeout and retry transitions with business reasons and domain events.
- Documented event publication, compensation actions, idempotency, audit requirements and architecture principles.
- Verification: documentation-only change; no application source code or frontend files modified.

## 2026-07-02 - ORDER-002 Checkout Pipeline Architecture

- Expanded `docs/architecture/CHECKOUT.md` into a deterministic checkout pipeline from product selection through configuration validation, availability validation, pricing, discounts, bonus reservation, Order snapshot acceptance, payment initialization, payment confirmation, Order confirmation, event publication and machine queue handoff.
- Added `docs/tasks/ORDER-002_CHECKOUT_PIPELINE.md` as the task record for the checkout pipeline documentation increment.
- Documented that all financial calculations happen before payment, Payment collects only the accepted payable amount and confirmed Order snapshots are immutable.
- Documented failure scenarios, retry scenarios, idempotency boundaries, timeout handling and architecture principles.
- Verification: documentation-only change; no application source code or frontend files modified.

## 2026-07-02 - EPIC-230 Order Platform Architecture

- Added documentation-only Order Platform architecture in `docs/architecture/ORDER_PLATFORM.md`.
- Defined Order as the business aggregate that owns immutable configuration, pricing and discount snapshots.
- Documented lifecycle, states, Order Item, bonus reservation, payment binding, fulfillment, machine interaction, events, audit, idempotency, retry, error handling and security.
- Added Checkout architecture in `docs/architecture/CHECKOUT.md` with customer journey, checkout pipeline, validation order, pricing order, payment order, failure scenarios and recovery scenarios.
- Added EPIC-230 and ORDER-001 task documentation.
- Verification: documentation-only change; no application source code or frontend files modified.

## 2026-07-02 - FINANCE-008 Accounting Adapter Architecture

- Added documentation-only Accounting Adapter architecture in `docs/architecture/ACCOUNTING_ADAPTER.md`.
- Defined Accounting Adapter as the Finance Platform integration boundary that translates Ledger-backed facts for external accounting systems.
- Documented Adapter pattern rationale, supported accounting system categories, Ledger integration, export model, import model, synchronization, events, error handling, retry policy, reconciliation, idempotency, audit and security.
- Documented future ERP and API integration rules while keeping external accounting systems outside platform core.
- Added FINANCE-008 task roadmap in `docs/tasks/FINANCE-008_ACCOUNTING_ADAPTER.md`.
- Verification: documentation-only change; no application source code or build output modified.

## 2026-07-02 - FINANCE-007 Payment Engine Architecture

- Added documentation-only Payment Engine architecture in `docs/architecture/PAYMENT_ENGINE.md`.
- Defined Payment as the Finance Platform domain that executes financial settlement without changing business logic.
- Documented lifecycle, states, payment methods, card, SBP, Wallet and mixed payment flows.
- Documented idempotency, authorization, capture, refund, cancellation, retry policy, provider abstraction, YooKassa integration boundary, future provider support, events and fraud controls.
- Kept Ledger as the source of truth and kept Payment separate from Pricing, Discount, Bonus, Wallet projection, Order business rules, Machine commands and UI.
- Added FINANCE-007 task roadmap in `docs/tasks/FINANCE-007_PAYMENT_ENGINE.md`.
- Verification: documentation-only change; no application source code or build output modified.

## 2026-07-02 - FINANCE-006 Discount Engine Architecture

- Added documentation-only Discount Engine architecture in `docs/architecture/DISCOUNT_ENGINE.md`.
- Defined discounts as non-monetary price reductions calculated after gross pricing and before payment.
- Documented lifecycle, discount types, percentage, fixed, coupon, campaign, membership and trusted customer discounts.
- Documented stacking policy, priority rules, Pricing, Wallet, Bonus, Payment, CRM interactions, events, fraud controls and future Promotion Engine integration.
- Kept Discount separate from Wallet balance, Bonus balance, Ledger mutation, Payment provider logic, CRM screens and Notification templates.
- Added FINANCE-006 task roadmap in `docs/tasks/FINANCE-006_DISCOUNT_ENGINE.md`.
- Verification: documentation-only change; no application source code or build output modified.

## 2026-07-02 - FINANCE-005 Bonus Engine Architecture

- Added documentation-only Bonus Engine architecture in `docs/architecture/BONUS_ENGINE.md`.
- Defined bonus as a non-monetary right to receive a 1 RUB nominal discount according to platform rules.
- Documented lifecycle, states, expiration policy, accrual, redemption, cancellation, reservation, events and fraud controls.
- Kept Bonus separate from Wallet balance, Ledger accounting, Pricing calculation, Discount stacking, CRM screens and Notification templates.
- Added FINANCE-005 task roadmap in `docs/tasks/FINANCE-005_BONUS_ENGINE.md`.
- Verification: documentation-only change; no application source code or build output modified.

## 2026-07-02 - PRODUCT-006 Pricing Engine Core

- Added an isolated Pricing Engine domain implementation under `frontend/miniapp/src/domain/pricing/`.
- Implemented PricingEntity, concrete PricingRepository MVP rules, PricingService calculation and PricingEngine facade.
- PricingEngine is the only pricing engine class; no duplicate legacy alias is kept.
- MVP pricing returns basePrice 130, finalPrice 130, currency RUB, bonusAllowed true, bonusNominalRate 1 and bonusLimit 104 for the vanilla cup flow.
- Kept pricing independent from React, App.jsx, pages, routes, styles, assets, analytics, Wallet, Payment, Machine and customer balance mutations.
- Verification: Catalog -> Configuration -> Recipe -> Pricing smoke import passed; `npm run build` passed through `C:\Program Files\nodejs\npm.cmd` after adding `C:\Program Files\nodejs` to PATH for the shell session.

## 2026-07-02 - PRODUCT-005 Recipe Engine Core

- Added an isolated Recipe Engine domain implementation under `frontend/miniapp/src/domain/recipe/`.
- Implemented RecipeEntity, concrete RecipeRepository definitions, RecipeService compatibility validation and module exports.
- Kept recipe logic independent from React, App.jsx, pages, routes, styles, pricing, media lookup, analytics, browser APIs and vending machine commands.
- RecipeService receives a valid ConfigurationEntity, validates recipe compatibility and returns a machine-independent RecipeEntity with base, syrup and topping ingredients.
- Verification: recipe service smoke import passed; `npm run build` passed after adding `C:\Program Files\nodejs` to PATH for the shell session.

## 2026-07-01 - PRODUCT-004 Configuration Engine Foundation

- Added an isolated Configuration Engine domain under `frontend/miniapp/src/domain/configuration/`.
- Implemented ConfigurationEntity, ConfigurationRepository, ConfigurationService and module exports.
- Kept configuration building independent from React, App.jsx, pages, routes, styles, pricing, recipe execution, media lookup and machine control.
- Added MVP configuration rules for `product_soft_ice_vanilla_cup` with one default flavor, one default cup size, allowed syrups, allowed toppings, recipe reference and media reference.
- Verification: service smoke import passed; `npm run build` passed after adding `C:\Program Files\nodejs` to PATH for the shell session.
