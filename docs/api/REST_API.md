# REST API

Status: Draft
Version: 0.1
Date: 2026-07-06
Project: Soft ICE Platform / Utimoshi
Scope: Documentation only

## Purpose

This document defines the REST API direction for Soft ICE Platform.

REST API is the synchronous transport boundary between platform consumers and Runtime-owned contracts.

Core rule:

```text
REST endpoints expose capabilities only.
Business rules remain inside Runtime.
REST API is transport only.
No application code is defined by this document.
```

REST routes may authenticate, authorize, validate request shape, enforce idempotency, apply rate limits, route commands and queries, return Runtime DTOs and expose safe operational metadata.

REST routes must not calculate product configuration, pricing, discounts, bonuses, payment outcomes, order transitions, machine fulfillment rules, notification content, promotion eligibility or analytics meaning.

## 1. REST Vision

Soft ICE Platform REST API exists to expose stable synchronous contracts for:

- Mini App;
- web app;
- Telegram bot;
- CRM and operator tools;
- vending machine adapters;
- payment and notification integrations;
- analytics dashboards;
- partner integrations;
- future SDK clients.

The REST vision is:

```text
Stable contracts.
Runtime-owned behavior.
Transport-only routes.
Versioned DTOs.
Observable requests.
Secure defaults.
```

REST API supports the MVP goal:

```text
A customer can select a dessert, pay for it and receive it from a vending machine.
```

REST should let clients submit commands and read approved views. Runtime decides whether the requested business action is valid.

## 2. API Design Principles

REST API follows these principles:

- contract first;
- transport only;
- Runtime-owned business behavior;
- endpoint handlers call Runtime contracts, not repositories or internal engines;
- resources describe platform capabilities, not database tables;
- JSON request and response bodies are explicit DTOs;
- authentication and authorization run before protected Runtime calls;
- mutating operations use idempotency where duplicate submission is possible;
- errors are stable, machine-readable and safe to expose;
- pagination, filtering and sorting are explicit and allowlisted;
- observability is required through correlation IDs, logs, metrics and audit where needed;
- API examples must not include real credentials or secrets;
- versioning is visible and deliberate;
- behavior changes prefer configuration where the platform model already supports the behavior.

REST API is not a shortcut around Product, Finance, Order, Payment, Machine, Promotion, CRM, Event or Analytics Runtimes.

## 3. Resource Naming

REST resource names must be stable, semantic and consumer-facing.

Resource naming rules:

- use plural nouns for resource collections;
- use lowercase kebab-case for multi-word URI segments;
- use platform IDs in path parameters;
- avoid exposing storage, table, repository or engine names;
- avoid verbs in normal resource names;
- use command subresources for operations that do not map cleanly to CRUD;
- keep public resource names stable even if Runtime implementation changes;
- reserve deprecated resource names until migration is complete.

Examples:

```text
/api/v1/products
/api/v1/orders
/api/v1/payments
/api/v1/machines/{machine_id}/health
/api/v1/orders/{order_id}/cancellation-requests
```

Resource names describe contracts. They do not imply direct persistence access.

## 4. HTTP Methods

HTTP methods must be used consistently.

| Method | Use | Rules |
|---|---|---|
| `GET` | Read approved views or snapshots. | Must not mutate business state. |
| `POST` | Create resources, submit commands or request Runtime work. | Requires idempotency when duplicate submission may cause side effects. |
| `PUT` | Replace a complete resource representation where supported. | Use only when replacement semantics are clear. |
| `PATCH` | Partially update an approved resource view or metadata. | Must be scoped and validated by Runtime. |
| `DELETE` | Remove or revoke a resource where deletion is truly part of the contract. | Prefer explicit cancellation or revocation command resources for business processes. |

Method rules:

- `GET` requests must be safe and side-effect free;
- `POST` may create a command, request, session, payment or operation;
- business cancellation should normally use command resources such as `POST /orders/{order_id}/cancellation-requests`;
- provider callbacks may use dedicated webhook endpoints instead of general REST resource endpoints;
- method choice must not hide business rules in API handlers.

## 5. URI Convention

Recommended base path:

```text
/api/v1
```

URI rules:

