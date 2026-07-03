# Runtime Registry

Status: Draft
Version: 0.1
Date: 2026-07-03
Project: Soft ICE Platform / Utimoshi
Scope: Documentation only

## Purpose

This document defines the Runtime Registry for Soft ICE Platform.

The Runtime Registry is the Platform Kernel record of known runtimes, their ownership boundaries, dependencies, lifecycle hooks, health checks and public contracts.

The Runtime Registry does not implement business logic. It records how runtimes are discovered, validated, started, observed and stopped.

Core rule:

```text
Kernel registers Runtime.
Runtime owns business logic.
Runtime registers Engine.
Engine owns implementation.
```

## 1. Runtime Definition

A Runtime is a platform capability that owns behavior at execution time.

A Runtime may:

- expose public commands and queries;
- own domain models and contracts;
- own engines and services;
- validate domain-specific configuration;
- produce and consume platform events;
- maintain operational state;
- publish health checks;
- participate in startup and graceful shutdown.

A Runtime must not bypass another Runtime's public contract, event contract or registered service boundary.

## 2. Runtime Registry Responsibilities

The Runtime Registry is responsible for:

- accepting runtime registrations;
- validating runtime manifest shape;
- rejecting duplicate runtime IDs;
- recording runtime version and lifecycle state;
- recording runtime-owned engines;
- recording provided and required services;
- recording event producers and event consumers;
- recording configuration schema references;
- recording health checks;
- recording startup and shutdown hooks;
- resolving dependency order with the Platform Bootstrap process;
- exposing runtime state to Health Monitor and Telemetry.

The Runtime Registry is not responsible for:

- calculating prices;
- validating product selections;
- deciding payment, order, refund, bonus or promotion rules;
- sending machine commands;
- selecting customer messages;
- modifying runtime-owned storage directly.

## 3. Runtime Manifest

Every Runtime must register through a manifest or equivalent registration contract.

Required manifest fields:

| Field | Meaning |
|---|---|
| `runtime_id` | Stable semantic ID used by Kernel, logs, events and health monitoring. |
| `runtime_name` | Human-readable runtime name. |
| `runtime_version` | Runtime contract or implementation version. |
| `runtime_type` | `kernel`, `domain`, `composite`, `integration`, `projection`, or `future`. |
| `criticality` | `critical`, `important`, `supporting`, or `roadmap`. |
| `owned_engines` | Engine IDs registered by this Runtime. |
| `provided_services` | Service IDs exposed through the Service Registry. |
| `required_services` | Platform or runtime services required before startup. |
| `optional_services` | Services that enable extra behavior with declared fallback. |
| `configuration_schema` | Runtime configuration schema reference. |
| `event_producers` | Events this Runtime may publish. |
| `event_consumers` | Events this Runtime may consume. |
| `public_contracts` | Command, query and event contract references. |
| `health_checks` | Runtime, engine, dependency and integration health checks. |
| `startup_hook` | Hook called by Platform Bootstrap during startup. |
| `shutdown_hook` | Hook called during graceful shutdown. |
| `dependencies` | Runtime startup and contract dependencies. |

Optional manifest fields:

| Field | Meaning |
|---|---|
| `degraded_mode` | Declared behavior when optional dependencies fail. |
| `readiness_timeout_ms` | Maximum startup wait before readiness failure. |
| `shutdown_timeout_ms` | Maximum graceful shutdown wait before forced stop policy. |
| `owner` | Team, module or product owner responsible for the Runtime. |
| `data_stores` | Runtime-owned stores or repositories. |
| `adapters` | External provider, device or channel adapters. |

## 4. Runtime ID Rules

Runtime IDs must be stable, semantic and lowercase.

Recommended format:

```text
runtime_<capability>
```

Examples:

```text
runtime_platform
runtime_configuration
runtime_payment
runtime_machine
runtime_notification
```

Rules:

- runtime IDs must not encode implementation technology;
- runtime IDs must not include environment names;
- runtime IDs must not be reused for a different capability;
- deprecated runtime IDs remain reserved;
- event metadata must use the same runtime ID for source attribution.

## 5. Runtime Catalog

The following Runtime catalog is the current Platform Kernel documentation baseline.

