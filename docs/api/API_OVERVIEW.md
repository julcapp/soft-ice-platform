# API Overview

Status: Draft
Version: 0.1
Date: 2026-07-06
Project: Soft ICE Platform / Utimoshi
Scope: Documentation only

## Purpose

This document defines the API direction for Soft ICE Platform.

The API is the contract layer between platform consumers, external integrations and runtime-owned platform capabilities. It describes how requests, responses, events and webhooks cross platform boundaries.

Core rule:

```text
API never contains business logic.
Runtime owns business logic.
API is a contract.
Configuration controls behavior.
```

The API may authenticate, authorize at transport level, validate contract shape, enforce idempotency, apply rate limits, route requests, expose health information and observe traffic.

The API must not calculate product configuration, pricing, discounts, bonuses, payment decisions, order transitions, machine fulfillment rules, notification content or promotion logic.

## 1. API Vision

Soft ICE Platform API exists to make one product-centered platform available through many consumers:

- Mini App;
- web app;
- Telegram bot;
- CRM and operator tools;
- vending terminal interfaces;
- machine integration adapters;
- payment provider callbacks;
- notification channels;
- analytics and reporting tools;
- future partner integrations;
- future SDK clients.

The API should expose stable platform contracts while allowing Runtime and Engine implementation to evolve behind those contracts.

The long-term vision is:

```text
One platform model.
Many consumers.
Stable contracts.
Runtime-owned behavior.
Configuration-driven change.
```

The API must support the MVP goal:

```text
A customer can select a dessert, pay for it and receive it from a vending machine.
```

It must also support future product categories, channels, payment providers, machine types, loyalty mechanics, promotion campaigns, analytics and AI modules without changing the API philosophy.

## 2. API Philosophy

The API follows these principles:

- contract first;
- business logic free;
- Runtime ownership of business behavior;
- Platform Kernel ownership of infrastructure coordination;
- explicit authentication and authorization context;
- idempotency for accepted side effects;
- versioned contracts;
- observable requests, responses, events and failures;
- secure defaults;
- configuration over code when the platform model already supports the behavior;
- no direct access from API consumers to repositories, storage or internal engines.

The API is not a shortcut around Runtime contracts.

The API is not a place to duplicate Product, Finance, Order, Machine, Notification, CRM, Analytics, Promotion or AI business rules.

The API should remain thin, boring and predictable. Its value is contract stability, security, observability and safe integration.

## 3. Consumer Types

The API must support several consumer categories.

| Consumer type | Examples | API responsibility | Runtime responsibility |
|---|---|---|---|
| Customer channel | Mini App, web app, Telegram bot | Authenticate customer context, expose product and order contracts, route commands and queries. | Validate configuration, calculate price, create orders, manage payment and fulfillment state. |
| Operator channel | CRM, support console, admin dashboard | Authenticate operator identity, enforce route-level access, pass audit context. | Decide allowed operator actions and domain effects. |
| Machine integration | vending machine adapter, terminal adapter | Authenticate device or adapter, validate command envelope, route acknowledgements. | Select machine, manage queue, validate command state and record physical outcome facts. |
| Payment integration | provider callback, payment status pull, refund callback | Verify provider signature, deduplicate callbacks, route payment facts. | Validate payment state, reconcile provider facts, update Ledger and Order through official contracts. |
| Notification integration | Telegram, push, SMS, email, delivery receipts | Authenticate channel adapter, validate delivery webhook shape, route delivery facts. | Resolve templates, choose delivery rules and record notification state. |
| Analytics consumer | reporting UI, dashboards, export jobs | Expose approved read models and telemetry endpoints. | Build projections from events and runtime data according to privacy and retention rules. |
| Partner or SDK consumer | future partner system, future public SDK | Expose stable versioned contracts and limits. | Own domain behavior and business authorization. |
| Internal platform consumer | Runtime-to-runtime API boundary when synchronous calls are approved | Carry security, identity, correlation and idempotency context. | Use official contracts and avoid storage or engine bypass. |