- major API version appears in the base path;
- collection paths use plural resource names;
- item paths use platform IDs in path parameters;
- nested paths are allowed when the child resource is naturally scoped by the parent;
- keep nesting shallow;
- query parameters control filtering, pagination, sorting and optional field inclusion;
- URI paths must not include secrets, tokens, raw phone numbers, emails or payment credentials;
- use canonical platform IDs instead of external identity aliases.

Recommended path parameter style:

```text
/api/v1/customers/{customer_id}
/api/v1/orders/{order_id}
/api/v1/products/{product_id}
/api/v1/machines/{machine_id}
```

External aliases such as TelegramID, phone, email, VK ID or external OAuth IDs must be resolved before platform resource access when customer identity is required.

## 6. Request Structure

REST requests use JSON unless a specific contract documents another media type.

Recommended request headers:

| Header | Purpose |
|---|---|
| `Authorization` | Bearer token, session token or other approved authentication credential. |
| `Idempotency-Key` | Required for mutating operations where duplicate submission may cause side effects. |
| `X-Correlation-ID` | Optional incoming trace identifier; API may generate one when missing. |
| `Accept-Language` | Optional localization preference. |
| `X-Client-Version` | Optional client application or SDK version. |
| `Content-Type` | Must be `application/json` for JSON requests. |
| `Accept` | Expected response media type. |

Recommended command request body shape:

```json
{
  "data": {
    "type": "order_create_request",
    "attributes": {}
  },
  "meta": {
    "client_request_id": "client_request_123",
    "requested_at": "2026-07-06T00:00:00Z"
  }
}
```

Request rules:

- actor identity must come from authentication context, not from trusted client body fields;
- authorization scope must come from authorization policy, not from trusted client body fields;
- request bodies must not contain raw secrets unless the endpoint is explicitly designed for credential exchange;
- request shape validation happens before Runtime contract execution;
- Runtime validates business meaning;
- clients must not send calculated final prices, discount decisions, order states or machine outcomes as trusted truth unless a Runtime contract explicitly accepts those facts from a trusted integration.

## 7. Response Structure

REST responses return Runtime DTOs, command acknowledgements, snapshots or safe operational metadata.

Recommended success response shape:

```json
{
  "data": {
    "type": "order",
    "id": "order_123",
    "attributes": {}
  },
  "meta": {
    "correlation_id": "corr_123",
    "api_version": "v1"
  },
  "links": {
    "self": "/api/v1/orders/order_123"
  }
}
```

Response rules:

- response bodies must not expose secrets, raw credentials, internal stack traces or storage internals;
- DTO fields must be documented and versioned;
- optional fields must be safe for older clients to ignore;
- Runtime domain errors must be returned through the standard error format;
- successful command responses should identify the accepted resource, command or operation state;
- read responses may include pagination, filtering and sorting metadata.

Recommended status codes:

| Status | Use |
|---|---|
| `200 OK` | Successful read or completed synchronous command. |
| `201 Created` | New resource or command resource created. |
| `202 Accepted` | Command accepted for asynchronous Runtime processing. |
| `204 No Content` | Successful operation with no response body. |
| `400 Bad Request` | Invalid request shape or unsupported parameter. |
| `401 Unauthorized` | Missing or invalid authentication. |
| `403 Forbidden` | Authenticated actor is not authorized. |
| `404 Not Found` | Resource not found or intentionally hidden. |
| `409 Conflict` | Idempotency conflict, version conflict or state conflict. |
| `422 Unprocessable Entity` | Runtime rejected domain input. |
| `429 Too Many Requests` | Rate limit exceeded. |
| `500 Internal Server Error` | Unexpected server failure. |
| `503 Service Unavailable` | Required Runtime, adapter or dependency unavailable. |

## 8. Pagination

Pagination is required for list endpoints that can grow over time.

Preferred pagination model:

```text
cursor-based pagination
```

Recommended query parameters:

| Parameter | Meaning |
|---|---|
| `limit` | Maximum number of items to return. |
| `cursor` | Opaque cursor from a previous response. |
| `page_after` | Optional alternative name for forward cursor navigation. |
| `page_before` | Optional alternative name for backward cursor navigation. |