| Runtime ID | Runtime | Type | Criticality | Responsibility | Owned engines or engine groups | Required dependencies |
|---|---|---|---|---|---|---|
| `runtime_platform` | Platform Runtime | Kernel infrastructure | Critical | Provides platform contracts, configuration, registries, logging, telemetry, validation, security, identity, feature flags and lifecycle coordination. | Platform services, Runtime Registry, Service Registry, Health Monitor, Event Bus infrastructure. | Environment, platform configuration, Logger, Telemetry, Security Context. |
| `runtime_product` | Product Runtime | Composite | Critical | Groups product-centered capabilities used by all channels and order flows. | Catalog, Configuration, Media, Recipe and Pricing engine groups. | Platform services, Event Runtime when events are enabled. |
| `runtime_catalog` | Catalog Runtime | Domain | Critical | Owns product, flavor, syrup, topping and availability source data. | Catalog Engine. | Platform configuration, validation, optional Event Runtime. |
| `runtime_configuration` | Configuration Runtime | Domain | Critical | Builds and validates permitted product configurations. | Configuration Engine. | Catalog Runtime, platform validation. |
| `runtime_media` | Media Runtime | Domain | Important | Resolves product, ingredient and brand media assets with approved fallback rules. | Media Engine. | Catalog Runtime, Configuration Runtime, media storage or repository. |
| `runtime_recipe` | Recipe Runtime | Domain | Critical | Converts valid product configuration into a machine-independent recipe. | Recipe Engine. | Configuration Runtime, Catalog Runtime. |
| `runtime_pricing` | Pricing Runtime | Domain | Critical | Calculates price, currency, bonus allowance and pricing result before payment. | Pricing Engine. | Catalog Runtime, Configuration Runtime, Recipe Runtime, optional Discount and Bonus contracts. |
| `runtime_finance` | Finance Runtime | Composite | Critical | Groups financial domains and protects separation between money, bonus rights, discounts, payments, ledger and accounting. | Transaction, Ledger, Wallet, Bonus, Discount, Payment and Accounting Adapter engine groups. | Platform services, Event Runtime, Configuration Runtime for finance config. |
| `runtime_ledger` | Ledger Runtime | Domain | Critical | Owns immutable financial facts and append-only journal behavior. | Ledger Engine. | Finance Runtime, Idempotency Service, Audit Log Service, Event Runtime. |
| `runtime_wallet` | Wallet Runtime | Domain projection | Important | Exposes internal balance projections derived from ledger facts. | Wallet Engine. | Ledger Runtime, Finance Runtime, Event Runtime. |
| `runtime_bonus` | Bonus Runtime | Domain | Important | Owns non-monetary bonus rights, reservation, redemption, expiration and reversal rules. | Bonus Engine. | Finance Runtime, Ledger Runtime or approved finance event source. |
| `runtime_discount` | Discount Runtime | Domain | Important | Owns non-monetary price reduction rules calculated before payment. | Discount Engine. | Pricing Runtime, Bonus Runtime when bonus effects are converted to discounts. |
| `runtime_payment` | Payment Runtime | Domain integration | Critical | Executes settlement, provider abstraction, capture, cancellation and refund execution when no separate Refund Runtime exists. | Payment Engine, provider adapters, future Refund Engine boundary. | Finance Runtime, Ledger Runtime, Order Runtime contract, Idempotency Service, external payment provider configuration. |
| `runtime_accounting_adapter` | Accounting Adapter Runtime | Integration | Supporting | Translates ledger-backed financial facts for external accounting systems. | Accounting Adapter. | Ledger Runtime, Finance Runtime, Audit Log Service. |
| `runtime_order` | Order Runtime | Domain | Critical | Owns purchase aggregate, immutable snapshots, lifecycle transitions, checkout orchestration, fulfillment references, cancellation and refund business states. | Order Engine, Checkout Engine, Order State Machine, Fulfillment Engine, Cancellation Engine, Refund process boundary, Dispatch coordination boundary. | Catalog, Configuration, Recipe, Pricing, Payment, Ledger, Event and Machine contracts as flow requires. |
| `runtime_event` | Event Runtime | Platform infrastructure | Critical | Validates envelopes, routes events, stores or forwards facts, supports retry, replay, idempotency and dead-letter flows. | Event Bus, Event Store, Event Delivery, Replay and Dead Letter engines or services. | Platform Runtime, Idempotency Service, Logger, Telemetry. |
| `runtime_machine` | Machine Runtime | Domain integration | Critical | Owns machine selection, queue, command delivery, acknowledgements, telemetry, device adapters and physical outcome facts. | Machine Engine, Machine Dispatch Engine, Device Adapter group, Telemetry adapter group. | Order Runtime, Recipe Runtime, Event Runtime, machine configuration. |
| `runtime_notification` | Notification Runtime | Domain integration | Important | Consumes events, resolves templates and channels, sends messages and records delivery facts. | Notification Engine, Template Engine, Channel Adapter group. | Event Runtime, Customer/CRM Runtime when customer context is required. |
| `runtime_customer_crm` | Customer and CRM Runtime | Domain projection | Important | Owns customer identity/profile boundaries, CRM projections, support context and operator action audit. | Customer Engine, CRM Projection Engine, Support Workflow Engine. | Event Runtime, Identity Context Service, Audit Log Service. |
| `runtime_analytics` | Analytics Runtime | Projection | Supporting | Builds reporting, funnels and operational metrics from UI analytics and formal domain events. | Analytics Engine, Reporting Projection Engine. | Event Runtime, Telemetry, privacy and retention configuration. |
| `runtime_promotion` | Promotion Runtime | Domain | Roadmap | Owns configurable campaigns, contests, prize rules, winner selection, referral campaigns and seasonal activities. | Campaign, Contest, Prize, Winner, Referral Campaign and Seasonal Campaign engines. | Customer/CRM, Bonus, Discount, Notification, Event and Analytics contracts as campaign scope requires. |
| `runtime_ai` | AI Runtime | Future | Roadmap | Owns recommendations, demand forecast, inventory AI, marketing AI and conversation AI with traceable model versions. | Recommendation, Demand Forecast, Inventory AI, Marketing AI and Conversation AI engines. | Event Runtime, Analytics Runtime, privacy configuration, model registry when introduced. |

