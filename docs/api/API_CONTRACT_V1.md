# API Contract v1

## Machine Operations Platform v1 (2026-07-21)

Base path: `/api/v1/machine-operations`. These endpoints require a verified operator security context. `X-Operator-ID` is a trusted reverse-proxy assertion for internal v1 deployment only: the gateway must authenticate the operator, strip caller-supplied identity headers, and inject canonical `operator_id`. Missing/unknown identity returns `401`; missing permission returns `403`.

| Method | Path | Permission | Result |
|---|---|---|---|
| `POST` | `/operators` | admin settings management | Create an operator. |
| `POST` | `/checklists` | checklist configure | Create an immutable checklist version. |
| `POST` | `/maintenance-tasks` | checklist configure | Assign a task. |
| `POST` | `/maintenance-tasks/{id}/execute` | maintenance execute | Complete the assigned task. |
| `POST` | `/test-runs` | test execute + inventory consume | Atomically record a run and consumption. |
| `POST` | `/inventory-movements` | inventory consume | Record standalone consumption. |
| `POST` | `/service-logs` | service report submit | Submit a service report. |
| `POST` | `/service-logs/{id}/approve` | service report approve | Approve a submitted report. |
| `POST` | `/photo-evidence` | photo evidence create | Store immutable photo metadata. |
| `GET` | `/actions` | actions read-all | Return audited operator actions. |
| `PUT` | `/machines/{machineId}/settings/{key}` | machine settings manage | Upsert an operational setting. |

Test-run `consumptions` must include `cup`, `ice_cream_mix`, and `topping`, each with positive `quantity` and a `unit`. The response embeds created inventory movements. Common idempotency, correlation, and request headers apply.

## Production platform endpoints and tracing

`GET /health/live` reports process liveness without database access. `GET /health/ready` returns `200` only when the database/Prisma probe succeeds and otherwise returns `503`. These operational routes are outside `/api/v1`.

API responses return `X-Request-ID` and `X-Correlation-ID`; callers may supply either or the platform generates it. Unexpected failures are normalized to `INTERNAL_ERROR` without stack traces or secrets.

Document code: API-CONTRACT-V1-001
Task: API-007
Version: 0.1
Status: Draft
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-13
Last updated: 2026-07-13
Scope: Documentation only

Related documents:

