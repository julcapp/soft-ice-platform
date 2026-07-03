# Service Registry

Status: Draft
Version: 0.1
Date: 2026-07-03
Project: Soft ICE Platform / Utimoshi
Scope: Documentation only

## Purpose

This document defines the Service Registry for Soft ICE Platform.

The Service Registry is the Platform Kernel record of platform services, runtime services, engine facades and integration adapters that may be resolved by approved platform code.

The Service Registry is not a service locator for UI components. UI and channels must use official runtime contracts or application services.

Core rule:

```text
Platform Services are domain-neutral.
Runtime Services expose Runtime capability.
Engines own domain implementation.
Adapters isolate external systems.
```

## 1. Service Types

The Service Registry supports these service types:

| Type | Description |
|---|---|
| `platform_service` | Domain-neutral infrastructure service provided by Platform Kernel or registered through it. |
| `runtime_service` | Public command or query service exposed by a Runtime. |
| `engine_facade` | Stable facade for an Engine owned by a Runtime. |
| `repository` | Runtime-owned persistence abstraction. |
| `adapter` | Integration boundary for provider, channel, device or external system. |
| `projection` | Read model or reporting projection derived from events or source data. |

Services must declare their type during registration.

## 2. Platform Service Registry

Initial Platform Services:

| Service ID | Service | Type | Responsibility | Domain-neutral rule |
|---|---|---|---|---|
| `service_configuration` | Configuration Service | Platform service | Loads, merges, validates and exposes scoped configuration snapshots. | Validates schemas and delivery, not business meaning. |
| `service_runtime_registry` | Runtime Registry | Platform service | Records runtime manifests, dependencies, lifecycle state and readiness. | Does not execute runtime business logic. |
| `service_service_registry` | Service Registry | Platform service | Records platform services, runtime services, engine facades and adapters. | Does not choose business behavior. |
| `service_event_bus` | Event Bus | Platform service | Routes events, validates envelopes and supports event delivery policy. | Does not interpret payload business meaning. |
| `service_logger` | Logger | Platform service | Provides structured logging with correlation metadata. | Must not log secrets or raw payment credentials. |
| `service_telemetry` | Telemetry | Platform service | Emits metrics, traces and runtime observations. | Observes behavior without owning domain state. |
| `service_health_monitor` | Health Monitor | Platform service | Aggregates platform, runtime, engine, service and integration health. | Reports readiness and degradation without deciding business compensation. |
| `service_feature_flags` | Feature Flag Service | Platform service | Evaluates rollout flags and kill switches from validated configuration. | Does not encode business rules that belong to runtimes. |
| `service_validation` | Validation Service | Platform service | Provides schema validation primitives. | Validates shape; runtime validates business rules. |
| `service_security_context` | Security Context Service | Platform service | Propagates authentication, authorization context and trust metadata. | Does not own runtime-specific authorization rules. |
| `service_identity_context` | Identity Context Service | Platform service | Carries actor, customer, operator and system identity context. | Does not own customer profile state. |
| `service_idempotency` | Idempotency Service | Platform service | Records idempotency keys and prevents duplicate accepted side effects. | Does not decide whether a domain action is allowed. |
| `service_clock` | Clock Service | Platform service | Provides consistent time source for runtime operations. | Does not decide expiry rules without runtime policy. |
| `service_scheduler` | Scheduler | Platform service | Runs scheduled platform or runtime jobs through registered callbacks. | Does not embed campaign, payment, order or machine rules. |
| `service_audit_log` | Audit Log Service | Platform service | Records administrative, financial, order, machine and configuration audit facts. | Records facts; runtimes define required audit events. |

## 3. Service Registration Manifest

Every registered service must provide a manifest.

Required fields:

| Field | Meaning |
|---|---|
| `service_id` | Stable semantic ID. |
| `service_name` | Human-readable name. |
| `service_type` | One of the supported service types. |
| `owner_runtime_id` | Runtime that owns or provides the service. Platform services use `runtime_platform`. |
| `version` | Contract or implementation version. |
| `contract` | Public API, command, query, event or adapter contract reference. |
| `required_services` | Services required before this service can start. |
| `configuration_schema` | Configuration schema reference if the service is configurable. |
| `health_checks` | Health checks contributed by the service. |
| `lifecycle_hooks` | Startup, readiness, drain and shutdown hooks if applicable. |