Recommended response metadata:

```json
{
  "meta": {
    "limit": 50,
    "next_cursor": "cursor_next",
    "previous_cursor": "cursor_prev",
    "has_more": true
  }
}
```

Pagination rules:

- default and maximum limits must be configured per route group;
- cursors must be opaque to clients;
- list ordering must be stable for cursor pagination;
- offset pagination may be used only for small administrative lists where consistency risk is acceptable;
- pagination must not leak hidden resources across authorization boundaries.

## 9. Filtering

Filtering narrows list responses using allowlisted query parameters.

Example:

```text
GET /api/v1/orders?status=paid&created_from=2026-07-01T00:00:00Z&created_to=2026-07-06T23:59:59Z
```

Filtering rules:

- every filterable field must be documented;
- unsupported filters must return a validation error;
- filters must not expose internal query language, SQL, repository names or storage fields;
- filters must be applied after authorization scope;
- date and time filters must use explicit timezone-aware timestamps;
- filtering by external identity alias is not allowed for customer-owned resources unless a documented admin or CRM lookup contract exists;
- business eligibility filters belong to Runtime, not API handlers.

Recommended common filters:

| Filter | Use |
|---|---|
| `status` | Filter by documented resource status. |
| `created_from` | Inclusive lower creation timestamp. |
| `created_to` | Inclusive upper creation timestamp. |
| `updated_from` | Inclusive lower update timestamp. |
| `updated_to` | Inclusive upper update timestamp. |
| `customer_id` | CRM or admin use only where authorized. |
| `machine_id` | Machine, operations or analytics use where authorized. |
| `product_id` | Product, order or analytics use where authorized. |

## 10. Sorting

Sorting controls list order through allowlisted fields.

Recommended syntax:

```text
sort=created_at
sort=-created_at
sort=created_at,-total_amount
```

Sorting rules:

- every sortable field must be documented;
- prefix descending fields with `-`;
- default sort must be documented for every list endpoint;
- sort fields must map to contract fields, not storage internals;
- sorting must be stable when used with cursor pagination;
- unsupported sort fields must return a validation error.

Recommended common sort fields:

| Sort field | Meaning |
|---|---|
| `created_at` | Creation time ascending. |
| `-created_at` | Creation time descending. |
| `updated_at` | Update time ascending. |
| `-updated_at` | Update time descending. |
| `status` | Documented status order where supported. |

## 11. Error Response Format

REST errors must be machine-readable, safe and consistent.

Recommended error response shape:

```json
{
  "error": {
    "error_id": "err_123",
    "code": "AUTHORIZATION_DENIED",
    "message": "Access denied.",
    "details": [],
    "source": "api",
    "retryable": false
  },
  "meta": {
    "correlation_id": "corr_123",
    "api_version": "v1"
  }
}
```

Error field rules:

| Field | Meaning |
|---|---|
| `error_id` | Unique error instance identifier. |
| `code` | Stable machine-readable error code. |
| `message` | Safe human-readable summary. |
| `details` | Optional structured details safe for the consumer. |
| `source` | API, Runtime, Platform Service or adapter source. |
| `retryable` | Whether retry may be safe. |
| `correlation_id` | Trace identifier in response metadata. |

Error rules:

- authentication and authorization errors must not reveal sensitive policy internals;
- validation errors may identify invalid fields when safe;
- Runtime domain errors must not be rewritten as transport errors;
- provider, machine and payment errors must preserve auditability;
- internal stack traces must not be returned to clients;
- detailed error code taxonomy belongs in `docs/api/ERROR_CODES.md`.

## 12. API Versioning

REST API versions must be explicit.

Versioning rules:

- major REST version appears in the URI path, such as `/api/v1`;
- additive optional fields may be introduced without changing major version;
- breaking changes require a new major version;
- deprecated versions require a migration window;
- versioned behavior must be documented, not hidden behind feature flags;
- Runtime implementation versions may change independently when REST contracts remain compatible;
- SDK versions must map to supported API contract versions.

Recommended version metadata:

