# Platform Kernel

Status: Draft
Version: 0.1
Date: 2026-07-03
Project: Soft ICE Platform / Utimoshi
Scope: Documentation only

## Purpose

This document defines the Platform Kernel model for Soft ICE Platform.

The Platform Kernel is the infrastructure coordination layer of the platform. It starts, connects, observes and safely stops runtimes. It does not contain product, pricing, payment, loyalty, order, machine or marketing business logic.

Core rule:

```text
Kernel coordinates Runtime.
Runtime owns business logic.
Engine owns implementation.
Configuration controls behavior.
```

## 1. Platform Vision

Soft ICE Platform is a product-centered, engine-based platform for configurable desserts, vending operations, payments, loyalty, CRM, analytics and future AI modules.

The Platform Kernel exists to make the platform extensible and operationally safe. It provides the common infrastructure needed by all runtimes so that new product categories, channels and domains can be added without rewriting the platform foundation.

The Kernel must support the Architecture Baseline 1.0 principle that the platform is designed around product configuration and domain engines, not around a single vending machine interface.

## 2. Kernel Responsibilities

The Platform Kernel is responsible for infrastructure coordination only.

Kernel responsibilities:

- bootstrap platform startup;
- load and validate configuration;
- register runtimes and platform services;
- expose a runtime registry;
- expose a service registry;
- provide event bus infrastructure;
- provide logging and telemetry infrastructure;
- provide health check aggregation;
- provide lifecycle hooks for startup and shutdown;
- provide security primitives and policy enforcement points;
- provide feature flag and configuration access;
- coordinate dependency ordering between runtimes;
- report runtime readiness and failure states.

Kernel non-responsibilities:

- product catalog decisions;
- product configuration validation;
- recipe generation;
- price calculation;
- bonus, discount, wallet or payment business decisions;
- order state transitions;
- machine command business rules;
- customer communication templates;
- promotion campaign rules;
- UI rendering or navigation.

## 3. Runtime Model

A Runtime is a logical platform module that owns one business or infrastructure capability.

Examples of future or current runtimes:

- Product Runtime;
- Finance Runtime;
- Order Runtime;
- Machine Runtime;
- Notification Runtime;
- CRM Runtime;
- Analytics Runtime;
- Promotion Runtime;
- AI Runtime.

A Runtime owns:

- domain model;
- domain contracts;
- services;
- engines;
- repositories or adapters;
- business events it produces;
- business events it consumes;
- runtime-specific configuration schema;
- runtime health checks.

The Kernel may start, stop and monitor a Runtime, but it must not decide the Runtime's business behavior.

## 4. Engine Model

An Engine is the implementation unit inside a Runtime.

An Engine owns a specific domain responsibility and exposes it through official contracts. For example:

- Catalog Engine owns product data access and catalog rules;
- Configuration Engine owns valid product configuration;
- Recipe Engine owns machine-independent recipe generation;
- Pricing Engine owns price calculation;
- Payment Engine owns payment settlement execution;
- Machine Engine owns equipment communication;
- Notification Engine owns delivery through communication channels.

Engine rules:

- an Engine must have one clear responsibility;
- an Engine must expose official methods through a stable contract;
- an Engine must not reach into UI components;
- an Engine must not bypass another Engine's contract;
- an Engine must not depend on another Engine's internal storage;
- business behavior belongs in the Runtime and Engine, not in the Kernel.

## 5. Platform Services

Platform Services are infrastructure services provided by the Kernel or registered through the Kernel.

Initial Platform Services:

- Configuration Service;
- Runtime Registry;
- Service Registry;
- Event Bus;
- Logger;
- Telemetry;
- Health Monitor;
- Feature Flag Service;
- Validation Service;
- Security Context Service;
- Identity Context Service;
- Idempotency Service;
- Clock Service;
- Scheduler;
- Audit Log Service.

Platform Services must be domain-neutral. They may transport, validate, record, secure or observe platform activity, but they must not interpret business meaning.