Rules:

- duplicate service IDs are not allowed;
- service contracts must be stable and versioned when used across runtime boundaries;
- services must not expose runtime-owned storage as a public shortcut;
- services must declare whether they are startup-critical;
- services with side effects must support idempotency where duplicate calls are possible;
- external adapter services must declare timeout, retry and failure behavior.

## 4. Engine Registration

An Engine is registered as an `engine_facade` service or as part of a runtime service manifest.

Required Engine registration fields:

| Field | Meaning |
|---|---|
| `engine_id` | Stable semantic Engine ID. |
| `engine_name` | Human-readable Engine name. |
| `owner_runtime_id` | Runtime that owns the Engine. |
| `engine_status` | `implemented`, `architecture_documented`, `planned`, or `future`. |
| `contract` | Public facade or contract reference. |
| `configuration_schema` | Engine-specific configuration schema when applicable. |
| `required_services` | Platform services or runtime services needed by the Engine. |
| `required_engines` | Other engines used only through official contracts. |
| `repositories` | Runtime-owned repositories used by the Engine. |
| `health_checks` | Engine-specific health checks. |
| `events_produced` | Events the Engine may publish through its Runtime. |
| `events_consumed` | Events the Engine may consume through its Runtime. |

Engine rules:

- an Engine has one primary responsibility;
- an Engine belongs to exactly one Runtime;
- an Engine must not reach into UI components;
- an Engine must not call another Engine's internal storage;
- an Engine must not bypass Platform Services for logging, telemetry, idempotency or events;
- an Engine may depend on another Runtime only through official contracts or events;
- runtime business logic may orchestrate engines, but Kernel must not.

## 5. Engine Registry Catalog

This catalog records the known Engines and Engine candidates across the current architecture.