- `docs/api/API_OVERVIEW.md`
- `docs/api/REST_API.md`
- `docs/api/AUTHENTICATION.md`
- `docs/api/AUTHORIZATION.md`
- `docs/api/EVENT_API.md`
- `docs/data/DATABASE_FOUNDATION.md`
- `docs/domain/PAYMENT_LEDGER_CONTRACT.md`
- `docs/domain/CLUB_ACCOUNT_CONTRACT.md`
- `docs/architecture/DOMAIN_EVENTS_CONTRACT.md`
- `docs/architecture/MVP_BACKEND_ARCHITECTURE.md`
- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/ORDER_DOMAIN.md`
- `docs/domain/MACHINE_DOMAIN.md`
- `docs/product/TELEGRAM_BOT_FLOW.md`

---

# 1. API Principles

This document defines REST API contracts for the MVP backend.

Core rule:

```text
API v1 is a contract boundary.
Runtime owns business logic.
Database ownership follows DATABASE_FOUNDATION.
Payments follow PAYMENT_LEDGER_CONTRACT.
Club Account balance follows CLUB_ACCOUNT_CONTRACT.
Events follow DOMAIN_EVENTS_CONTRACT.
This document creates no application code.
```

Base path:

```text
/api/v1
```

General principles:

- REST routes expose Runtime-owned commands and queries, not repositories, tables or internal engines.
- API handlers authenticate, authorize, validate request shape, enforce idempotency, rate-limit, route, observe and return DTOs.
- API handlers must not calculate product configuration, pricing, discounts, bonus usage, final payment state, order transitions, machine fulfillment state or notification content.
- `customer_id` is the canonical customer identity. Telegram ID, phone, email and provider customer IDs are external aliases.
- Source-of-truth records are future PostgreSQL records owned by explicit domains as described in `DATABASE_FOUNDATION`.
- Financial and financial-adjacent facts are append-only after acceptance.
- Raw provider success, redirect success, QR scan success, webhook delivery or UI timer state is not enough to credit Club Account, mark an Order as paid or dispatch a Machine.
- Machine telemetry and acknowledgements are equipment facts. Order Runtime decides order lifecycle effects after accepting Machine Runtime facts.
- Telegram Bot is a channel adapter. It does not own payment, account, order, machine or customer state.
- Every mutating endpoint that can be retried or duplicated requires idempotency.
- All timestamps use UTC ISO 8601 / RFC 3339.
- JSON fields use `snake_case`; enum values use lowercase `snake_case`; error codes use uppercase `SNAKE_CASE`.
- MVP currency is `RUB`; monetary field semantics must remain aligned with Finance and Payment contracts before implementation.

Common request headers:

| Header | Required when | Purpose |
|---|---|---|
| `Authorization` | Protected customer, operator, machine, partner or service routes. | Authenticates the caller. |
| `Idempotency-Key` | Mutating requests where duplicate submission can cause side effects. | Prevents duplicate accepted side effects. |
| `X-Correlation-ID` | Optional for all requests; generated when missing. | End-to-end trace identifier. |
| `Content-Type` | JSON request bodies. | Must be `application/json`. |
| `Accept` | All API calls. | Expected response media type. |
| `X-Client-Version` | Customer and operator clients where available. | Client observability and compatibility. |
| `X-Signature` | Signed machine, provider or Telegram integration calls where configured. | Replay and authenticity check. |

Common response metadata:

```json
{
  "meta": {
    "api_version": "v1",
    "correlation_id": "corr_01K0000000000000000000000"
  }
}
```

---

# 2. Authentication Flow

Authentication verifies who or what is calling the API. Authorization and Runtime validation remain separate.

## 2.1 Customer Telegram Mini App Session

Endpoint:

```text
POST /api/v1/auth/telegram-mini-app/sessions
```

Owner:

```text
Authentication boundary with Customer Runtime identity linking
```

Purpose:

- verify Telegram Mini App init data server-side;
- resolve or create a platform customer identity through Customer Runtime or documented identity contract;
- issue a platform session and access token;
- return safe customer bootstrap references.

Request body fields:

| Field | Required | Rule |
|---|---:|---|
| `telegram_init_data` | Yes | Raw init data is accepted only by this authentication endpoint and must not be logged. |
| `client_request_id` | Recommended | Client trace reference. |
| `source_channel` | Yes | `telegram_mini_app`. |

Success response:

```json
{
  "data": {
    "type": "auth_session",
    "id": "session_01K0000000000000000000000",
    "attributes": {
      "identity_type": "customer",
      "customer_id": "customer_01K0000000000000000000000",
      "access_token": "redacted_bearer_token",
      "token_type": "Bearer",
      "expires_at": "2026-07-13T12:15:00Z"
    }
  },
  "meta": {
    "api_version": "v1",
    "correlation_id": "corr_01K0000000000000000000000"
  }
}
```

Rules:

- Telegram user ID is an external alias and must resolve to `customer_id` before customer-owned resources are accessed.
- Raw Telegram init data must not reach Product, Pricing, Payment, Club Account, Order or Machine Runtime contracts.
- Authentication does not grant business eligibility, discount eligibility, payment success or order state.
- `Customers.TelegramIdentityLinked` may be emitted only after Customer Runtime accepts the identity link.

## 2.2 Session Refresh

Endpoint:

```text
POST /api/v1/auth/sessions/{session_id}/refresh
```

Purpose:

- exchange a valid refresh credential for a new short-lived access token.

Rules:

- refresh token values must not be sent to Runtime contracts;
- rotated or revoked refresh tokens must be rejected;
- suspicious reuse must be audited.

## 2.3 Logout

Endpoint:

```text
POST /api/v1/auth/sessions/{session_id}/revocation-requests
```

Purpose:

- revoke a customer or operator session.

Rules:

- requires authentication for the session owner or an authorized operator;
- mutating endpoint, idempotency recommended;
- must not delete historical customer, order, payment or audit facts.

## 2.4 Machine, Provider and Telegram Webhook Authentication

Machine, provider and Telegram integration endpoints use their own configured trust models:

| Caller | Authentication direction |
|---|---|
| Machine adapter | API key, signed request, mTLS or platform-issued service token. |
| Payment provider | Provider signature or configured webhook credential. |
| Telegram Bot webhook | Telegram secret token or configured webhook signature check. |
| Internal service | Internal service identity with scoped token. |

Authentication failures return `401 Unauthorized` and must not reach Runtime contracts.

---

# 3. Customer Endpoints

Customer endpoints expose customer identity, profile, consent and customer-safe projections.

Runtime owner:

```text
Customer Runtime, with Notification Runtime for preferences
```

## 3.1 Endpoint Summary

| Capability | Method | Endpoint | Auth | Idempotency |
|---|---|---|---|---|
| Read own customer profile | `GET` | `/api/v1/customers/me` | Customer | No |
| Update own allowed profile fields | `PATCH` | `/api/v1/customers/me` | Customer | Yes |
| Read own consent history | `GET` | `/api/v1/customers/me/consents` | Customer | No |
| Submit consent decision | `POST` | `/api/v1/customers/me/consents` | Customer | Decision ID |
| Consent compatibility alias | `GET/POST` | `/api/v1/customers/me/consent-decisions` | Customer | Decision ID for POST |
| Read notification preferences | `GET` | `/api/v1/customers/me/notification-preferences` | Customer | No |
| Update notification preferences | `PATCH` | `/api/v1/customers/me/notification-preferences` | Customer | Yes |
| Read CRM customer view | `GET` | `/api/v1/customers/{customer_id}` | Operator | No |
| List CRM customer views | `GET` | `/api/v1/customers` | Operator | No |

## 3.2 Customer Profile DTO

Required response fields for customer self-service:

| Field | Rule |
|---|---|
| `customer_id` | Canonical platform ID. |
| `display_name` | Customer-safe name when available. |
| `status` | Customer lifecycle status from Customer Runtime. |
| `club_membership_status` | Customer or Club membership projection when available. |
| `telegram_linked` | Boolean projection, not raw Telegram identity. |
| `created_at` | UTC timestamp. |
| `updated_at` | UTC timestamp. |

Forbidden fields:

- raw Telegram init data;
- raw phone or email unless a route explicitly exposes a masked or verified contact DTO;
- payment provider customer references;
- internal fraud notes in customer self-service responses;
- secrets, tokens or authorization policy internals.

## 3.3 Customer Rules

- Customer self-service routes are scoped to the authenticated `customer_id`.
- CRM customer routes require operator identity, route authorization and audit.
- Customer endpoints must not return Club Account balance by joining storage directly; they may include links or approved projections.
- Consent decisions are versioned facts and may produce `Customers.ConsentGranted` or `Customers.ConsentRevoked`.
- Notification preference changes may produce `Customers.NotificationPreferenceChanged`.

---

## 3.4 Customer Segmentation Endpoints

Runtime owner: `SegmentationRuntime`.

| Capability | Method | Endpoint | Auth |
|---|---|---|---|
| Read active own segments | `GET` | `/api/v1/customers/me/segments` | Customer |
| Read own assignment history | `GET` | `/api/v1/customers/me/segment-history` | Customer |

The customer segment DTO contains `customer_id`, `segment_id`, `segment_code`, `source`, `reason`, `assigned_by`, `active`, `assigned_at` and `unassigned_at`. Future operator mutation endpoints must call `SegmentationRuntime`; direct table mutation is forbidden. They are deferred until operator authentication and authorization exist.

Segment rule criteria are internal declarative configuration. Customer endpoints do not expose criteria, advertising audiences, or recommendation logic.

# 4. Club Account Endpoints

Club Account endpoints expose prepaid account projections, top-up workflow commands and account transaction history.

Runtime owner:

```text
Club Account Runtime
```

Source contracts:

- `CLUB_ACCOUNT_CONTRACT`
- `PAYMENT_LEDGER_CONTRACT`
- `DATABASE_FOUNDATION`
- `DOMAIN_EVENTS_CONTRACT`

## 4.1 Endpoint Summary

| Capability | Method | Endpoint | Auth | Idempotency |
|---|---|---|---|---|
| Read own Club Account | `GET` | `/api/v1/club-accounts/me` | Customer | No |
| Read own Club Account transactions | `GET` | `/api/v1/club-accounts/me/transactions` | Customer | No |
| Request top-up | `POST` | `/api/v1/club-accounts/me/top-ups` | Customer | Yes |
| Read top-up workflow | `GET` | `/api/v1/club-accounts/me/top-ups/{top_up_id}` | Customer | No |
| Read CRM Club Account view | `GET` | `/api/v1/club-accounts/{club_account_id}` | Operator | No |
| Request operator adjustment | `POST` | `/api/v1/club-account-adjustment-requests` | Operator | Yes |

## 4.2 Club Account Projection DTO

Required response fields:

| Field | Rule |
|---|---|
| `club_account_id` | Stable Club Account ID. |
| `customer_id` | Owner customer. |
| `status` | `pending_activation`, `active`, `suspended`, `closing_pending` or `closed`. |
| `currency` | MVP default `RUB`. |
| `available_balance` | Runtime projection from posted transactions. |
| `reserved_balance` | Runtime projection from posted reservations. |
| `total_balance` | Runtime projection. |
| `minimum_recommended_balance` | MVP policy value, currently `150`. |
| `recommended_top_up_amount` | MVP policy value, currently `100`. |
| `low_balance_state` | `ok`, `below_minimum`, `notification_sent` or `suppressed`. |
| `last_transaction_id` | Last applied transaction reference. |
| `projection_version` | Monotonic projection version. |

Rules:

- API must never calculate balance.
- API must never mutate balance directly.
- Balance changes require immutable `ClubAccountTransaction` records.
- `available_balance` and `reserved_balance` must not be client-provided truth.

## 4.3 Top-Up Request

Endpoint:

```text
POST /api/v1/club-accounts/me/top-ups
```

Request body:

| Field | Required | Rule |
|---|---:|---|
| `amount` | Yes | Must be greater than zero and accepted by Club Account and Payment policy. |
| `currency` | Yes | MVP `RUB`. |
| `payment_method_hint` | Optional | Example: `yookassa_card`, `sbp`, `qr`. Payment Runtime decides actual session. |
| `return_url` | Optional | Customer channel return URL when provider flow needs it. |
| `client_request_id` | Recommended | Client trace reference. |

Success response:

| Field | Rule |
|---|---|
| `top_up_id` | Club Account top-up workflow ID. |
| `club_account_id` | Target account. |
| `payment_intent_id` | Payment Runtime intent reference when created. |
| `payment_session_id` | Present when a concrete payment session is created. |
| `status` | Top-up workflow status, not balance credit. |
| `confirmation` | Safe provider-independent confirmation data when available. |
| `expires_at` | Payment/session expiration when applicable. |

Top-up rules:

- `POST /top-ups` does not credit balance.
- Provider success does not credit balance.
- Club Account credits only after it consumes `Payments.Completed` / `PaymentCompleted` with `purpose = club_account_top_up`, matching account/customer IDs, amount, currency, Payment ledger entry and Ledger references.
- Duplicate top-up request with same idempotency key and same semantic payload returns the existing top-up workflow.
- Same idempotency key with different amount, currency or account returns `409 IDEMPOTENCY_CONFLICT`.

## 4.4 Transaction History

Endpoint:

```text
GET /api/v1/club-accounts/me/transactions
```

List rules:

- cursor pagination is required;
- transactions are append-only in customer-visible order;
- raw Ledger internals, provider secrets and raw webhook data are forbidden;
- operator adjustment details are masked unless customer-visible policy allows them.

---

# 5. Payment Endpoints

Payment endpoints expose provider-independent payment intents, sessions, status views, provider callback ingestion and refund requests.

Runtime owner:

```text
Payment Runtime
```

Source contracts:

- `PAYMENT_LEDGER_CONTRACT`
- `DATABASE_FOUNDATION`
- `DOMAIN_EVENTS_CONTRACT`
- `CLUB_ACCOUNT_CONTRACT`

## 5.1 Endpoint Summary

| Capability | Method | Endpoint | Auth | Idempotency |
|---|---|---|---|---|
| Create payment intent/session | `POST` | `/api/v1/payments` | Customer or internal service | Yes |
| Read payment status | `GET` | `/api/v1/payments/{payment_intent_id}` | Customer, operator or internal service | No |
| Create payment session for existing intent | `POST` | `/api/v1/payments/{payment_intent_id}/sessions` | Customer or internal service | Yes |
| Request payment cancellation | `POST` | `/api/v1/payments/{payment_intent_id}/cancellation-requests` | Customer, operator or internal service | Yes |
| Request refund | `POST` | `/api/v1/refund-requests` | Customer, operator or internal service | Yes |
| Receive YooKassa webhook | `POST` | `/api/v1/payment-webhooks/yookassa` | Provider | Provider idempotency |
| Import provider reconciliation report | `POST` | `/api/v1/payment-provider-report-imports` | Operator or internal service | Yes |

## 5.2 Create Payment

Endpoint:

```text
POST /api/v1/payments
```

Request body:

| Field | Required | Rule |
|---|---:|---|
| `purpose` | Yes | `order_payment`, `club_account_top_up`, `refund_recovery`, `support_payment` or approved future purpose. |
| `amount` | Yes | Must match the accepted source contract. |
| `currency` | Yes | MVP `RUB`. |
| `customer_id` | Context | Usually derived from auth; internal service may pass safe context. |
| `order_id` | Required for order payment | Must reference accepted Order payable amount. |
| `club_account_id` | Required for top-up | Must belong to `customer_id`. |
| `top_up_id` | Required when top-up workflow exists | Club Account workflow reference. |
| `payment_method` | Optional | Provider-independent method hint. |
| `return_url` | Optional | Safe customer return URL. |

Success response fields:

| Field | Rule |
|---|---|
| `payment_intent_id` | Provider-independent payment identity. |
| `payment_session_id` | Present when a provider or channel session exists. |
| `purpose` | Echoed accepted purpose. |
| `amount` | Accepted amount. |
| `currency` | Accepted currency. |
| `status` | Provider-independent platform status. |
| `confirmation` | Safe confirmation data, such as redirect URL or QR reference, when available. |
| `expires_at` | Session or intent expiration when applicable. |

Payment rules:

- Payment Runtime owns provider abstraction and settlement lifecycle.
- API must not recalculate payable amount.
- API must not accept client-provided final paid state.
- YooKassa status `succeeded` is provider success only. `Payments.Completed` is emitted only after Payment ledger completion and required Ledger policy.
- Order and Club Account consume accepted payment facts idempotently; Payment does not mutate their storage directly.

## 5.3 Payment Status

Endpoint:

```text
GET /api/v1/payments/{payment_intent_id}
```

Response status values:

| Status | Meaning |
|---|---|
| `created` | Intent accepted; no provider outcome yet. |
| `confirmation_required` | Customer must confirm through approved channel. |
| `processing` | Provider or internal method outcome pending. |
| `pending_ledger` | Provider/internal success exists, Ledger policy pending. |
| `completed` | Payment ledger is completed and downstream fact may be consumed. |
| `failed` | Payment failed before completion. |
| `cancelled` | Payment cancelled before completion. |
| `expired` | Payment expired before completion. |
| `manual_review` | Outcome unsafe or ambiguous. |

Customer-visible status must be safe and must not expose provider secrets, raw webhook payloads, internal stack traces or raw Ledger entries.

## 5.4 Provider Webhook

Endpoint:

```text
POST /api/v1/payment-webhooks/yookassa
```

Rules:

- provider authentication and signature verification must pass before processing;
- duplicate webhook delivery must be idempotent;
- webhook creates or updates PaymentRegistry and normalized PaymentOperation facts only through Payment Runtime;
- raw webhook payload may be stored only in protected integration storage according to policy;
- webhook handler must not credit Club Account, mark Order as paid or dispatch Machine directly;
- `200 OK` or provider-required equivalent may be returned for duplicates after safe deduplication.

---

# 6. Order Endpoints

Order endpoints expose checkout, order status, cancellation and refund context.

Runtime owner:

```text
Order Runtime
```

Source contracts:

- `DATABASE_FOUNDATION`
- `PAYMENT_LEDGER_CONTRACT`
- `DOMAIN_EVENTS_CONTRACT`
- Order Platform documents

## 6.1 Endpoint Summary

| Capability | Method | Endpoint | Auth | Idempotency |
|---|---|---|---|---|
| Create order | `POST` | `/api/v1/orders` | Customer | Yes |
| Read own order | `GET` | `/api/v1/orders/{order_id}` | Customer or operator | No |
| List own orders | `GET` | `/api/v1/orders` | Customer | No |
| Read order fulfillment | `GET` | `/api/v1/orders/{order_id}/fulfillment` | Customer or operator | No |
| Request cancellation | `POST` | `/api/v1/orders/{order_id}/cancellation-requests` | Customer or operator | Yes |
| Request refund from order | `POST` | `/api/v1/orders/{order_id}/refund-requests` | Customer or operator | Yes |

## 6.2 Create Order

Endpoint:

```text
POST /api/v1/orders
```

Request body:

| Field | Required | Rule |
|---|---:|---|
| `sales_channel_id` | Yes | Example: `telegram_mini_app`, `telegram_bot`, `terminal`. |
| `machine_id` | Optional for MVP; required when customer starts from a known machine. | Must be accepted by Order/Machine policy. |
| `items` | Yes | MVP supports one item but contract must not block future multi-item orders. |
| `items[].product_id` | Yes | Stable catalog ID. |
| `items[].configuration` | Yes | Flavor, syrup, topping and future add-ons as contract fields. |
| `bonus_reservation_id` | Optional | Only if Bonus Runtime accepted reservation. |
| `client_request_id` | Recommended | Client trace reference. |

Success response fields:

| Field | Rule |
|---|---|
| `order_id` | Stable Order ID. |
| `order_number` | Customer-visible number when assigned. |
| `status` | Order lifecycle state. |
| `configuration_snapshot_id` | Immutable accepted configuration snapshot. |
| `pricing_snapshot_id` | Immutable accepted pricing snapshot. |
| `discount_snapshot_id` | Present when discounts are applied. |
| `payable_amount` | Runtime-calculated payable amount. |
| `currency` | MVP `RUB`. |
| `payment_required` | Whether payment is required before dispatch. |
| `links.payment` | Link or reference to create payment when applicable. |

Order rules:

- API must not calculate configuration validity, price, discounts or bonus effects.
- Order Runtime stores immutable product, configuration, pricing and discount snapshots.
- Client-provided price, paid state, machine result or fulfillment state is never trusted as final truth.
- Order paid state requires accepted Payment fact with Payment ledger and Ledger-backed policy.
- Machine dispatch is allowed only after Order Runtime accepts paid state.

## 6.3 Order Status

Order response states should map to documented Order lifecycle states. MVP customer-safe examples:

| Status | Meaning |
|---|---|
| `created` | Order accepted but not paid. |
| `payment_pending` | Payment flow is active. |
| `payment_confirmed` | Order accepted `Payments.Completed`. |
| `queued` | Fulfillment queue accepted. |
| `preparation_started` | Machine preparation accepted by Order. |
| `ready` | Product ready or dispensed according to accepted facts. |
| `completed` | Order completed. |
| `cancelled` | Order cancelled before completion. |
| `expired` | Order expired before completion. |
| `refund_pending` | Refund workflow active. |
| `refunded` | Refund completion accepted. |
| `manual_review` | Support or operations review required. |

---

# 7. Machine Dispatch Endpoints

Machine dispatch endpoints support paid-order dispatch, command delivery, machine acknowledgement and telemetry.

Runtime owner:

```text
Machine Runtime with Order Runtime accepting order lifecycle effects
```

Source contracts:

- `DATABASE_FOUNDATION`
- `DOMAIN_EVENTS_CONTRACT`
- `docs/domain/MACHINE_DOMAIN.md`
- `docs/machine/MACHINE_STATE_MODEL.md`
- `docs/machine/MACHINE_EVENTS_TELEMETRY.md`

## 7.1 Endpoint Summary

| Capability | Method | Endpoint | Auth | Idempotency |
|---|---|---|---|---|
| Create dispatch from paid order | `POST` | `/api/v1/machine-dispatches` | Internal service | Yes |
| Read dispatch status | `GET` | `/api/v1/machine-dispatches/{dispatch_id}` | Operator or internal service | No |
| Pull assigned machine commands | `GET` | `/api/v1/machine-commands` | Machine adapter | No |
| Submit command acknowledgement | `POST` | `/api/v1/machine-commands/{command_id}/acknowledgements` | Machine adapter | Yes |
| Submit machine event | `POST` | `/api/v1/machines/{machine_id}/events` | Machine adapter | Yes |
| Submit telemetry | `POST` | `/api/v1/machines/{machine_id}/telemetry` | Machine adapter | Yes |
| Read machine health | `GET` | `/api/v1/machines/{machine_id}/health` | Operator or machine adapter | No |
| Submit health report | `POST` | `/api/v1/machines/{machine_id}/health-reports` | Machine adapter | Yes |

## 7.2 Create Dispatch

Endpoint:

```text
POST /api/v1/machine-dispatches
```

Caller:

```text
Order Runtime or internal service after paid order state is accepted
```

Request body:

| Field | Required | Rule |
|---|---:|---|
| `order_id` | Yes | Must be paid according to Order Runtime. |
| `order_item_id` | Yes | Item to prepare. |
| `machine_id` | Yes for MVP | Selected machine. |
| `recipe_id` | Yes | Recipe reference accepted from product/order snapshot. |
| `configuration_snapshot_id` | Yes | Immutable order configuration reference. |
| `payment_completed_id` | Yes | Accepted payment completion fact reference. |
| `payment_ledger_entry_id` | Yes | Ledger-backed payment completion reference. |
| `correlation_id` | Yes | End-to-end flow ID. |

Rules:

- API route must not decide that an order is paid.
- Dispatch is rejected if Order Runtime has not accepted paid state.
- Dispatch command creation is idempotent by `order_id + order_item_id + machine_id + payment_completed_id`.
- Duplicate dispatch request returns the existing `dispatch_id` and current state.
- Machine command side effects must not be repeated during replay.

## 7.3 Machine Acknowledgement

Endpoint:

```text
POST /api/v1/machine-commands/{command_id}/acknowledgements
```

Request body fields:

| Field | Required | Rule |
|---|---:|---|
| `machine_id` | Yes | Must match authenticated machine or adapter scope. |
| `dispatch_id` | Yes | Dispatch reference. |
| `machine_operation_id` | Yes | Operation reference from Machine Runtime. |
| `acknowledgement_type` | Yes | `accepted`, `rejected`, `started`, `completed`, `failed` or approved future value. |
| `occurred_at` | Yes | Machine-side UTC timestamp when available. |
| `reason_code` | Required for rejection or failure | Safe machine reason. |
| `telemetry_ref` | Optional | Protected telemetry reference. |

Rules:

- acknowledgement is a machine fact, not an Order state transition by itself;
- Machine Runtime records the fact and emits canonical Machine events when accepted;
- Order Runtime accepts relevant Machine facts before emitting Order lifecycle events;
- duplicate acknowledgement must not repeat preparation, dispensing or customer notifications.

---

# 8. Telegram Integration Endpoints

Telegram endpoints support Mini App authentication, bot update ingestion and notification channel delivery reporting.

Runtime owner:

```text
Authentication, Customer Runtime, Notification Runtime and Telegram channel adapter
```

Source contracts:

- `docs/product/TELEGRAM_BOT_FLOW.md`
- `DOMAIN_EVENTS_CONTRACT`
- `AUTHENTICATION`
- `AUTHORIZATION`

## 8.1 Endpoint Summary

| Capability | Method | Endpoint | Auth | Idempotency |
|---|---|---|---|---|
| Create Mini App customer session | `POST` | `/api/v1/auth/telegram-mini-app/sessions` | Telegram init data | Recommended |
| Receive Telegram Bot update | `POST` | `/api/v1/telegram/webhook` | Telegram secret/signature | Telegram update id |
| Read Mini App bootstrap | `GET` | `/api/v1/telegram/mini-app/bootstrap` | Customer | No |
| Record Telegram send result | `POST` | `/api/v1/telegram/notification-results` | Telegram adapter or internal service | Yes |

## 8.2 Telegram Bot Webhook

Endpoint:

```text
POST /api/v1/telegram/webhook
```

Rules:

- authenticate Telegram webhook before processing;
- deduplicate by Telegram update ID and normalized semantic payload;
- route customer commands to documented API or Runtime contracts;
- never mutate Payment, Club Account, Order, Machine or Customer source-of-truth state directly from bot handler code;
- raw Telegram payloads are protected integration data and must not be written into domain events;
- customer-visible messages are decided by Notification Runtime when triggered by domain events.

## 8.3 Mini App Bootstrap

Endpoint:

```text
GET /api/v1/telegram/mini-app/bootstrap
```

Purpose:

- return customer-safe startup information after authentication.

Response may include:

| Field | Rule |
|---|---|
| `customer` | Safe customer summary. |
| `club_account` | Link or projection from Club Account Runtime. |
| `available_machine` | Machine/location projection when launch context includes a machine. |
| `catalog_entrypoint` | Link to product/catalog API. |
| `feature_flags` | API-safe flags only. |

Rules:

- bootstrap response must not calculate business rules;
- absence of a Club Account, machine or product option must be represented as state, not hidden route behavior;
- raw Telegram identity data is forbidden in response.

---

# 9. Error Format

All REST errors use one standard response shape.

```json
{
  "error": {
    "error_id": "err_01K0000000000000000000000",
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed.",
    "details": [
      {
        "field": "amount",
        "issue": "must be greater than zero"
      }
    ],
    "source": "api",
    "retryable": false
  },
  "meta": {
    "api_version": "v1",
    "correlation_id": "corr_01K0000000000000000000000"
  }
}
```

Required fields:

| Field | Rule |
|---|---|
| `error.error_id` | Unique error instance ID. |
| `error.code` | Stable machine-readable code. |
| `error.message` | Safe human-readable summary. |
| `error.details` | Optional safe structured details. |
| `error.source` | `api`, `runtime`, `platform_service`, `adapter`, `provider` or `machine_adapter`. |
| `error.retryable` | Whether retry may be safe. |
| `meta.correlation_id` | Trace ID. |
| `meta.api_version` | `v1`. |

Recommended status mapping:

| HTTP status | Example codes | Rule |
|---:|---|---|
| `400` | `VALIDATION_FAILED`, `UNSUPPORTED_PARAMETER` | Request shape or parameter is invalid. |
| `401` | `AUTHENTICATION_REQUIRED`, `AUTHENTICATION_INVALID` | Missing or invalid authentication. |
| `403` | `AUTHORIZATION_DENIED`, `AUTHORIZATION_SCOPE_DENIED` | Authenticated actor lacks route access. |
| `404` | `RESOURCE_NOT_FOUND` | Resource missing or intentionally hidden. |
| `409` | `IDEMPOTENCY_CONFLICT`, `STATE_CONFLICT`, `VERSION_CONFLICT` | Duplicate key conflict or state conflict. |
| `422` | `DOMAIN_REJECTED`, `PAYMENT_POLICY_REJECTED`, `ORDER_POLICY_REJECTED` | Runtime rejected domain input. |
| `429` | `RATE_LIMIT_EXCEEDED` | Rate limit exceeded. |
| `500` | `INTERNAL_ERROR` | Unexpected server failure. |
| `503` | `RUNTIME_UNAVAILABLE`, `PROVIDER_UNAVAILABLE`, `MACHINE_UNAVAILABLE` | Required dependency unavailable. |

Error rules:

- authentication and authorization errors must not reveal secret validation or policy internals;
- provider errors are normalized before returning to clients;
- payment, account, order and machine errors must preserve auditability through correlation IDs;
- internal stack traces, raw SQL, raw provider payloads, webhook signatures, tokens and secrets are forbidden;
- duplicate webhook or event delivery should return an existing result or safe acknowledgement when policy allows.

---

# 10. Idempotency Requirements

Idempotency prevents duplicate accepted side effects.

General rule:

```text
Same idempotency key + same semantic payload = existing result.
Same idempotency key + different semantic payload = 409 IDEMPOTENCY_CONFLICT.
Missing required idempotency key = 400 IDEMPOTENCY_KEY_REQUIRED.
```

The API uses the `Idempotency-Key` header for customer, operator and internal mutating requests. Provider and Telegram callbacks may also use provider-native event IDs or update IDs as part of idempotency scope.

## 10.1 Required Idempotency Scopes

| Scope | Endpoint or event | Recommended key pattern |
|---|---|---|
| Telegram Mini App session exchange | `POST /auth/telegram-mini-app/sessions` | `telegram_session:{telegram_user_hash}:{auth_date}:{client_request_id}` |
| Customer profile update | `PATCH /customers/me` | `customer_profile_update:{customer_id}:{client_request_id}` |
| Consent decision | `POST /customers/me/consent-decisions` | `customer_consent:{customer_id}:{consent_type}:{policy_version}:{decision_id}` |
| Club Account top-up request | `POST /club-accounts/me/top-ups` | `club_top_up_request:{club_account_id}:{amount}:{currency}:{request_id}` |
| Payment creation | `POST /payments` | `payment_intent:{purpose}:{source_id}:{amount}:{currency}` |
| Payment session creation | `POST /payments/{payment_intent_id}/sessions` | `payment_session:{payment_intent_id}:{provider}:{amount}:{currency}:{attempt_number}` |
| YooKassa webhook | `POST /payment-webhooks/yookassa` | `provider_webhook:{provider}:{event_reference}:{external_payment_reference}:{status}` |
| Refund request | `POST /refund-requests` | `refund_request:{original_payment_ledger_entry_id}:{amount}:{currency}:{reason_code}:{request_id}` |
| Order creation | `POST /orders` | `order_create:{customer_id}:{cart_or_configuration_hash}:{client_request_id}` |
| Order cancellation request | `POST /orders/{order_id}/cancellation-requests` | `order_cancel:{order_id}:{reason_code}:{request_id}` |
| Machine dispatch | `POST /machine-dispatches` | `machine_dispatch:{order_id}:{order_item_id}:{machine_id}:{payment_completed_id}` |
| Machine acknowledgement | `POST /machine-commands/{command_id}/acknowledgements` | `machine_ack:{machine_operation_id}:{command_id}:{acknowledgement_type}` |
| Machine event | `POST /machines/{machine_id}/events` | `machine_event:{machine_id}:{machine_operation_id}:{event_type}:{occurred_at}` |
| Telegram bot webhook | `POST /telegram/webhook` | `telegram_update:{update_id}` |
| Telegram notification result | `POST /telegram/notification-results` | `telegram_notification:{customer_id}:{source_event_id}:{notification_intent}:{channel}` |

## 10.2 Idempotency Record Fields

Future implementation must store enough metadata to compare duplicate requests safely:

| Field | Rule |
|---|---|
| `idempotency_key` | Stable key supplied by caller or derived from trusted provider event. |
| `scope` | Operation scope. |
| `actor_context` | Safe actor identity reference. |
| `semantic_hash` | Hash of normalized business-relevant payload. |
| `status` | `processing`, `completed`, `failed`, `rejected` or `expired`. |
| `result_reference` | Accepted resource, transaction, payment, order, dispatch or event reference. |
| `correlation_id` | Flow ID. |
| `first_seen_at` | First accepted timestamp. |
| `last_seen_at` | Last duplicate timestamp. |
| `expires_at` | Retention expiry when policy allows. |

Forbidden in idempotency records:

- provider secrets;
- raw card data;
- raw Telegram init data;
- raw webhook signatures;
- raw phone or email;
- unmasked provider authorization data.

## 10.3 Event and Replay Idempotency

Event contracts follow `DOMAIN_EVENTS_CONTRACT`:

- publication retries reuse the same `event_id`;
- consumers deduplicate by `event_id` and domain idempotency key;
- `Payments.Completed` is keyed by `payment_intent_id + payment_ledger_entry_id`;
- Club Account top-up credit is keyed by `club_account_id + payment_completed_id`;
- Order events are keyed by `order_id + state_version + event_name`;
- Machine command facts are keyed by `machine_operation_id + command_id + event_type`;
- Telegram notifications are keyed by `customer_id + source_event_id + notification_intent + channel`;
- replay must suppress payments, refunds, Club Account credits/debits, machine commands and customer notifications unless an approved replay mode explicitly allows projection rebuild only.

---

# 11. Documentation Scope

This document is documentation-only.

It does not introduce application code, backend routes, frontend calls, Telegram bot code, provider calls, webhook handlers, machine adapter code, database migrations, Prisma schema changes, OpenAPI files, generated schemas, environment variables, real API keys, generated build output, payment processing, Club Account transaction implementation, Order transition implementation, machine dispatch runtime or notification templates.

Future implementation readiness additionally requires:

- OpenAPI or equivalent schema contracts for every active route;
- route-level permission matrix;
- exact request and response JSON schemas;
- production authentication and token lifetime review;
- provider webhook signature policy;
- machine adapter signature and replay policy;
- idempotency storage policy;
- event registry entries for emitted domain events;
- contract tests for validation, authorization, idempotency, duplicate webhooks and replay-safe behavior.
# Huaxin Machine Gateway v1

All gateway endpoints require Bearer authentication and return the standard API v1 `data` and `meta` envelope. Vendor XML is never exposed through this API.

| Method | Path | Result |
|---|---|---|
| `GET` | `/api/v1/machine/status` | Connection, availability, heartbeat freshness, reconnect attempts and queue depth. |
| `GET` | `/api/v1/machine/telemetry` | Bounded, newest-first normalized telemetry samples. |
| `POST` | `/api/v1/machine/command` | Queues a command with `type`, optional `command_id`, `machine_id` and scalar `payload`; returns `202` after acknowledgement. |
| `POST` | `/api/v1/machine/reconnect` | Requests a disconnect/connect cycle and returns `202` with current status. |

Gateway errors use `MACHINE_COMMAND_INVALID`, `MACHINE_CONNECTION_UNAVAILABLE`, `MACHINE_COMMAND_TIMEOUT`, `MACHINE_QUEUE_FULL`, `MACHINE_PROTOCOL_INVALID_RESPONSE`, `MACHINE_COMMAND_REJECTED` or `MACHINE_GATEWAY_ERROR`. Retryability is explicit in the standard error envelope. API handlers do not build XML, operate sockets or make Order, Payment, Inventory or customer decisions.

# Customer Identity Core v1

Customer identity routes require Bearer authentication and use the standard API v1 envelope.

| Method | Path | Result |
|---|---|---|
| `GET` | `/api/v1/customers/me` | Safe canonical customer profile with verified-phone and linked-provider status. |
| `POST` | `/api/v1/customers/me/phone-verifications` | Verifies and binds a unique normalized phone through the configured phone verifier. |
| `GET` | `/api/v1/customers/me/identities` | Safe active external identity list; hashes and provider credentials are excluded. |
| `POST` | `/api/v1/customers/me/consent-decisions` | Appends an idempotent decision for a versioned policy document. |
| `GET` | `/api/v1/customers/me/consent-decisions` | Customer consent decision history. |

SberID and MAX are Runtime/provider placeholders only in v1. No public provider-linking callback is exposed. Loyalty, promotions and advertising are outside this contract.
