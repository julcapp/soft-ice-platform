# Auth Core Contract

Document code: AUTH-CORE-001
Task: SECURITY-001
Version: 0.1
Status: Draft
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-13
Last updated: 2026-07-13
Scope: Documentation only

Related documents:

- `docs/api/AUTHENTICATION.md`
- `docs/api/AUTHORIZATION.md`
- `docs/api/API_CONTRACT_V1.md`
- `docs/api/REST_API.md`
- `docs/api/IDEMPOTENCY.md`
- `docs/architecture/MVP_BACKEND_ARCHITECTURE.md`
- `docs/architecture/DOMAIN_EVENTS_CONTRACT.md`
- `docs/data/DATABASE_FOUNDATION.md`
- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/product/TELEGRAM_BOT_FLOW.md`

---

# 1. Purpose

This document defines the Auth Core foundation for Soft ICE Platform.

Auth Core is the platform security contract for:

- authentication;
- user identity;
- sessions and tokens;
- Telegram and Mini App sign-in;
- role boundaries;
- permission boundaries;
- API authorization rules;
- audit logging;
- security decisions.

Core rule:

```text
Auth Core verifies identity and access policy.
Runtime owns business rules.
Auth Core must not contain product, pricing, payment, order, machine, loyalty or promotion logic.
```

This document is documentation-only. It does not implement middleware, routes, storage, JWT signing, Telegram verification, database schema, operator UI, role assignment UI, secrets, migrations or generated build output.

---

# 2. Authentication Model

Authentication answers:

```text
Who or what is calling the platform?
```

Auth Core supports multiple actor types through one normalized security context.

| Actor type | Primary platform ID | Typical auth method | Notes |
|---|---|---|---|
| `user` | `customer_id` | Telegram Mini App session, future web session | Customer-facing self-service actor. |
| `operator` | `operator_id` | Future operator session or identity provider | Human staff or administrator. |
| `machine` | `machine_id` | Machine credential, signed request or mTLS | Physical vending machine identity. |
| `machine_adapter` | `adapter_id` | API key, signed request or service token | Adapter or gateway identity. |
| `provider` | `provider_id` | Provider signature or webhook secret | Payment, Telegram or notification provider callback. |
| `partner` | `partner_id` | Partner API key or future OAuth client credentials | Approved external integration. |
| `internal_service` | `service_id` | Service token or internal credential | Runtime, worker or scheduler. |
| `anonymous` | none | none | Public routes only. Must not mutate state. |

Authentication may:

- extract credentials from approved headers or request bodies;
- verify Telegram init data server-side;
- verify access tokens, refresh flows, API keys, signatures or provider webhooks;
- validate issuer, audience, expiry, freshness and replay controls;
- resolve safe platform identity references;
- create session references;
- produce security context;
- reject unauthenticated requests before Runtime execution;
- record safe telemetry and audit events.

Authentication must not:

- grant route permissions by itself;
- calculate prices, discounts or bonus usage;
- decide payment success, order state or machine fulfillment;
- create or mutate Club Account balance;
- trust raw Telegram, provider or machine data as domain truth;
- log secrets, tokens, signatures, raw Telegram init data or API keys.

## 2.1 Security Context

Every protected request must produce a normalized security context before authorization.

Recommended fields:

| Field | Rule |
|---|---|
| `subject_type` | `user`, `operator`, `machine`, `machine_adapter`, `provider`, `partner`, `internal_service` or `anonymous`. |
| `subject_id` | Stable platform ID for the actor when authenticated. |
| `external_subject_id` | Optional safe external alias reference. Prefer hashed or masked values. |
| `auth_method` | `telegram_init_data`, `access_token`, `api_key`, `signed_request`, `provider_signature`, `service_token`, `operator_session` or approved future value. |
| `session_id` | Present for human session flows. |
| `credential_id` | Safe credential reference for non-human credentials. |
| `token_id` | Access token ID or JWT `jti` when available. |
| `consumer_type` | `telegram_mini_app`, `web_app`, `crm`, `machine_adapter`, `provider_webhook`, `partner_api`, `internal_service` or approved future value. |
| `trust_level` | Coarse assurance level. Not a business permission. |
| `authenticated_at` | UTC timestamp. |
| `expires_at` | UTC timestamp when context expires. |
| `correlation_id` | End-to-end trace reference. |

Forbidden fields:

- raw Telegram init data;
- bot tokens;
- API key values;
- refresh token values;
- webhook signatures;
- passwords or one-time codes;
- payment credentials;
- business state such as balance, price, order state or discount eligibility.

---

# 3. User Identity Model

The customer-facing user identity is the platform customer identity.

Canonical user identifier:

```text
customer_id
```

External identities are aliases only:

- Telegram user ID;
- Telegram username;
- phone;
- email;
- future OAuth subject;
- payment provider customer reference;
- partner customer reference.

External aliases may authenticate or link a customer, but platform contracts must use `customer_id` after identity resolution.

## 3.1 User Identity Fields

Recommended customer identity fields:

| Field | Rule |
|---|---|
| `customer_id` | Canonical platform user ID. |
| `status` | Customer lifecycle status owned by Customer Runtime. |
| `display_name` | Customer-safe display name when available. |
| `primary_channel` | Optional customer acquisition or preferred channel. |
| `created_at` | UTC timestamp. |
| `updated_at` | UTC timestamp. |

Auth Core may reference these fields for identity context, but Customer Runtime owns the customer profile and lifecycle.

## 3.2 Identity Link Fields

Recommended identity link fields:

| Field | Rule |
|---|---|
| `identity_link_id` | Stable identity link record ID. |
| `customer_id` | Canonical customer. |
| `provider` | `telegram`, `phone`, `email`, `oauth`, `payment_provider`, `partner` or approved future value. |
| `external_subject_ref` | Safe external alias reference; raw sensitive values are avoided where possible. |
| `verified_at` | UTC timestamp when proof was accepted. |
| `linked_at` | UTC timestamp. |
| `revoked_at` | Optional UTC timestamp. |
| `status` | `active`, `revoked`, `conflicted` or `manual_review`. |

Identity link rules:

- one Telegram account may link to one active customer identity unless an approved account merge process exists;
- conflicting identity links require manual review or deterministic Customer Runtime policy;
- identity link changes must be audited;
- unlinking an external identity must not delete historical orders, payments or audit records;
- identity linking may emit `Customers.TelegramIdentityLinked` only after Customer Runtime accepts the link.

---

# 4. Telegram Authentication Flow

Telegram authentication covers Telegram Mini App init data and Telegram Bot webhook trust.

## 4.1 Telegram Mini App Init Data Verification

Flow:

1. Telegram client opens the Mini App and provides init data to the frontend.
2. Mini App sends init data to the platform session exchange endpoint.
3. API assigns or reads `correlation_id`.
4. Auth Core verifies init data server-side using configured Telegram bot secret material.
5. Auth Core validates `auth_date` freshness according to configured lifetime policy.
6. Auth Core rejects missing, expired, malformed or invalid init data.
7. Auth Core resolves the Telegram user alias to an existing `customer_id` or asks Customer Runtime to create/link identity according to the Customer contract.
8. Auth Core creates or resumes a platform session.
9. Auth Core issues a short-lived access token and, when allowed, an opaque refresh token.
10. Runtime receives only safe identity context.

Rules:

- client-provided Telegram fields are untrusted until server verification passes;
- raw init data is accepted only by the auth endpoint;
- raw init data must not be logged or stored in domain records;
- Telegram ID is not a platform authorization subject after resolution; `customer_id` is used instead;
- Telegram authentication does not prove payment success, order eligibility, discount eligibility or loyalty status;
- failure responses must not expose signature verification details.

## 4.2 Telegram Bot Webhook Authentication

Telegram Bot webhook calls must be authenticated before update processing.

Rules:

- webhook secret or approved signature check must pass before routing;
- Telegram update IDs are used for deduplication;
- bot handlers are channel adapters and must not mutate Payment, Club Account, Order, Machine or Customer source-of-truth state directly;
- business actions triggered by bot commands must go through documented API or Runtime contracts;
- raw Telegram payloads are protected integration data and must not be written into public events.

---

# 5. Mini App Authentication Flow

Primary customer flow:

1. Customer opens Telegram Mini App.
2. Mini App obtains Telegram init data from Telegram WebApp runtime.
3. Mini App calls:

```text
POST /api/v1/auth/telegram-mini-app/sessions
```

4. Auth Core verifies Telegram init data and resolves `customer_id`.
5. Auth Core creates or resumes a session.
6. API returns:

```text
session_id
customer_id
access_token
token_type
expires_at
```

7. Mini App calls protected API endpoints with bearer access token.
8. API authenticates access token, authorizes route access and routes to Runtime contracts.
9. Mini App refreshes session when access token expires and refresh policy allows it.
10. Logout revokes or invalidates session according to configured policy.

Mini App rules:

- Mini App must not store raw Telegram init data longer than needed for session exchange;
- access tokens must be short-lived;
- refresh tokens, if used by Mini App, must be protected and revocable;
- expired or revoked sessions must require a new valid Telegram exchange or allowed refresh flow;
- Mini App bootstrap responses must not expose raw Telegram data, secrets, authorization policy internals or business state not approved by Runtime contracts.

---

# 6. Session and Token Model

Sessions connect repeated human requests to a verified identity.

Tokens carry proof of an authenticated context for a limited time.

## 6.1 Session Record

Recommended session fields:

| Field | Rule |
|---|---|
| `session_id` | Stable session reference. |
| `subject_type` | Usually `user` or `operator`. |
| `subject_id` | `customer_id` or `operator_id`. |
| `auth_method` | Authentication method used to create session. |
| `consumer_type` | Mini App, web app, CRM or approved future value. |
| `created_at` | UTC timestamp. |
| `last_seen_at` | UTC timestamp. |
| `expires_at` | UTC timestamp. |
| `revoked_at` | Optional UTC timestamp. |
| `revocation_reason` | Safe reason code when revoked. |
| `device_reference` | Optional safe device or client reference. |
| `security_flags` | Optional safe flags such as `refresh_reuse_detected`. |

Session records must not contain raw credentials or business state.

## 6.2 Access Tokens

Access tokens may be JWT or opaque tokens in future implementation.

Rules:

- access tokens are short-lived;
- token issuer, audience, expiry and signature or lookup must be verified;
- access tokens must not contain secrets;
- access tokens must not contain balance, price, discount, payment, order or machine state;
- token claims must be safe identity and authorization context only;
- signing keys or lookup credentials must be rotatable;
- revoked sessions must invalidate associated token usage according to policy.

Recommended token claims or token metadata:

| Field | Rule |
|---|---|
| `iss` | Platform issuer. |
| `sub` | Platform subject ID. |
| `aud` | Intended API audience. |
| `exp` | Expiry. |
| `iat` | Issued at. |
| `jti` | Token ID. |
| `subject_type` | Actor category. |
| `session_id` | Human session reference when applicable. |
| `auth_method` | Authentication method. |
| `consumer_type` | Channel or client type. |

## 6.3 Refresh Tokens

Refresh tokens renew short-lived access tokens without repeating full authentication.

Rules:

- refresh tokens should be opaque;
- refresh tokens must be stored hashed or protected by approved secrets infrastructure;
- refresh tokens must be bound to one session;
- refresh tokens must be revocable;
- refresh token rotation is preferred for human sessions;
- refresh token reuse after rotation is a security signal and must be audited;
- refresh tokens must not reach Runtime contracts.

## 6.4 Lifetime Policy

Token and session lifetimes are explicit configuration.

Rules:

- customer access tokens are short-lived;
- operator sessions should be stricter than customer sessions where practical;
- machine signed requests use very short freshness windows with nonce or replay controls;
- API keys are longer-lived but rotatable and revocable;
- exact production lifetimes require security review before launch;
- lifetime policy must not depend on product, price, balance, order, payment or loyalty state.

---

# 7. Roles

Auth Core defines three initial human-facing roles.

Permissions remain the atomic access units. Roles are named bundles of permissions and scope.

## 7.1 User

Role ID:

```text
role_user
```

Actor:

```text
user
```

Purpose:

- customer self-service through Mini App, Telegram Bot and future web app.

Allowed boundary:

- read public catalog and media where exposed;
- authenticate through Telegram Mini App or future customer auth;
- read and update own allowed customer profile fields;
- read own Club Account, bonus, order and payment projections;
- submit own order, payment, top-up, consent and notification preference commands.

Forbidden boundary:

- access another customer's resources;
- use CRM, admin, machine, partner or internal service routes;
- assign roles;
- read raw provider, machine, audit, credential or operator data;
- bypass Runtime business validation.

## 7.2 Project Admin

Role ID:

```text
role_project_admin
```

Actor:

```text
operator
```

Purpose:

- day-to-day project administration and operational support for approved environments.

Allowed boundary:

- read CRM support views according to need-to-know policy;
- read order, payment, Club Account and machine support projections;
- submit support actions through Runtime contracts where explicitly permitted;
- manage approved project configuration where policy allows;
- read limited audit records for support and operations;
- review machine and integration health.

Forbidden boundary:

- bypass Runtime business rules;
- access raw secrets, raw API keys or token values;
- grant Platform Owner role;
- create unreviewed emergency access;
- mutate financial history directly;
- delete audit records;
- dispatch machines or mark payments/orders complete outside Runtime contracts.

Project Admin actions require audit logging.

## 7.3 Platform Owner

Role ID:

```text
role_platform_owner
```

Actor:

```text
operator
```

Purpose:

- highest platform governance, security and ownership authority.

Allowed boundary:

- approve and assign Project Admin access;
- manage platform-level security policy through approved processes;
- approve credential issuance, rotation and revocation workflows;
- approve production configuration and feature flag changes;
- review full audit records according to privacy and security policy;
- authorize emergency access with time-limited scope;
- approve major security, identity and authorization decisions.

Forbidden boundary:

- bypass Runtime business invariants;
- edit immutable financial, order or audit facts directly;
- expose secrets in logs, docs or UI;
- use owner privilege as a substitute for provider, machine or payment verification;
- disable audit for high-risk operations.

Platform Owner access must be strongly authenticated, scoped, auditable and reviewed.

---

# 8. Permission Boundaries

Permission format:

```text
<domain>:<resource>:<action>
```

Examples:

```text
customer:own:read
customer:own:update
club_account:own:read
club_account:own:top_up
order:own:create
order:own:read
payment:own:initiate
crm:customer:read
crm:order:read
admin:operator:assign_role
admin:credential:manage
admin:audit:read
```

Boundary rules:

- deny by default when policy is missing;
- authenticate before authorizing;
- use platform IDs for scope checks;
- `customer_id` is the customer scope subject, not Telegram ID, phone or email;
- own-resource access is the default for User role;
- Project Admin access is need-to-know and scoped by environment, project and route;
- Platform Owner access is elevated but still cannot bypass Runtime business rules;
- machine credentials never grant human permissions;
- provider credentials never grant admin or customer permissions;
- partner credentials never grant internal service or owner permissions;
- temporary access must expire automatically;
- role and permission changes must be audited.

Permission checks must not call domain engines to decide business outcomes. They may allow or deny route access only.

---

# 9. API Authorization Rules

Authorization answers:

```text
What is this authenticated actor allowed to call?
```

Standard flow:

1. API receives request.
2. API assigns or reads `correlation_id`.
3. Authentication builds security context.
4. API identifies route, method, contract version and consumer type.
5. Authorization loads route policy.
6. Authorization resolves roles, scopes and permissions.
7. Authorization denies missing or insufficient access before Runtime execution.
8. API validates request shape.
9. API enforces idempotency where required.
10. API routes allowed requests to Runtime contracts with security context.
11. Runtime validates business rules.

Route policy rules:

- every protected route must declare required authentication;
- every protected route must declare required permissions;
- every protected route must declare required scope;
- every mutating route must declare idempotency policy;
- customer routes must enforce `own` scope by `customer_id`;
- admin and CRM routes require operator identity and audit;
- Platform Owner routes require elevated role and stronger audit;
- machine routes require machine or adapter identity and replay controls;
- provider webhook routes require provider authentication and provider event deduplication;
- public routes must be explicitly marked public.

Recommended HTTP behavior:

| Scenario | Result |
|---|---|
| Missing required identity | `401 Unauthorized`. |
| Invalid, expired or revoked credential | `401 Unauthorized`. |
| Authenticated but missing permission | `403 Forbidden`. |
| Authenticated but outside scope | `403 Forbidden`. |
| Route intentionally hidden from actor | `404 Not Found` allowed by policy. |
| Runtime business rejection | Runtime domain error, not auth error. |

Authorization failures must include a correlation ID and safe error code without exposing policy internals.

---

# 10. Audit Logging Requirements

Auth Core audit logs record security-sensitive facts.

Audit is required for:

- Telegram identity link creation, conflict and revocation;
- session creation, refresh, revocation and suspicious refresh reuse;
- authentication failures above configured thresholds;
- access denied on sensitive routes;
- Project Admin and Platform Owner role assignment or revocation;
- credential creation, rotation, revocation and failed verification spikes;
- API key use for high-risk integrations;
- provider webhook authentication failures;
- machine authentication failures and replay detections;
- configuration, feature flag and security policy changes;
- CRM access to sensitive customer, order, payment, account or machine records;
- emergency access creation, use and expiration.

Recommended audit fields:

| Field | Rule |
|---|---|
| `audit_id` | Stable audit record ID. |
| `event_type` | Security event name. |
| `subject_type` | Actor category. |
| `subject_id` | Platform actor ID when known. |
| `target_type` | Resource, role, credential, session, policy or route. |
| `target_id` | Safe target reference. |
| `action` | `authenticate`, `authorize`, `assign`, `revoke`, `rotate`, `deny`, `refresh`, `link`, `unlink` or approved value. |
| `decision` | `allow`, `deny`, `success`, `failure`, `manual_review` or approved value. |
| `reason_code` | Safe machine-readable reason. |
| `auth_method` | Authentication method when relevant. |
| `permissions` | Permissions involved when relevant. |
| `roles` | Roles involved when relevant. |
| `scope` | Scope involved when relevant. |
| `correlation_id` | Trace ID. |
| `occurred_at` | UTC timestamp. |

Audit logs must not contain:

- raw Telegram init data;
- API key values;
- access or refresh token values;
- webhook signatures;
- bot tokens;
- passwords or one-time codes;
- raw card/payment credentials;
- internal stack traces;
- unnecessary personal data.

Future implementation must make security audit records tamper-resistant according to the database and audit storage contracts.

---

# 11. Security Decisions

Auth Core decisions accepted by this contract:

1. Auth Core is platform security infrastructure, not a business Runtime.
2. `customer_id` is the canonical customer/user identity inside platform contracts.
3. Telegram ID, phone, email and provider customer IDs are external aliases only.
4. Telegram Mini App init data must be verified server-side before trust.
5. Raw Telegram init data must not be logged or sent to Runtime contracts.
6. Mini App customer sessions use short-lived access tokens.
7. Refresh tokens, when used, are opaque, revocable and excluded from Runtime contracts.
8. Access tokens must not contain business state.
9. The initial human roles are User, Project Admin and Platform Owner.
10. Roles do not bypass Runtime business validation.
11. Permissions are explicit, semantic and deny by default.
12. Project Admin and Platform Owner actions require audit logging.
13. Provider, machine, partner and internal service credentials authenticate non-human actors only.
14. Machine and provider callbacks must be authenticated and deduplicated before Runtime processing.
15. Secrets, raw tokens, signatures and API key values must never be committed, logged or exposed in API responses.
16. Every security-sensitive operation must carry correlation context.
17. Production token lifetimes, key rotation and emergency access policies require security review before launch.

---

# 12. Future Implementation Readiness

Before production implementation, the platform must define:

- exact route permission matrix for API v1;
- exact token format and signing or lookup strategy;
- access token and refresh token lifetimes;
- session storage schema;
- refresh token storage and rotation policy;
- Telegram init data verification module contract;
- operator authentication model;
- role assignment storage model;
- credential registry and rotation workflow;
- machine signed request and replay policy;
- provider webhook signature policy;
- audit event registry;
- security dashboards and alert rules;
- contract tests for authentication, authorization, denied access, token refresh, role boundaries and Telegram verification.

---

# 13. Non-Implementation Scope

This contract does not create:

- backend middleware;
- API routes;
- Telegram verification code;
- JWT signing code;
- database tables;
- Prisma schema or migrations;
- operator UI;
- role management UI;
- API keys or secrets;
- environment variables;
- provider integrations;
- machine credential code;
- generated build output.