| Engine ID | Engine | Owning Runtime | Status | Responsibility | Required dependency rule |
|---|---|---|---|---|---|
| `engine_catalog` | Catalog Engine | Catalog Runtime | Implemented foundation | Provides product, flavor, syrup, topping and availability data through catalog contracts. | Must not calculate prices, choose media or execute recipes. |
| `engine_configuration` | Configuration Engine | Configuration Runtime | Implemented foundation | Builds and validates allowed product configurations. | Uses Catalog contracts; must not calculate price, media, payment or machine commands. |
| `engine_media` | Media Engine | Media Runtime | Planned | Resolves approved media assets and fallback selection. | Uses product/configuration references; UI must not choose media paths directly. |
| `engine_recipe` | Recipe Engine | Recipe Runtime | Implemented foundation | Converts valid configuration into a machine-independent recipe. | Requires valid configuration; must not send hardware commands. |
| `engine_pricing` | Pricing Engine | Pricing Runtime | Implemented foundation | Calculates pricing result, currency, bonus allowance and future rule outputs. | Must not collect payment, mutate wallet or redeem bonuses. |
| `engine_transaction` | Transaction Engine | Finance Runtime | Architecture documented | Defines financial operation identity, lifecycle and transaction coordination. | Must align with Ledger and Payment contracts. |
| `engine_ledger` | Ledger Engine | Ledger Runtime | Architecture documented | Records immutable financial facts. | Must be append-only and must not be mutated by Wallet, Payment or UI. |
| `engine_wallet` | Wallet Engine | Wallet Runtime | Architecture documented | Maintains internal balance projection from ledger facts. | Reads Ledger facts or events; must not call payment providers. |
| `engine_bonus` | Bonus Engine | Bonus Runtime | Architecture documented | Owns non-monetary bonus rights, reservation, redemption, expiration and reversal. | Must not treat bonuses as money. |
| `engine_discount` | Discount Engine | Discount Runtime | Architecture documented | Calculates non-monetary price reductions before payment. | Must not mutate wallet, ledger or payment provider state. |
| `engine_payment` | Payment Engine | Payment Runtime | Architecture documented | Executes settlement, provider abstraction, capture, cancellation and refund execution when applicable. | Consumes accepted payable amount; must not recalculate discounts or prices. |
| `adapter_accounting` | Accounting Adapter | Accounting Adapter Runtime | Architecture documented | Exports and imports ledger-backed facts for external accounting systems. | External accounting must not rewrite platform financial history. |
| `engine_order` | Order Engine | Order Runtime | Architecture documented | Owns purchase aggregate, immutable snapshots and business lifecycle references. | Must not calculate product configuration, pricing or payment settlement. |
| `engine_checkout` | Checkout Engine | Order Runtime | Architecture documented | Orchestrates product selection acceptance through order confirmation boundaries. | Calls Product and Finance contracts; must preserve immutable snapshots. |
| `engine_order_state_machine` | Order State Machine | Order Runtime | Architecture documented | Validates allowed order transitions and terminal states. | Every accepted transition must publish or record one canonical business fact. |
| `engine_order_events` | Order Events Engine | Order Runtime | Architecture documented | Defines and publishes canonical Order events after accepted transitions. | Must use Event Runtime envelope and idempotency rules. |
| `engine_fulfillment` | Fulfillment Engine | Order Runtime | Architecture documented | Coordinates paid-order fulfillment states and machine handoff references. | Machine Runtime owns physical execution. |
| `engine_cancellation` | Cancellation Engine | Order Runtime | Architecture documented | Coordinates unpaid cancellation and paid refund compensation path. | Must reconcile Payment and Machine facts when required. |
| `engine_refund` | Refund Engine | Payment Runtime or future Refund Runtime | Future boundary | Executes or coordinates refund compensation when extracted from Payment Engine. | Until extracted, Payment Engine owns refund execution. |
| `engine_event_bus` | Event Bus Engine | Event Runtime | Architecture documented | Routes events to subscribers and enforces envelope validation. | Must not treat events as commands or alter domain meaning. |
| `engine_event_store` | Event Store Engine | Event Runtime | Planned | Persists event facts for replay, audit and projections. | Must preserve correlation, causation and version metadata. |
| `engine_event_delivery` | Event Delivery Engine | Event Runtime | Planned | Handles retries, dead-letter behavior and delivery metrics. | Consumers must be idempotent. |
| `engine_machine` | Machine Engine | Machine Runtime | Planned | Owns machine selection, queue execution, commands, acknowledgements and telemetry. | Must accept only authorized paid-order fulfillment work. |
| `engine_machine_dispatch` | Machine Dispatch Engine | Machine Runtime | Architecture documented | Converts paid-order fulfillment intent into idempotent machine operation handoff. | Requires Order and Recipe facts; must not alter finance state. |
| `adapter_machine_device` | Machine Device Adapter | Machine Runtime | Planned | Isolates vending hardware protocols and device-specific commands. | Hardware-specific behavior stays behind adapter boundary. |
| `engine_notification` | Notification Engine | Notification Runtime | Planned | Resolves notification jobs from domain events and records delivery facts. | Failed notifications must not roll back domain state. |
| `engine_template` | Template Engine | Notification Runtime | Planned | Resolves message templates and localization from approved templates. | Templates must not be embedded in event contracts. |
| `adapter_notification_channel` | Notification Channel Adapter | Notification Runtime | Planned | Sends messages through Telegram, Mini App, SMS, email, push or future channels. | Channel failures must be observable and retryable when safe. |
| `engine_customer` | Customer Engine | Customer and CRM Runtime | Planned | Owns customer identity, profile and consent boundaries. | Must respect identity, privacy and audit rules. |
| `engine_crm_projection` | CRM Projection Engine | Customer and CRM Runtime | Planned | Builds support and operator views from platform facts. | CRM must not write product, order, finance or machine truth directly. |
| `engine_support_workflow` | Support Workflow Engine | Customer and CRM Runtime | Future | Coordinates operator support actions and escalation states. | Operator actions require audit. |
| `engine_loyalty` | Loyalty Engine | Customer, Bonus or future Loyalty Runtime | Future | Coordinates loyalty experience, Club Timofey rules and customer engagement. | Must keep bonus rights separate from money and finance ledger facts. |
| `engine_analytics` | Analytics Engine | Analytics Runtime | Planned | Builds product, sales, customer and machine reports from events and telemetry. | Analytics must not replace domain events or financial truth. |
| `engine_reporting_projection` | Reporting Projection Engine | Analytics Runtime | Future | Builds queryable reporting projections. | Must obey privacy, retention and replay rules. |
| `engine_campaign` | Campaign Engine | Promotion Runtime | Future | Owns campaign lifecycle and configuration-driven activation. | Campaigns are configured, not hardcoded per action. |
| `engine_contest` | Contest Engine | Promotion Runtime | Future | Owns contest participation and eligibility rules. | Must use Customer, Order, Bonus and Event contracts as needed. |
| `engine_prize` | Prize Engine | Promotion Runtime | Future | Owns prize definitions and issuance policy. | Prize issuance must be auditable. |
| `engine_winner` | Winner Engine | Promotion Runtime | Future | Selects winners according to approved campaign rules. | Randomness, fairness and audit requirements must be explicit. |
| `engine_referral_campaign` | Referral Campaign Engine | Promotion Runtime | Future | Owns referral campaign mechanics. | Must not bypass Customer, Bonus, Discount or Notification contracts. |
| `engine_seasonal_campaign` | Seasonal Campaign Engine | Promotion Runtime | Future | Owns seasonal campaign rules and activation windows. | Uses feature flags and configuration for activation. |
| `engine_recommendation` | Recommendation Engine | AI Runtime | Future | Produces traceable product or offer recommendations. | Must not silently override product, pricing or payment rules. |
| `engine_demand_forecast` | Demand Forecast Engine | AI Runtime | Future | Produces demand forecasts from approved historical data. | Requires model version and source data audit. |
| `engine_inventory_ai` | Inventory AI Engine | AI Runtime | Future | Predicts inventory or ingredient demand. | Must not directly execute machine or finance actions. |
| `engine_marketing_ai` | Marketing AI Engine | AI Runtime | Future | Suggests segments, campaigns or messaging opportunities. | Final campaign rules stay in Promotion Runtime configuration. |
| `engine_conversation_ai` | Conversation AI Engine | AI Runtime | Future | Supports conversational customer or operator assistance. | Must not perform financial, order or machine actions without approved commands. |