Consumers must never depend on internal storage formats or engine implementation details.

## 4. Platform Services

The API may use Platform Services for domain-neutral infrastructure behavior.

| Platform service | API usage | Boundary |
|---|---|---|
| Configuration Service | Read API configuration, feature flags, route exposure, limits and integration settings. | Does not interpret product, payment, order or campaign business meaning. |
| Runtime Registry | Discover runtime readiness and exposed contracts. | Does not execute runtime business behavior. |
| Service Registry | Resolve approved runtime services, platform services and adapters. | Not exposed as a UI service locator. |
| Event Bus | Publish and consume events through validated envelopes. | Routes events but does not interpret payload business meaning. |
| Validation Service | Validate schemas, payload shape and envelope structure. | Runtime validates domain rules. |
| Security Context Service | Propagate authentication, authorization, trust and signature metadata. | Runtime owns domain-specific authorization decisions. |
| Identity Context Service | Carry customer, operator, machine, provider or system actor identity. | Does not own customer profile state. |
| Idempotency Service | Prevent duplicate accepted side effects for commands, events and webhooks. | Does not decide whether a business action is allowed. |
| Logger | Write structured logs with correlation metadata. | Must not log secrets, payment credentials or sensitive payloads. |
| Telemetry | Emit request, event, webhook and runtime metrics. | Observes behavior without owning domain state. |
| Health Monitor | Expose platform, runtime, service and integration health. | Reports health without deciding business compensation. |
| Feature Flag Service | Control API exposure and rollout of documented capabilities. | Feature flags do not replace domain configuration or contract versioning. |
| Audit Log Service | Record administrative, financial, order, machine and configuration access facts where required. | Runtime defines required audit facts for its domain. |
| Clock Service | Provide consistent timestamps for API envelopes and audit metadata. | Runtime decides business expiry rules. |

The API can enforce infrastructure policy. It cannot replace Runtime policy.

## 5. Authentication Overview

Authentication answers:

```text
Who or what is calling the API?
```

Authentication must produce an identity context that can be propagated through REST calls, events, webhooks, logs, telemetry and audit records.

Initial authentication categories:

| Category | Example identity | Expected authentication model |
|---|---|---|
| Customer | Mini App user, web user, Telegram user | Customer session, Telegram init data verification or future identity provider token. |
| Operator | CRM user, support user, administrator | Operator session or identity provider token with operator metadata. |
| Machine or adapter | vending machine gateway, device adapter | Registered adapter credential, signed request or mutual trust mechanism. |
| Payment provider | YooKassa or future provider callback | Provider signature verification and configured provider identity. |
| Notification provider | Telegram, push, SMS or email provider callback | Provider signature, token or adapter credential. |
| Internal service | runtime service, scheduled job, platform worker | Internal service identity with scoped trust and correlation metadata. |

Authentication rules:

- unauthenticated requests must not reach runtime commands that mutate business state;
- authentication credentials must not be stored in repository files;
- authentication secrets must not be logged;
- provider signatures must be verified before provider payloads are accepted;
- machine or adapter identity must be explicit;
- internal service identity must be distinguishable from customer and operator identity.

Detailed mechanism-specific contracts should be documented in `docs/api/AUTHENTICATION.md`.

## 6. Authorization Overview

Authorization answers:

```text
What is this authenticated actor allowed to do?
```

The API may enforce transport-level authorization:

- route access;
- method access;
- consumer type access;
- scope or role presence;
- provider or adapter allowlist;
- coarse feature flag exposure;
- request origin and signature policy.

Runtime owns business authorization:

- whether a customer can place a specific order;
- whether a product configuration is allowed;
- whether a discount or bonus can be applied;
- whether a payment can be captured or refunded;
- whether an order transition is allowed;
- whether a machine acknowledgement is valid;
- whether an operator action is allowed for a specific case;
- whether a promotion action is eligible.