| Location | Use |
|---|---|
| URI path | Major API contract version. |
| Response `meta.api_version` | Echo active API version. |
| Schema reference | Future JSON Schema or OpenAPI contract version. |
| SDK metadata | Map client library to supported API contracts. |

Detailed versioning policy is documented in `docs/api/API_VERSIONING.md`.

## 13. Idempotency Overview

Idempotency prevents duplicate accepted side effects.

REST operations requiring idempotency include:

- order creation;
- checkout confirmation;
- payment initialization;
- payment capture or cancellation;
- refund request;
- bonus reservation or redemption;
- machine command delivery or acknowledgement handling where duplicate delivery is possible;
- webhook processing;
- admin actions that mutate sensitive state.

Idempotency rules:

- use `Idempotency-Key` header for mutating operations where duplicates are possible;
- keys should be scoped by actor, operation and target resource;
- same key with same payload should return the same accepted result or current known state;
- same key with conflicting payload must return `409 Conflict`;
- idempotency records must not repeat Runtime side effects;
- retention must be configured by operation type;
- API stores or checks idempotency metadata through Platform Services;
- Runtime owns whether the original business action was allowed.

Detailed policy belongs in `docs/api/IDEMPOTENCY.md`.

## 14. Rate Limiting Overview

Rate limiting protects platform stability and integration fairness.

Rate limit dimensions may include:

- consumer type;
- customer identity;
- operator identity;
- machine identity;
- adapter identity;
- partner identity;
- provider identity;
- API client identity;
- IP address or network boundary;
- route group;
- operation type;
- environment.

Rate limiting rules:

- rate limits are infrastructure policy;
- rate limits must not encode business eligibility;
- exceeded limits should return `429 Too Many Requests`;
- responses should include retry guidance when safe;
- machine and payment callbacks may require separate limits from customer traffic;
- repeated abuse should be visible through telemetry and security logs.

Recommended rate limit headers:

| Header | Meaning |
|---|---|
| `RateLimit-Limit` | Configured limit for the window. |
| `RateLimit-Remaining` | Remaining requests in the current window. |
| `RateLimit-Reset` | Time until the current window resets. |
| `Retry-After` | Retry delay when applicable. |

## 15. Authentication Integration

REST authentication integrates with `docs/api/AUTHENTICATION.md`.

Authentication integration rules:

- protected routes require authentication before authorization;
- authentication produces normalized identity context;
- `customer_id` is the primary platform identity for customers;
- TelegramID, phone, email, VK ID and external OAuth IDs are external aliases only;
- authentication credentials must not be trusted from ordinary request body fields;
- raw credentials, tokens, API keys, signatures and secrets must not be logged;
- provider and machine signatures must be verified before their facts reach Runtime contracts;
- anonymous access is allowed only for explicitly public routes.

Recommended REST flow:

```text
Request
  -> REST route
  -> authentication
  -> identity context
  -> authorization
  -> request validation
  -> Runtime contract
```

Authentication answers who is calling. It does not decide what the actor may do or whether a business action is valid.

## 16. Authorization Integration

REST authorization integrates with `docs/api/AUTHORIZATION.md`.

Authorization integration rules:

- API Gateway enforces access policy before Runtime execution;
- every protected route must declare required permissions and scopes;
- deny by default when route policy is missing or ambiguous;
- customer self-service routes must be scoped to `customer_id`;
- machine routes must be scoped to `machine_id`, `adapter_id` or machine group;
- CRM and admin routes require operator identity and audit context;
- partner routes require registered partner identity and contract scope;
- authorization errors must be distinguishable from Runtime domain errors;
- Runtime remains responsible for business rules.

Authorization may allow a request to reach Runtime. It must not decide whether a product configuration, discount, payment, order transition, machine acknowledgement, promotion participation or support action is valid.

## 17. Resource Groups

The following resource groups define REST contract direction. They are endpoint candidates, not implementation commitments.

Every endpoint must call the owning Runtime contract and must not access internal storage directly.

### Customers

Customer endpoints expose customer identity, profile and CRM support capabilities.

