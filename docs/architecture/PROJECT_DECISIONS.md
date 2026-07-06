# PROJECT_DECISIONS.md

> Файл должен лежать в репозитории по пути:
>
> `docs/architecture/PROJECT_DECISIONS.md`

---

# Decision: Customer Domain Identity and Relationship Boundary

**Date:** 2026-07-06

**Status:** Accepted

## Context

Soft ICE Platform needs a shared customer model for Mini App, Telegram Bot, web app, vending terminal, CRM, Order, Payment, Bonus, Discount, Notification, Analytics and future Promotion workflows.

Without a documented Customer Domain boundary, Telegram ID, phone, email, club status, trusted customer flags, referral links, consent state and CRM support data could become duplicated across UI, API handlers, Order, Payment, Bonus, Discount or Notification code.

That would make CustomerID unstable, weaken privacy and consent handling, and make future CRM or loyalty implementation harder to audit.

---

## Decision

Soft ICE Platform defines Customer Domain as the owner of the customer relationship.

Customer Domain owns:

- `customer_id`;
- customer lifecycle;
- profile attributes;
- contact points;
- identity links;
- consent summary projection and consent references;
- Club Timofey membership status;
- trusted customer status;
- referral relationships;
- customer activity timeline;
- customer domain events and audit metadata.

CustomerID is the canonical platform identity.

Telegram ID, phone, email, VK ID, MAX ID, OAuth subject IDs and payment provider customer references are external aliases only.

Authentication verifies external credentials.

Authorization enforces route and resource access policy.

Customer Domain resolves or creates `customer_id`, links identities, maintains customer relationship state and exposes safe customer context to other Runtime contracts.

---

## Architecture Principles

Customer Domain must not calculate product price, apply discounts, accrue bonuses, mutate wallet balance, execute payment, change Order lifecycle, deliver notifications directly or enforce API route authorization.

Club status is not bonus balance.

Trusted customer status is not an authorization role.

Referral relationship is not reward execution.

Consent evidence is auditable and must not be overwritten by profile updates.

External identity links must preserve provenance, conflict handling and audit.

Customer activity history is a projection from accepted facts and approved audit records; it does not replace source domains.

---

## Consequences

Future Customer Runtime implementation must expose command, query and event contracts before UI or CRM screens depend on customer data.

Future Telegram, phone, email, VK, MAX and OAuth linking must resolve to `customer_id` before internal business contracts use customer identity.

Future Order, Payment, Bonus, Discount, Wallet, Notification, CRM, Analytics and Promotion integrations must consume customer context through approved contracts and events instead of duplicating customer state.

Final Club Timofey benefits, trusted customer criteria, referral qualification rules and reward amounts require Product Owner approval before implementation.

Any future code that treats Telegram ID, phone, email or provider customer ID as the primary platform customer identity requires correction or architecture review.

---

## Related Documentation

- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/CONSENT_MODEL.md`
- `docs/api/AUTHENTICATION.md`
- `docs/api/AUTHORIZATION.md`
- `docs/api/EVENT_API.md`
- `docs/domain/ANALYTICS_EVENTS.md`
- `docs/architecture/DISCOUNT_ENGINE.md`
- `docs/architecture/BONUS_ENGINE.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/crm_architecture.md`

---

# Decision: Event API Fact Boundary

**Date:** 2026-07-06

**Status:** Accepted

## Context

Soft ICE Platform needs asynchronous contracts for Orders, Payments, Wallet, Bonus, Products, Promotions, Machines, Customers, Notifications, Analytics and future integrations.

Without a documented Event API boundary, event routing could become mixed with product configuration, pricing, wallet balance changes, bonus rules, payment decisions, order state transitions, machine fulfillment, promotion eligibility, notification content or analytics meaning.

---

## Decision

Soft ICE Platform defines Event API as an asynchronous fact boundary.

Events are immutable.

Events describe facts.

Business logic belongs to Runtime.

Event API is transport independent.

Event Runtime validates envelope shape, routing, delivery policy, retries, replay, idempotency and dead-letter handling.

Event Runtime must not interpret business payload meaning or decide domain outcomes.

---

## Architecture Principles

Event producers are Runtimes.

Event names use the `<Domain>.<Fact>` format.

Event payload meaning is owned by the producing Runtime.

Event consumers must be idempotent.

Event delivery is at-least-once by default.

Global ordering is not assumed.

Ordering is scoped to an aggregate only when the producing Runtime and transport can provide sequence metadata.

Retry and dead-letter policy are infrastructure behavior. Business compensation remains inside Runtime.

Transport may evolve from in-process bus to queue, broker, stream, cloud event bus or webhook gateway without changing event contracts.

---

## Consequences

Future event implementation must use a formal registry entry before an event is published.

Future producers must authenticate, authorize and publish versioned envelopes with safe metadata.

Future consumers must declare supported event versions and deduplicate event processing.

Dead-letter redrive and replay require authorization and audit.

Any future Event Runtime behavior that calculates business outcomes or mutates domain state directly requires correction or architecture review.

---

## Related Documentation

- `docs/api/EVENT_API.md`
- `docs/api/API_OVERVIEW.md`
- `docs/api/AUTHENTICATION.md`
- `docs/api/AUTHORIZATION.md`
- `docs/kernel/PLATFORM_KERNEL.md`
- `docs/kernel/RUNTIME_REGISTRY.md`
- `docs/architecture/EVENT_PLATFORM.md`

---

# Decision: REST API Transport Boundary

**Date:** 2026-07-06

**Status:** Accepted

## Context

Soft ICE Platform needs synchronous API contracts for Mini App, web app, Telegram bot, CRM, machine adapters, partner integrations, analytics and future SDK clients.

Without a documented REST boundary, API route handlers could become mixed with product configuration, pricing, wallet, bonus, payment, order, machine, promotion, CRM or analytics business rules.

---

## Decision

Soft ICE Platform defines REST API as a synchronous transport boundary only.

REST endpoints expose capabilities only.

Business rules remain inside Runtime.

REST API is transport only.

REST routes may authenticate, authorize, validate request shape, enforce idempotency, apply rate limits, route commands and queries, return Runtime DTOs and expose safe operational metadata.

REST routes must not calculate product configuration, pricing, discounts, bonuses, payment outcomes, order transitions, machine fulfillment rules, notification content, promotion eligibility or analytics meaning.

---

## Architecture Principles

REST resources represent platform contracts, not database tables, repositories or internal engines.

REST route handlers must call approved Runtime contracts.

`GET` routes must not mutate business state.

Mutating routes must use idempotency where duplicate submission may cause side effects.

Authentication and authorization run before protected Runtime calls.

Errors, pagination, filtering, sorting, rate limits, correlation IDs and audit context are transport and platform concerns.

Runtime owns business validation, state transitions, financial meaning, product configuration, machine outcomes, promotion eligibility and analytics projections.

---

## Consequences

Future REST implementation must follow documented resource naming, method usage, request and response shape, error format, versioning, idempotency and security integration.

Future OpenAPI contracts should be generated or maintained from the documented REST boundary.

Future API handlers that access repositories directly or duplicate Runtime business logic require correction or architecture review.

REST contract tests should verify request shape, response shape, authentication, authorization, idempotency and error behavior without embedding business rules in route tests.

---

## Related Documentation

- `docs/api/REST_API.md`
- `docs/api/API_OVERVIEW.md`
- `docs/api/AUTHENTICATION.md`
- `docs/api/AUTHORIZATION.md`
- `docs/kernel/PLATFORM_KERNEL.md`
- `docs/business/PLATFORM_PRINCIPLES.md`

---

# Decision: Authorization Access Policy Boundary

**Date:** 2026-07-06

**Status:** Accepted

## Context

Soft ICE Platform API needs protected access for customers, machines, CRM operators, administrators, partners, API clients, providers and internal services.

Without a documented authorization boundary, API Gateway policy could become mixed with authentication, product eligibility, pricing, payment, order transitions, machine fulfillment, loyalty, promotion or CRM business rules.

---

## Decision

Soft ICE Platform defines authorization as access policy enforcement only.

Authentication answers who you are.

Authorization answers what you are allowed to do.

CustomerID is the primary platform identity.

TelegramID, phone, email, VK ID and external OAuth IDs are external identities only.

Authorization never contains business logic.

Runtime owns business rules.

API Gateway enforces access policy.

Authorization uses roles, scopes and permissions to decide whether an authenticated actor may call a route, use a contract, read a protected resource class or submit a command envelope.

Authorization must not decide product eligibility, price, discount eligibility, bonus usage, payment outcome, order lifecycle state, machine fulfillment validity, loyalty status, campaign eligibility or support workflow business outcome.

---

## Architecture Principles

Permissions are stable access units.

Roles group permissions for actor types.

Scopes limit where permissions apply.

Customer authorization must use `customer_id`, not TelegramID, phone, email, VK ID or external OAuth IDs.

Customer, operator, machine, partner, API client and internal service permissions must remain separate.

Least privilege and deny-by-default are required.

Sensitive authorization decisions, role assignments, revocations, CRM access, admin actions and partner or machine access changes must be auditable.

Runtime receives identity and authorization context but still validates domain rules through official contracts.

---

## Consequences

Future API Gateway implementation must enforce explicit route-level authorization policy before Runtime execution.

Future Runtime implementation must not treat API authorization as proof that a business action is valid.

Role assignment, permission grants, revocation and denied sensitive access require audit records.

External identity providers and aliases must resolve to platform identities before authorization decisions.

Any future authorization handler that embeds product, pricing, payment, order, machine, loyalty, promotion or CRM business logic requires correction or architecture review.

---

## Related Documentation

- `docs/api/AUTHORIZATION.md`
- `docs/api/AUTHENTICATION.md`
- `docs/api/API_OVERVIEW.md`
- `docs/kernel/PLATFORM_KERNEL.md`
- `docs/kernel/SERVICE_REGISTRY.md`
- `docs/business/PLATFORM_PRINCIPLES.md`

---

# Decision: Authentication Identity Boundary

**Date:** 2026-07-06

**Status:** Accepted

## Context

Soft ICE Platform API must support Mini App customers, web users, Telegram users, CRM operators, vending machines, machine adapters, payment and notification providers, partner systems, SDK clients and internal services.

Without a documented authentication boundary, identity verification could become mixed with authorization, product eligibility, pricing, payment, order, machine, loyalty or promotion rules.

---

## Decision

Soft ICE Platform defines authentication as identity verification only.

Authentication answers who or what is calling the platform.

Authorization is documented separately.

Authentication never contains business logic.

Runtime owns business behavior.

Authentication may verify credentials, validate token signatures, verify Telegram Mini App init data, verify machine and partner credentials, create identity context, create session context and reject invalid credentials before Runtime processing.

Authentication must not decide route permissions, product eligibility, price, discount, bonus usage, payment behavior, order transitions, machine fulfillment, loyalty rules, promotion participation or operator business permissions.

---

## Architecture Principles

Every protected request must produce normalized identity context before Runtime processing.

Customer, operator, machine, machine adapter, partner, provider and internal service identities must be distinguishable.

Credentials, secrets, raw tokens, Telegram init data, API keys and signatures must not be stored in repository files or written to logs.

API keys authenticate non-human integrations, not human users.

JWT access tokens must be short-lived and must not contain business state.

Refresh tokens must be revocable and must not reach Runtime contracts.

Machine and provider callbacks must be authenticated before their facts are routed to Runtime contracts or Event API.

---

## Consequences

Future authentication implementation must be built as platform security infrastructure, not as domain business logic.

Authorization documentation must define route access, scopes, roles and Runtime authorization boundaries separately.

Runtime contracts must receive safe identity context and remain responsible for domain validation and business decisions.

Authentication telemetry and audit records must be safe, correlated and free of secrets.

Any future authentication handler that embeds product, pricing, payment, order, machine, loyalty or promotion decisions requires correction or architecture review.

---

## Related Documentation

- `docs/api/AUTHENTICATION.md`
- `docs/api/API_OVERVIEW.md`
- `docs/kernel/PLATFORM_KERNEL.md`
- `docs/kernel/PLATFORM_CONFIGURATION.md`
- `docs/business/PLATFORM_PRINCIPLES.md`

---

# Decision: API Contract Boundary

**Date:** 2026-07-06

**Status:** Accepted

## Context

Soft ICE Platform has documented Platform Kernel, Runtime Registry and Service Registry boundaries. Future platform consumers now need a shared API direction for REST, events, webhooks, authentication, authorization, idempotency, versioning, errors, security, monitoring and SDKs.

Without an explicit API boundary, route handlers, webhook handlers or SDK clients could duplicate business logic that belongs in Runtimes and Engines.

---

## Decision

Soft ICE Platform defines the API as a contract and integration layer.

The API never contains business logic.

Runtime owns business logic.

API is a contract.

Configuration controls behavior when the platform model already supports it.

REST APIs, Event APIs and webhooks must expose Runtime-owned contracts and use Platform Services for domain-neutral concerns such as authentication context, validation, idempotency, logging, telemetry, health, audit and rate limiting.

API consumers must not access repositories, storage or internal engines directly.

---

## Architecture Principles

API may authenticate, authorize at transport level, validate schemas, enforce idempotency, apply rate limits, route requests, expose health and observe traffic.

API must not calculate product configuration, pricing, discounts, bonuses, payment decisions, order transitions, machine fulfillment rules, notification content or promotion logic.

Runtime validates domain rules and owns business authorization.

Event API transports accepted facts. Event Runtime validates envelope, routing and delivery policy without interpreting business payload meaning.

Webhooks authenticate, validate, deduplicate and route external facts to Runtime contracts or Event API without directly mutating domain state.

Future SDKs wrap contracts and must not contain business logic.

---

## Consequences

Future API implementation must call official Runtime contracts instead of internal engines or repositories.

Mutating API operations must support idempotency where duplicate submission is possible.

Authentication, authorization, validation, telemetry, audit and correlation context must be propagated through Runtime calls, events and webhooks.

REST, event, webhook, error and versioning contracts should be documented before implementation.

Any future API behavior that embeds business logic requires correction or an explicit architecture review.

---

## Related Documentation

- `docs/api/API_OVERVIEW.md`
- `docs/kernel/PLATFORM_KERNEL.md`
- `docs/kernel/RUNTIME_REGISTRY.md`
- `docs/kernel/SERVICE_REGISTRY.md`
- `docs/architecture/ARCHITECTURE_BASELINE_1_0.md`
- `docs/business/PLATFORM_PRINCIPLES.md`

---

# Decision: Platform Kernel Registry and Lifecycle Contracts

**Date:** 2026-07-03

**Status:** Accepted

## Context

The Platform Kernel boundary is documented, but implementation-ready platform work also needs explicit contracts for runtime discovery, runtime registration, service registration, engine registration, configuration loading, bootstrap order, health monitoring and graceful shutdown.

Without these contracts, future runtimes could be connected inconsistently, the Kernel could become coupled to business logic, and operational readiness could be inferred from process startup instead of validated runtime health.

---

## Decision

Soft ICE Platform introduces documentation-first Kernel contracts for:

- Runtime Registry;
- Service Registry;
- Platform Bootstrap;
- Platform Configuration;
- Platform Lifecycle.

Every Runtime must register through a manifest or equivalent registration contract.

Every Engine must be registered through its owning Runtime.

Platform Bootstrap must validate configuration, registries, runtime dependencies, engine registration and health checks before platform readiness is marked.

Platform Configuration must use explicit schemas, scoped runtime configuration and external secret references.

Platform Lifecycle must define operational states, health escalation, graceful shutdown, forced stop policy and recovery boundaries.

---

## Architecture Principles

The Kernel coordinates operational lifecycle only.

Runtime owns business logic.

Engine owns domain implementation.

Platform Services are domain-neutral.

Configuration Service validates shape and delivery. Runtime validates business meaning.

Health Monitor observes runtime, engine, service, adapter and event health but does not decide business compensation.

Graceful shutdown must stop accepting new work, drain accepted work where possible, preserve auditability and avoid silent loss of accepted business events.

---

## Consequences

Future Kernel implementation must follow the documented registry, bootstrap, configuration and lifecycle contracts.

New runtimes must provide manifest metadata, configuration schema references, owned engines, service dependencies, event producers and consumers, health checks and lifecycle hooks.

New engines must be registered by their owning Runtime and exposed through official contracts or facades.

Readiness must depend on required Runtime, Engine, Service and configuration health, not on process startup alone.

Any future deviation from these contracts requires an explicit architecture decision.

---

## Related Documentation

- `docs/kernel/RUNTIME_REGISTRY.md`
- `docs/kernel/SERVICE_REGISTRY.md`
- `docs/kernel/PLATFORM_BOOTSTRAP.md`
- `docs/kernel/PLATFORM_CONFIGURATION.md`
- `docs/kernel/PLATFORM_LIFECYCLE.md`
- `docs/kernel/PLATFORM_KERNEL.md`
- `docs/architecture/ARCHITECTURE_BASELINE_1_0.md`

---

# Decision: Platform Kernel Boundary

**Date:** 2026-07-03

**Status:** Accepted

## Context

Soft ICE Platform is evolving from isolated runtime modules into a coordinated platform with Product, Finance, Order, Event, Machine, Notification, CRM, Analytics, Promotion and future AI capabilities.

The platform needs a common coordination layer for startup, shutdown, configuration, runtime registration, service registration, event delivery, health monitoring, logging, telemetry and security primitives.

This coordination layer must not become a place where product, pricing, payment, order, machine or loyalty business rules are hidden.

---

## Decision

The platform introduces the **Platform Kernel** as an infrastructure coordination layer.

The Kernel coordinates Runtime.

Runtime owns business logic.

Engine owns implementation.

Configuration is preferred over code changes when the platform model already supports the behavior.

The Platform Kernel must never contain business logic. It may start, stop, register, observe and connect runtimes, but it must not decide product configuration, price calculation, payment behavior, order transitions, machine fulfillment rules, customer communication content or promotion mechanics.

---

## Architecture Principles

Platform Kernel must provide:

- runtime registry;
- service registry;
- event bus infrastructure;
- configuration loading and validation;
- logging and telemetry infrastructure;
- health monitoring;
- startup and shutdown lifecycle coordination;
- security context primitives;
- feature flag access;
- dependency ordering between runtimes.

The Kernel may reject invalid configuration, missing required dependencies or unsafe runtime registration.

The Kernel must stay domain-neutral.

---

## Consequences

Future runtime implementation must keep business logic in runtimes and engines.

New product categories, payment providers, machine adapters, notification channels and promotion campaigns should be introduced through runtime contracts, adapters and configuration rather than Kernel changes.

Any future Kernel implementation must be preceded by explicit contracts for runtime registration, service registration, event envelope, health checks and configuration schemas.

---

## Related Documentation

- `docs/kernel/PLATFORM_KERNEL.md`
- `docs/architecture/ARCHITECTURE_BASELINE_1_0.md`
- `docs/releases/RELEASE_1_0.md`
- `docs/business/PLATFORM_PRINCIPLES.md`

---

# Decision: Promotion Platform Vision

**Date:** 2026-07-03

**Status:** Accepted

## Context

В процессе проектирования Soft ICE Platform было принято решение отказаться от реализации разрозненных маркетинговых акций, конкурсов и розыгрышей.

Практика большинства компаний основана на ручном управлении подобными мероприятиями, что приводит к дополнительным трудозатратам, человеческим ошибкам, отсутствию прозрачности и невозможности масштабирования.

Soft ICE Platform проектируется как автоматизированная система управления продуктом, клиентами, финансовыми операциями, заказами и маркетинговыми процессами.

Поэтому маркетинговые активности должны стать частью архитектуры платформы, а не набором отдельных ручных сценариев.

---

## Decision

В платформу вводится отдельная подсистема:

**Promotion Platform / Promotion Runtime**

Promotion Platform является самостоятельным Runtime платформы Soft ICE и отвечает за проведение маркетинговых кампаний, конкурсов, розыгрышей, сезонных активностей и программ стимулирования клиентов.

После публикации кампании её выполнение должно происходить автоматически.

Изменение программного кода для запуска новой акции не допускается.

Все новые кампании создаются путём конфигурирования системы, а не через разработку отдельного сценария под каждую акцию.

---

## Architecture Principles

Promotion Platform должна обеспечивать:

- автоматическое выполнение кампаний;
- автоматическое начисление билетов или шансов участия;
- автоматическую проверку условий участия, если проверка может быть выполнена системой;
- автоматическое определение победителей;
- автоматическое уведомление участников;
- автоматическое формирование истории кампаний;
- журнализацию всех действий;
- возможность независимого аудита результатов;
- прозрачность правил для участников;
- поддержку разных каналов: Telegram, VK, Mini App, сайт, CRM, автомат.

---

## Manual Operations

Ручное вмешательство допускается только в случаях, когда требуется модерация пользовательского контента или разбор спорной ситуации.

Примеры допустимого ручного вмешательства:

- проверка фотографий;
- проверка жалоб;
- подтверждение нестандартной ситуации;
- ручное решение спорного кейса администратором.

Все остальные процессы должны быть автоматизированы.

---

## Campaign Examples

Платформа должна поддерживать проведение разных кампаний без изменения архитектуры.

Примеры кампаний:

- 🎁 Клубные подарки Тимоши
- 🍀 Сезон удачи от Тимоши
- 🎡 Колесо удачи Тимоши
- 🎉 Фестиваль подарков
- ⭐ Неделя сюрпризов
- 🎈 Праздник клуба Тимоши

Перечень кампаний не ограничивается указанными примерами и может расширяться через конфигурацию.

---

## Future Runtime

После завершения базовой архитектуры создаётся отдельный EPIC:

**EPIC-500 Promotion Platform**

В него войдут:

- Campaign Engine;
- Contest Engine;
- Prize Engine;
- Winner Engine;
- Referral Campaign Engine;
- Seasonal Campaign Engine;
- Promotion Analytics;
- Promotion Dashboard;
- Campaign Automation.

---

## Expected Result

Маркетинговые кампании становятся частью архитектуры платформы.

Любая новая акция создаётся без изменения исходного кода.

Promotion Platform становится единым центром управления маркетинговыми активностями Soft ICE Platform.

Маркетинговые механики проектируются как повторно используемые компоненты, а не как одноразовые акции.

---

## Status

**Accepted**

Architecture Decision approved.