Authorization context must travel with all commands and events that may affect customer, financial, order, machine, loyalty, promotion or administrative state.

The API must reject requests with missing or invalid security context before they reach Runtime contracts. It must not invent domain permission rules inside route handlers.

## 7. REST API

REST API is the synchronous command and query boundary for platform consumers.

Recommended base path:

```text
/api/v1
```

REST API rules:

- REST endpoints expose Runtime contracts, not repositories or internal engines;
- `GET` endpoints are queries and must not mutate business state;
- mutating endpoints must require idempotency when duplicate submission is possible;
- responses must be DTOs or snapshots produced by Runtime contracts;
- route handlers must not calculate final prices, select product media, mutate wallet balances, change order state directly or send machine commands directly;
- API examples must not include real credentials or secrets;
- API behavior should be controlled through configuration when the contract already supports the behavior.

Illustrative REST contract groups:

| Area | Example endpoint candidates | Runtime owner |
|---|---|---|
| Catalog | `GET /api/v1/catalog/products`, `GET /api/v1/catalog/options` | Catalog Runtime |
| Configuration | `POST /api/v1/configurations/validate` | Configuration Runtime |
| Media | `GET /api/v1/media/products/{product_id}` | Media Runtime |
| Pricing | `POST /api/v1/pricing/quote` | Pricing Runtime |
| Checkout and orders | `POST /api/v1/orders`, `GET /api/v1/orders/{order_id}` | Order Runtime |
| Payment | `POST /api/v1/payments`, `POST /api/v1/payments/{payment_id}/confirm` | Payment Runtime |
| Machine | `GET /api/v1/machines/{machine_id}/health`, `POST /api/v1/machine-acks` | Machine Runtime |
| Customer and CRM | `GET /api/v1/customers/{customer_id}`, `GET /api/v1/crm/orders` | Customer and CRM Runtime |
| Notifications | `POST /api/v1/notifications/test`, `GET /api/v1/notifications/{notification_id}` | Notification Runtime |
| Analytics | `GET /api/v1/analytics/sales-summary` | Analytics Runtime |
| Platform health | `GET /api/v1/health`, `GET /api/v1/runtime-health` | Platform Runtime and Health Monitor |

The endpoint list is a contract direction, not an implementation commitment. Detailed REST contracts should be documented in `docs/api/REST_API.md`.

## 8. Event API

Event API is the asynchronous fact boundary between runtimes and platform consumers.

Events represent accepted facts, not requests to maybe perform work.

Event API rules:

- event producers are owned by Runtimes;
- event payload meaning is owned by the producing Runtime;
- Event Runtime validates envelope shape, routing, idempotency and delivery policy;
- Event Runtime must not interpret business meaning;
- event consumers must be idempotent;
- events must be observable through logs, telemetry and dead-letter handling;
- replay must preserve event metadata;
- business compensation rules belong to Runtimes, not the Event API.

Recommended event envelope fields:

| Field | Meaning |
|---|---|
| `event_id` | Globally unique event identity. |
| `event_type` | Semantic event name. |
| `event_version` | Event contract version. |
| `source_runtime_id` | Runtime that produced the event. |
| `occurred_at` | Time the business fact occurred. |
| `published_at` | Time the event was published. |
| `correlation_id` | End-to-end trace identifier. |
| `causation_id` | Request, command or event that caused this event. |
| `idempotency_key` | Optional key for duplicate handling. |
| `actor_context` | Customer, operator, machine, provider or system identity context. |
| `payload` | Runtime-owned event data. |
| `schema_ref` | Reference to the event schema. |

Event naming should be semantic, stable and versioned when needed.

Detailed event contracts should be documented in `docs/api/EVENT_API.md`.

## 9. Webhooks

Webhooks are the external integration boundary for incoming and outgoing platform facts.

Inbound webhook examples:

- payment provider status callback;
- refund status callback;
- notification delivery receipt;
- machine adapter status callback;
- future accounting integration callback;
- future partner integration callback.