| Capability | Endpoint candidate | Method | Runtime owner |
|---|---|---|---|
| Read own customer view | `/api/v1/customers/me` | `GET` | Customer and CRM Runtime |
| Update own allowed profile fields | `/api/v1/customers/me` | `PATCH` | Customer and CRM Runtime |
| Read CRM customer view | `/api/v1/customers/{customer_id}` | `GET` | Customer and CRM Runtime |
| List CRM customer views | `/api/v1/customers` | `GET` | Customer and CRM Runtime |
| Manage notification preferences | `/api/v1/customers/me/notification-preferences` | `PATCH` | Notification Runtime and Customer Runtime |

Rules:

- customer self-service access uses `customer_id`;
- external identities are aliases only;
- CRM access requires operator authorization and audit;
- Customer Runtime owns profile and consent business rules.

### Wallet

Wallet endpoints expose approved balance projections and wallet operation views.

| Capability | Endpoint candidate | Method | Runtime owner |
|---|---|---|---|
| Read own wallet projection | `/api/v1/wallets/me` | `GET` | Wallet Runtime |
| Read own wallet entries | `/api/v1/wallets/me/entries` | `GET` | Wallet Runtime |
| Read CRM wallet projection | `/api/v1/wallets/{customer_id}` | `GET` | Wallet Runtime |
| Request wallet adjustment | `/api/v1/wallet-adjustment-requests` | `POST` | Finance Runtime |

Rules:

- Wallet is a projection over Ledger facts;
- REST must not mutate wallet balance directly;
- Ledger remains the financial source of truth;
- wallet adjustments require explicit Runtime contract and audit.

### Bonus

Bonus endpoints expose non-monetary bonus rights and reservation capabilities.

| Capability | Endpoint candidate | Method | Runtime owner |
|---|---|---|---|
| Read own bonus view | `/api/v1/bonuses/me` | `GET` | Bonus Runtime |
| Read own bonus history | `/api/v1/bonuses/me/events` | `GET` | Bonus Runtime |
| Create bonus reservation request | `/api/v1/bonus-reservations` | `POST` | Bonus Runtime |
| Cancel bonus reservation request | `/api/v1/bonus-reservations/{reservation_id}/cancellation-requests` | `POST` | Bonus Runtime |
| Read CRM bonus view | `/api/v1/bonuses/{customer_id}` | `GET` | Bonus Runtime |

Rules:

- bonus is not money;
- Bonus Runtime owns reservation, redemption, expiration and reversal rules;
- REST must not calculate bonus eligibility or final discount effect;
- bonus actions that affect order or pricing flow must use Runtime contracts.

### Orders

Order endpoints expose checkout and order lifecycle contracts.

| Capability | Endpoint candidate | Method | Runtime owner |
|---|---|---|---|
| Create order | `/api/v1/orders` | `POST` | Order Runtime |
| Read own order | `/api/v1/orders/{order_id}` | `GET` | Order Runtime |
| List own orders | `/api/v1/orders` | `GET` | Order Runtime |
| Request cancellation | `/api/v1/orders/{order_id}/cancellation-requests` | `POST` | Order Runtime |
| Request refund from order context | `/api/v1/orders/{order_id}/refund-requests` | `POST` | Order Runtime and Payment Runtime |
| Read order fulfillment view | `/api/v1/orders/{order_id}/fulfillment` | `GET` | Order Runtime and Machine Runtime |

Rules:

- Order Runtime owns purchase aggregate and lifecycle transitions;
- REST must not calculate product validity, price, discount, payment state or fulfillment state;
- order creation requires idempotency;
- confirmed order snapshots are Runtime-owned facts.

### Payments

Payment endpoints expose payment settlement capabilities.

| Capability | Endpoint candidate | Method | Runtime owner |
|---|---|---|---|
| Create payment | `/api/v1/payments` | `POST` | Payment Runtime |
| Read payment status | `/api/v1/payments/{payment_id}` | `GET` | Payment Runtime |
| Confirm payment where required | `/api/v1/payments/{payment_id}/confirmations` | `POST` | Payment Runtime |
| Request payment cancellation | `/api/v1/payments/{payment_id}/cancellation-requests` | `POST` | Payment Runtime |
| Request refund | `/api/v1/refund-requests` | `POST` | Payment Runtime |

Rules:

- Payment Runtime owns settlement execution and provider abstraction;
- REST must not recalculate payable amount;
- Payment receives accepted payable amount from Runtime contracts;
- payment and refund commands require idempotency and audit.

### Products

Product endpoints expose catalog, configuration, media and pricing contract views.

| Capability | Endpoint candidate | Method | Runtime owner |
|---|---|---|---|
| List products | `/api/v1/products` | `GET` | Catalog Runtime |
| Read product | `/api/v1/products/{product_id}` | `GET` | Catalog Runtime |
| List product options | `/api/v1/products/{product_id}/options` | `GET` | Catalog and Configuration Runtimes |
| Validate configuration | `/api/v1/configurations/validations` | `POST` | Configuration Runtime |
| Request price quote | `/api/v1/pricing/quotes` | `POST` | Pricing Runtime |
| Read product media | `/api/v1/products/{product_id}/media` | `GET` | Media Runtime |

Rules:

- Product Runtime owns product-centered capabilities;
- Catalog Runtime owns product data access;
- Configuration Runtime owns valid product configuration;
- Pricing Runtime owns price calculation;
- Media Runtime owns media resolution;
- REST must not hardcode catalog data, prices, options or media paths.

### Promotions

Promotion endpoints expose campaign and participation capabilities when Promotion Runtime is available.

| Capability | Endpoint candidate | Method | Runtime owner |
|---|---|---|---|
| List visible promotions | `/api/v1/promotions` | `GET` | Promotion Runtime |
| Read promotion | `/api/v1/promotions/{promotion_id}` | `GET` | Promotion Runtime |
| Submit participation request | `/api/v1/promotions/{promotion_id}/participation-requests` | `POST` | Promotion Runtime |
| Read own promotion participation | `/api/v1/promotions/{promotion_id}/participations/me` | `GET` | Promotion Runtime |
| Read CRM promotion view | `/api/v1/promotions/{promotion_id}/participations` | `GET` | Promotion Runtime |

Rules:

- promotions are configured, not hardcoded per route;
- Promotion Runtime owns campaign eligibility, participation and prize rules;
- REST must not decide winners, referral eligibility or seasonal campaign outcomes;
- promotion actions require audit when they affect bonus, discount or customer status.

### Machines

Machine endpoints expose machine integration and operations capabilities.

| Capability | Endpoint candidate | Method | Runtime owner |
|---|---|---|---|
| Read machine health | `/api/v1/machines/{machine_id}/health` | `GET` | Machine Runtime |
| Submit machine health | `/api/v1/machines/{machine_id}/health-reports` | `POST` | Machine Runtime |
| Submit machine telemetry | `/api/v1/machines/{machine_id}/telemetry` | `POST` | Machine Runtime |
| Submit command acknowledgement | `/api/v1/machine-acknowledgements` | `POST` | Machine Runtime |
| Pull assigned commands | `/api/v1/machine-commands` | `GET` | Machine Runtime |

Rules:

- machine endpoints require machine or adapter authentication;
- machine access must be scoped to assigned machine or adapter boundary;
- Machine Runtime owns queue, command delivery, acknowledgement and physical outcome rules;
- REST must not decide order state transitions from machine facts.

### Events

Event endpoints expose operational access to Event Runtime through REST where synchronous access is appropriate.

| Capability | Endpoint candidate | Method | Runtime owner |
|---|---|---|---|
| Read event metadata | `/api/v1/events/{event_id}` | `GET` | Event Runtime |
| List event deliveries | `/api/v1/event-deliveries` | `GET` | Event Runtime |
| Read dead-letter items | `/api/v1/event-dead-letters` | `GET` | Event Runtime |
| Create replay request | `/api/v1/event-replay-requests` | `POST` | Event Runtime |
| Read subscriptions | `/api/v1/event-subscriptions` | `GET` | Event Runtime |

Rules:

- Event Runtime owns event envelope, delivery, retry, replay and dead-letter behavior;
- business events are produced by Runtimes, not by REST route handlers;
- event payload meaning belongs to producing Runtime;
- replay requests require strict authorization and audit.

### Analytics

Analytics endpoints expose approved reporting projections.