## 6. Runtime Registration Sequence

Runtime registration follows this sequence:

1. Runtime manifest is discovered by Platform Bootstrap.
2. Runtime Registry validates manifest structure.
3. Runtime Registry rejects duplicate `runtime_id`.
4. Configuration Service validates the runtime configuration schema reference.
5. Service Registry validates required platform services.
6. Runtime declares owned engines and engine registration metadata.
7. Event Runtime validates declared producer and consumer names when Event Runtime is enabled.
8. Health Monitor records runtime health checks.
9. Dependency graph is built.
10. Platform Bootstrap starts runtimes in dependency order.
11. Runtime Registry records runtime lifecycle state.
12. Runtime readiness is exposed to Health Monitor and Telemetry.

Registration must complete before platform readiness is marked.

## 7. Engine Registration Through Runtime

Engines are registered by their owning Runtime.

Rules:

- Engine registration must include the owning `runtime_id`.
- Engine IDs must be unique within the platform.
- A Runtime must not register an Engine owned by another Runtime.
- An Engine may require platform services through its Runtime.
- An Engine must expose an official contract or facade.
- An Engine must not be resolved directly by UI components.
- Engine health contributes to Runtime health.

Engine registration details are defined in `docs/kernel/SERVICE_REGISTRY.md`.

## 8. Dependency Rules

Runtime dependencies must protect domain boundaries.

Allowed dependency types:

| Dependency type | Description |
|---|---|
| Platform service dependency | Runtime requires Logger, Telemetry, Configuration, Event Bus, Security, Identity or other platform service. |
| Runtime contract dependency | Runtime calls another Runtime only through an official command or query contract. |
| Event dependency | Runtime consumes facts published through Event Runtime. |
| Configuration dependency | Runtime needs validated configuration before startup. |
| Adapter dependency | Runtime needs an external provider, device or channel adapter. |

Rules:

- no circular required runtime dependencies;
- optional dependencies must declare fallback behavior;
- startup dependency order must be deterministic;
- business data must not be read directly from another Runtime's storage;
- UI and channels must use runtime contracts or application services, not repositories or engines directly;
- Kernel may coordinate dependencies but must not interpret domain meaning.

## 9. Health Model

The Runtime Registry exposes runtime state to Health Monitor.

Runtime health states:

| State | Meaning |
|---|---|
| `registered` | Manifest accepted, not yet configured. |
| `configured` | Required configuration validated. |
| `starting` | Startup hook is running. |
| `ready` | Runtime can accept intended work. |
| `degraded` | Runtime can provide reduced service or optional behavior is unavailable. |
| `unavailable` | Runtime cannot provide required behavior. |
| `stopping` | Graceful shutdown is in progress. |
| `stopped` | Runtime stopped cleanly. |
| `failed` | Runtime failed startup or shutdown safety policy. |

Health checks must be:

- lightweight;
- idempotent;
- safe to run repeatedly;
- observable through logs and telemetry;
- scoped to runtime responsibility;
- free of side effects that change business state.

## 10. Runtime Readiness Rules

Runtime readiness requires:

- manifest accepted;
- required configuration validated;
- required services available;
- required runtime dependencies ready;
- owned engines registered;
- required event producers and consumers registered when Event Runtime is enabled;
- startup hook completed;
- required health checks passing.

If a critical Runtime is unavailable, the platform must not mark full readiness.

If a non-critical Runtime is degraded, the platform may mark partial readiness only when the affected customer flow is not required for the current deployment.

## 11. Runtime Shutdown Rules

Runtime shutdown is coordinated by Platform Lifecycle.

Rules:

- shutdown order is reverse dependency order;
- runtimes must stop accepting new work before releasing dependencies;
- event consumers must drain or stop according to configured timeout;
- accepted business events must not be silently lost;
- audit logs, telemetry and logs must flush before process exit where possible;
- forced stop must be observable and produce failure telemetry.

Graceful shutdown details are defined in `docs/kernel/PLATFORM_LIFECYCLE.md`.

## 12. Acceptance Criteria

Runtime Registry documentation is acceptable when:

- every known Runtime is listed with responsibility and boundary;
- runtime manifest fields are defined;
- runtime registration rules are defined;
- engine registration through Runtime is defined;
- dependency rules are defined;
- runtime health states are defined;
- runtime readiness and shutdown rules are defined;
- Platform Kernel remains free of business logic;
- no application code is modified by this documentation increment.