## 6. Service Resolution Rules

Service resolution must follow these rules:

- UI and channels resolve runtime-facing application services, not internal engines.
- Runtime services may resolve platform services from the Service Registry.
- Engines receive dependencies from their owning Runtime.
- Repositories are private to their owning Runtime unless explicitly exposed through a contract.
- Adapters expose provider or hardware boundaries, not business shortcuts.
- Cross-runtime calls must use official contracts or events.
- Service resolution failures must be visible in Health Monitor.

## 7. Registration Sequence

Service and Engine registration follows this sequence:

1. Platform services are registered during bootstrap.
2. Runtime manifests are accepted by Runtime Registry.
3. Runtime-owned services are registered.
4. Runtime-owned engines are registered.
5. Engine dependencies are validated.
6. Adapter configuration is validated.
7. Health checks are attached to services and engines.
8. Event producers and consumers are registered with Event Runtime when enabled.
9. Services become resolvable only after required dependencies are ready.

## 8. Health Monitoring

Service health contributes to Runtime and Platform health.

Health dimensions:

| Health dimension | Example |
|---|---|
| Configuration health | Required config missing, invalid schema, invalid secret reference. |
| Dependency health | Required service unavailable or degraded. |
| Engine health | Engine cannot validate rules or load required repository data. |
| Adapter health | Provider, device or channel unavailable. |
| Event health | Event delivery, retry or dead-letter state. |
| Storage health | Runtime repository unavailable or inconsistent. |

Health checks must not mutate business state.

## 9. Graceful Shutdown Rules

Services and engines must support graceful shutdown when they hold resources or accept work.

Rules:

- stop accepting new work before releasing dependencies;
- drain in-flight event handlers and jobs within configured timeout;
- stop adapters before runtime-owned repositories are disposed if adapters depend on them;
- flush audit logs, telemetry and logs;
- report timeout or forced stop through Health Monitor and Telemetry;
- release external provider, device and channel connections.

## 10. Acceptance Criteria

Service Registry documentation is acceptable when:

- Platform Services are listed with domain-neutral responsibilities;
- service manifest fields are defined;
- Engine registration fields are defined;
- every known Engine or Engine candidate is listed;
- service resolution rules protect runtime boundaries;
- health monitoring rules are documented;
- graceful shutdown rules are documented;
- no application code is modified by this documentation increment.