| Capability | Endpoint candidate | Method | Runtime owner |
|---|---|---|---|
| Read sales summary | `/api/v1/analytics/sales-summary` | `GET` | Analytics Runtime |
| Read product performance | `/api/v1/analytics/product-performance` | `GET` | Analytics Runtime |
| Read machine performance | `/api/v1/analytics/machine-performance` | `GET` | Analytics Runtime |
| Read customer funnel | `/api/v1/analytics/customer-funnel` | `GET` | Analytics Runtime |
| Create export request | `/api/v1/analytics/export-requests` | `POST` | Analytics Runtime |

Rules:

- Analytics Runtime owns reporting projections;
- analytics must respect privacy, authorization and retention rules;
- REST must not derive financial truth directly from raw storage;
- approved analytics exports require authorization, audit and rate limits.

## 18. Naming Conventions

REST naming conventions must be consistent across routes and DTOs.

URI conventions:

- base path: `/api/v1`;
- resource segments: lowercase kebab-case;
- collection names: plural nouns;
- command resources: noun phrases such as `cancellation-requests`;
- path parameters: documented as `{resource_id}`;
- no secrets or raw credentials in URLs.

JSON conventions:

- field names use `snake_case`;
- IDs use stable semantic strings where appropriate;
- enum values use lowercase snake_case;
- timestamps use ISO 8601 / RFC 3339 UTC format;
- currency codes use ISO 4217 such as `RUB`;
- amounts should use integer minor units or documented decimal rules per finance contract;
- error codes use uppercase snake_case;
- boolean fields use positive names where possible.

Identifier examples:

```text
customer_id
product_soft_ice_vanilla_cup
flavor_vanilla
syrup_strawberry
topping_oreo
order_123
payment_123
machine_001
```

Header conventions:

- use standard headers where possible;
- custom request headers may use `X-` prefix until formalized;
- do not put secrets in query parameters;
- idempotency uses `Idempotency-Key`;
- tracing uses `X-Correlation-ID` until a formal trace standard is selected.

## 19. Acceptance Criteria

This documentation increment is acceptable when:

- `docs/api/REST_API.md` defines REST vision;
- API design principles are documented;
- resource naming is documented;
- HTTP method usage is documented;
- URI convention is documented;
- request structure is documented;
- response structure is documented;
- pagination is documented;
- filtering is documented;
- sorting is documented;
- error response format is documented;
- API versioning is documented;
- idempotency overview is documented;
- rate limiting overview is documented;
- authentication integration is documented;
- authorization integration is documented;
- required resource groups are documented: Customers, Wallet, Bonus, Orders, Payments, Products, Promotions, Machines, Events and Analytics;
- naming conventions are documented;
- future roadmap is documented;
- REST endpoints are explicitly documented as capability contracts only;
- REST API is explicitly transport only;
- Runtime is explicitly documented as the owner of business rules;
- no application source code, frontend code, backend code, Telegram bot code, runtime configuration or generated build output is modified.

Future implementation acceptance criteria:

- every REST route calls an approved Runtime contract;
- every protected route has authentication and authorization policy;
- every mutating route that can duplicate side effects supports idempotency;
- list routes define pagination, filtering and sorting rules;
- route errors use the standard error format;
- route contracts are documented in OpenAPI or equivalent schema;
- no REST handler contains business logic.

## 20. Future Roadmap

Recommended REST API roadmap:

1. Define route-level permission matrix for every REST resource group.
2. Create OpenAPI specification for `/api/v1`.
3. Define JSON Schema references for requests, responses and errors.
4. Define exact error code taxonomy in `docs/api/ERROR_CODES.md`.
5. Define detailed idempotency policy in `docs/api/IDEMPOTENCY.md`.
6. Define route-specific rate limits and response headers.
7. Define authentication security schemes for OpenAPI.
8. Define authorization scopes and permissions for OpenAPI.
9. Define REST contract tests for request validation and response shape.
10. Define Runtime contract tests for each REST route group.
11. Define REST observability dashboards and alerts.
12. Define SDK generation policy after OpenAPI contracts stabilize.
13. Define partner-facing REST subset and onboarding rules.
14. Define machine adapter REST subset and replay protection rules.
15. Review production REST API contracts before launch.