## 6. Event Bus

The Event Bus is the Kernel-provided infrastructure for publishing and subscribing to platform events.

Event Bus responsibilities:

- register event producers and consumers;
- validate event envelope structure;
- route events to subscribers;
- preserve event metadata;
- support idempotency keys;
- support retry and dead-letter behavior;
- expose delivery health and failure metrics.

Event Bus rules:

- business events are defined by runtimes, not by the Kernel;
- event names must be semantic and versioned when needed;
- event payloads must follow official contracts;
- handlers must be idempotent;
- the Kernel must not branch on product, order, payment or customer business meaning;
- event delivery failures must be observable.

MVP implementation may use an in-process event bus. Future implementation may replace it with a message broker without changing runtime contracts.

## 7. Configuration Layer

The Configuration Layer controls platform behavior through explicit configuration instead of code changes.

Configuration categories:

- platform configuration;
- runtime configuration;
- engine configuration;
- feature flags;
- environment-specific settings;
- integration settings;
- business rule data owned by runtimes.

Configuration rules:

- configuration schemas must be explicit;
- configuration must be validated during startup;
- invalid required configuration must fail startup safely;
- secrets must not be stored in repository files;
- business data must remain outside UI components;
- behavior changes should prefer configuration over application code when the model already supports it.

The Kernel loads and validates configuration, but each Runtime owns the meaning of its domain configuration.

## 8. Runtime Registration

Every Runtime must register with the Kernel through a runtime manifest or equivalent registration contract.

Runtime registration should include:

- runtime ID;
- runtime name;
- runtime version;
- owned engines;
- provided services;
- required services;
- event producers;
- event consumers;
- configuration schema;
- startup hook;
- shutdown hook;
- health checks;
- dependency requirements;
- public contracts.

Registration rules:

- runtimes must register before startup completes;
- duplicate runtime IDs are not allowed;
- missing required dependencies must block runtime readiness;
- optional dependencies must declare fallback behavior;
- runtime registration must be observable in health monitoring.

## 9. Dependency Rules

Dependency direction must protect domain boundaries.

Allowed dependency direction:

```text
UI / Channel
  -> Runtime contracts or application services
  -> Runtime
  -> Engine
  -> Repository / Adapter
  -> Platform Services
```

Kernel dependency rules:

- Kernel may depend on platform contracts and infrastructure primitives;
- Kernel must not depend on domain implementation details;
- Runtime may depend on Kernel interfaces and Platform Services;
- Runtime may depend on other runtimes only through official contracts or events;
- Engine may depend on its own domain model and approved platform abstractions;
- UI must not access business data storage directly;
- UI must not calculate final prices or select product media directly.

No circular dependencies are allowed between Kernel, Runtime, Engine and UI layers.

## 10. Health Monitoring

The Kernel must provide a unified health model for platform readiness and operation.

Health levels:

- platform health;
- runtime health;
- engine health;
- service health;
- integration health;
- event delivery health;
- configuration health.

Health states:

- starting;
- ready;
- degraded;
- unavailable;
- stopping;
- stopped.

Health checks must be lightweight, observable and safe to run repeatedly. A Runtime may be degraded while the platform remains partially available if the affected capability is non-critical for the current customer flow.

## 11. Security Principles

The Kernel provides shared security primitives and enforcement points. It does not own business authorization rules that belong to runtimes.

Security principles:

- least privilege by default;
- secrets are external to repository source code;
- no credentials in logs, events or documentation examples;
- security context is propagated through runtime calls and events;
- payment, wallet and customer data access must be auditable;
- event consumers must validate trusted source and payload structure;
- configuration changes must be traceable;
- administrative actions must be logged;
- integrations must use explicit adapters and defined credentials.

The Kernel may reject unsafe startup configuration or runtime registration that violates required security policy.

## 12. Startup Sequence

The expected startup sequence is:

1. Load platform environment.
2. Load platform configuration.
3. Validate configuration schema.
4. Initialize Logger and Telemetry.
5. Initialize Security Context Service.
6. Initialize Runtime Registry and Service Registry.
7. Initialize Event Bus.
8. Register Platform Services.
9. Discover or load Runtime registrations.
10. Validate Runtime dependencies.
11. Start Runtimes in dependency order.
12. Register Runtime event producers and consumers.
13. Run health checks.
14. Mark platform readiness.

Startup must fail safely if a required service, required configuration or required runtime dependency is invalid.

## 13. Shutdown Sequence

The expected shutdown sequence is:

1. Mark platform state as stopping.
2. Stop accepting new runtime work where possible.
3. Notify runtimes about shutdown.
4. Drain in-flight events and jobs within configured timeout.
5. Stop event consumers.
6. Stop runtimes in reverse dependency order.
7. Flush audit logs, telemetry and logs.
8. Release external connections and adapters.
9. Mark platform state as stopped.

Shutdown must preserve auditability and avoid silent loss of accepted business events.

## 14. Fault Tolerance

The Kernel must help runtimes fail visibly and recover safely.

Fault tolerance rules:

- runtime failures must be isolated when possible;
- required dependency failures must produce degraded or unavailable health state;
- retries must use bounded retry policies;
- repeated failures must move to dead-letter or manual review flows;
- event handling must be idempotent;
- startup failures must be explicit;
- configuration rollback must be possible for unsafe changes;
- critical financial and order flows must prefer consistency over silent continuation.

The Kernel coordinates failure handling infrastructure. The Runtime decides business compensation rules.

## 15. Extensibility

The Kernel must make platform extension predictable.

New capabilities should be added by:

- defining the domain model;
- defining contracts;
- defining runtime configuration;
- implementing one or more engines;
- registering runtime manifest;
- registering event producers and consumers;
- adding health checks;
- documenting task, release and acceptance criteria.

Extensibility rules:

- new product categories must not require Kernel changes;
- new payment providers must be added through adapters;
- new machine types must be added through adapters;
- new channels must consume contracts instead of duplicating business logic;
- new promotions must be configuration-driven when the model supports them;
- new AI modules must observe platform contracts and data boundaries.

## 16. Acceptance Criteria

The Platform Kernel architecture is acceptable when:

- `docs/kernel/PLATFORM_KERNEL.md` defines Kernel scope and boundaries;
- Kernel is explicitly documented as free of business logic;
- Runtime is documented as the owner of business logic;
- Engine is documented as the owner of domain implementation;
- Event Bus responsibilities and limits are documented;
- Configuration Layer rules are documented;
- Runtime Registration rules are documented;
- Dependency Rules protect UI, Runtime, Engine and Kernel boundaries;
- startup and shutdown sequences are documented;
- health, security, fault tolerance and extensibility principles are documented;
- no application code, frontend code or UI code is modified by this documentation increment.

Future implementation acceptance criteria:

- Kernel APIs are introduced only after contracts are documented;
- runtimes can be registered without changing UI code;
- invalid runtime configuration fails safely;
- health state is visible for platform and runtimes;
- event delivery failures are observable;
- business logic remains outside the Kernel.

## 17. Future Roadmap

Recommended roadmap:

1. Create `docs/kernel/PLATFORM_CONFIGURATION.md` with configuration schema principles.
2. Create `docs/kernel/RUNTIME_REGISTRY.md` with runtime manifest format.
3. Create `docs/kernel/SERVICE_REGISTRY.md` with platform service registration rules.
4. Create `docs/kernel/PLATFORM_BOOTSTRAP.md` with implementation-ready startup design.
5. Create `docs/kernel/PLATFORM_LIFECYCLE.md` with detailed lifecycle states.
6. Define Event Bus contract and event envelope.
7. Define health check contract.
8. Define feature flag contract.
9. Define security context contract.
10. Implement Kernel only after contracts and task acceptance criteria are approved.

The Platform Kernel should remain small, stable and boring. Its value is coordination, observability and safety, while business evolution stays in runtimes and engines.