Outbound webhook examples:

- order status notification to approved partner systems;
- payment or refund status notification to approved partner systems;
- machine status notification to operations systems;
- analytics export notification.

Webhook rules:

- every webhook must have an owner Runtime or adapter boundary;
- incoming webhooks must be authenticated before processing;
- incoming webhooks must be validated against a contract schema;
- duplicate webhook deliveries must be idempotent;
- webhook handlers must not mutate domain state directly;
- handlers pass verified facts to Runtime contracts or Event API;
- webhook retry policy must be bounded and observable;
- webhook secrets and signatures must not be logged;
- outbound webhook payloads must not expose internal implementation details.

Detailed webhook contracts should be documented in `docs/api/WEBHOOKS.md`.

## 10. Idempotency

Idempotency prevents duplicate accepted side effects when the same operation is submitted more than once.

Idempotency is required for:

- order creation;
- checkout confirmation;
- payment initialization;
- payment capture;
- payment cancellation;
- refund request;
- bonus reservation and redemption;
- machine command delivery;
- webhook processing;
- event consumer handling;
- administrative actions that mutate state.

Idempotency rules:

- mutating REST requests should include an idempotency key where duplicate submission is possible;
- keys should be scoped by actor, operation and target resource;
- the same key with the same payload should return the same accepted result or current known state;
- the same key with a conflicting payload must return a conflict error;
- runtime side effects must not be repeated after an idempotency hit;
- idempotency records must have retention configured by operation type;
- payment, order and machine idempotency must prefer consistency over silent continuation.

The Idempotency Service records keys and duplicate detection. Runtime owns whether the original operation was allowed and what state it produced.

Detailed idempotency contracts should be documented in `docs/api/IDEMPOTENCY.md`.

## 11. Versioning

API contracts must be versioned.

Versioning rules:

- REST major version should be visible in the path, such as `/api/v1`;
- event contracts must include `event_version`;
- webhook contracts must include an explicit version or versioned schema reference;
- SDK versions must map to supported API contract versions;
- additive fields may be introduced without breaking consumers when documented as optional;
- breaking changes require a new major contract version;
- deprecated versions must have a migration window;
- configuration flags must not be used as a hidden replacement for contract versioning;
- Runtime implementation versions may change independently from API contract versions when contracts remain compatible.

Detailed versioning policy should be documented in `docs/api/API_VERSIONING.md`.

## 12. Error Handling

Errors must be machine-readable, safe to expose and useful for recovery.

Recommended error response fields:

| Field | Meaning |
|---|---|
| `error_id` | Unique error instance identifier for support and logs. |
| `code` | Stable machine-readable error code. |
| `message` | Safe human-readable summary. |
| `details` | Optional structured details safe for this consumer. |
| `correlation_id` | Request trace identifier. |
| `retryable` | Whether retry may be safe. |
| `source` | API, Runtime, Platform Service or adapter source. |

Error rules:

- validation errors must identify invalid fields without leaking secrets;
- authentication and authorization errors must not reveal sensitive policy internals;
- domain errors should be produced by Runtime contracts;
- provider errors should be normalized by adapters;
- retries must be explicit and bounded;
- every server-side failure must be observable through logs and telemetry;
- payment, order and machine errors must preserve auditability.

Detailed error codes should be documented in `docs/api/ERROR_CODES.md`.

## 13. Security

Security is a platform-wide requirement.

API security rules:

- use secure transport for all external API traffic;
- keep secrets external to repository source code;
- never log credentials, tokens, signatures, payment credentials or raw secrets;
- verify provider signatures before accepting callbacks;
- propagate security context through Runtime calls and events;
- validate payload shape before Runtime execution;
- enforce least privilege by default;
- audit administrative, financial, order, machine and configuration actions;
- protect against replay attacks for webhooks and signed requests;
- apply request size limits;
- avoid exposing internal stack traces or implementation details;
- isolate provider, machine and channel integrations behind adapters.

