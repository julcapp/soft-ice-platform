# PROJECT_DECISIONS.md

> Файл должен лежать в репозитории по пути:
>
> `docs/architecture/PROJECT_DECISIONS.md`

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