Security primitives may be provided by Platform Services. Domain-specific security and authorization rules belong to the owning Runtime.

## 14. Rate Limiting

Rate limiting protects platform stability and integration fairness.

Rate limit dimensions may include:

- consumer type;
- customer identity;
- operator identity;
- machine or adapter identity;
- provider identity;
- IP address or network boundary;
- route group;
- operation type;
- environment;
- risk level.

Rate limiting rules:

- rate limits are infrastructure policy, not business eligibility rules;
- rate limit configuration must be explicit and environment-aware;
- exceeded limits should return `429 Too Many Requests`;
- responses should include retry guidance when safe;
- payment and webhook retries must account for provider delivery behavior;
- abusive traffic should be observable through telemetry and security logs;
- critical machine and payment callbacks may need separate limits from public customer traffic.

Runtime may define business quotas. API rate limiting must not silently encode those domain rules.

## 15. Monitoring

The API must be observable from the first implementation.

Monitoring dimensions:

- request count;
- response status distribution;
- latency by route and consumer type;
- authentication failures;
- authorization failures;
- validation failures;
- idempotency hits and conflicts;
- rate limit hits;
- webhook verification failures;
- webhook retry and delivery outcomes;
- event publish, consume, retry and dead-letter outcomes;
- Runtime readiness and degradation;
- provider, adapter and machine integration health;
- audit event completeness for sensitive operations.

Every request should carry or receive a `correlation_id`.

Logs must be structured and safe. Metrics must support operational dashboards and incident review. Traces should connect API requests to Runtime calls, events, webhooks and provider interactions where possible.

## 16. Future SDK

Future SDKs may wrap API contracts for approved consumers.

SDK principles:

- SDKs wrap contracts; they do not own business logic;
- SDKs must not calculate prices, discounts, bonuses, recipes or final order states locally;
- SDKs must not select product media locally when Media Runtime owns resolution;
- SDKs should provide typed request and response models;
- SDKs should support authentication helpers;
- SDKs should support idempotency key helpers;
- SDKs should expose retry helpers only where retry is safe;
- SDKs should preserve correlation metadata;
- SDKs should surface API errors without hiding domain meaning;
- SDK versions must map to supported API contract versions.

Recommended first SDK candidate:

```text
TypeScript SDK for Mini App, web app and internal admin tools.
```

Future SDK candidates:

- Node.js integration SDK;
- CRM/operator SDK;
- machine adapter SDK;
- analytics export SDK;
- partner integration SDK.

## 17. Future Roadmap

Recommended API roadmap:

1. Fill `docs/api/AUTHENTICATION.md` with authentication contracts.
2. Fill `docs/api/REST_API.md` with REST resource, command and query contracts.
3. Fill `docs/api/EVENT_API.md` with event envelope and event catalog.
4. Fill `docs/api/WEBHOOKS.md` with inbound and outbound webhook contracts.
5. Fill `docs/api/IDEMPOTENCY.md` with operation-specific idempotency policy.
6. Fill `docs/api/ERROR_CODES.md` with stable error code taxonomy.
7. Fill `docs/api/API_VERSIONING.md` with contract versioning and deprecation rules.
8. Define OpenAPI specification generation policy.
9. Define JSON Schema or equivalent schema references for REST, events and webhooks.
10. Define API gateway or edge routing architecture.
11. Define contract tests for API, Runtime and SDK boundaries.
12. Define API security review checklist.
13. Define webhook signature standard.
14. Define API monitoring dashboards and alert rules.
15. Design the first TypeScript SDK after REST and event contracts are stable.

Acceptance criteria for future API implementation:

- API routes call Runtime contracts instead of internal engines or repositories;
- no business logic is implemented in API handlers;
- mutating commands are idempotent where duplicate submission is possible;
- authentication, authorization, validation, telemetry and audit context are propagated;
- contract versions are explicit;
- application behavior remains configurable where the platform model supports it.
