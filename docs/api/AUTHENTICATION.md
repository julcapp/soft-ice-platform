# Authentication

Status: Draft
Version: 0.1
Date: 2026-07-06
Project: Soft ICE Platform / Utimoshi
Scope: Documentation only

## Purpose

This document defines the authentication direction for Soft ICE Platform API consumers, integrations and platform services.

Authentication answers:

```text
Who or what is calling the platform?
```

Core rule:

```text
Authentication verifies identity only.
Authorization is documented separately.
Authentication never contains business logic.
Runtime owns business behavior.
```

Authentication may verify credentials, validate token signatures, verify Telegram Mini App init data, verify machine credentials, verify partner credentials, create identity context, create session context, reject invalid credentials and expose safe telemetry.

Authentication must not decide product eligibility, price, discount, bonus usage, payment behavior, order transitions, machine fulfillment, loyalty rules, promotion participation or operator business permissions.

## 1. Authentication Vision

Soft ICE Platform needs one consistent authentication model for many consumers:

- Mini App;
- web app;
- Telegram bot;
- CRM and operator tools;
- vending machines and machine adapters;
- payment and notification provider callbacks;
- partner integrations;
- internal platform services;
- future SDK clients.

The authentication vision is:

```text
Many entry points.
One identity context.
No business logic.
Secure credentials.
Auditable sessions.
Runtime-owned decisions.
```

Authentication produces trusted identity context that can travel through REST requests, events, webhooks, logs, telemetry and audit records.

Authentication is complete when the platform can say which actor made the request and how that actor was verified.

Authentication is not complete when the platform knows what that actor is allowed to do. That belongs to authorization and Runtime contracts.

## 2. Identity Model

Identity is the normalized representation of an authenticated actor.

Recommended identity categories:

| Identity type | Example | Primary identifier | Notes |
|---|---|---|---|
| `customer` | Mini App customer, web customer, Telegram user | `customer_id` or temporary customer identity | Customer profile state belongs to Customer Runtime. |
| `operator` | CRM user, support user, administrator | `operator_id` | Operator roles and permissions belong to authorization and Runtime rules. |
| `machine` | Vending machine, terminal, device gateway | `machine_id` | Machine state and dispatch rules belong to Machine Runtime. |
| `machine_adapter` | Vending adapter service | `adapter_id` | Adapter identity must be separate from physical machine identity. |
| `partner` | Approved partner system or SDK client | `partner_id` | Partner entitlements belong to authorization and contract configuration. |
| `provider` | Payment, notification or external webhook provider | `provider_id` | Provider payload meaning belongs to the owning Runtime or adapter. |
| `internal_service` | Runtime service, worker, scheduler | `service_id` | Internal service identity must be distinguishable from humans. |
| `anonymous` | Public health check or public catalog request where allowed | none or generated request identity | Anonymous access must never mutate business state. |

Recommended identity context fields:

| Field | Meaning |
|---|---|
| `identity_type` | Customer, operator, machine, partner, provider, internal service or anonymous. |
| `subject_id` | Stable platform identifier for the authenticated subject. |
| `external_subject_id` | Optional external identifier, such as Telegram user ID or provider account ID. |
| `issuer` | System that issued or verified the credential. |
| `auth_method` | Session, Telegram init data, API key, JWT, signed request, provider signature, mTLS or internal trust mechanism. |
| `consumer_type` | Mini App, web app, CRM, machine adapter, provider webhook, partner, SDK or internal service. |
| `session_id` | Optional authenticated session identifier. |
| `credential_id` | Safe credential reference, not the credential value. |
| `token_id` | Optional JWT `jti` or opaque token reference. |
| `authenticated_at` | Time the identity was authenticated. |
| `expires_at` | Time the authentication context expires when applicable. |
| `correlation_id` | Request trace identifier. |
| `trust_level` | Coarse authentication assurance level, not a business permission. |

Identity rules:

- stable platform IDs should be used internally instead of phone numbers, emails or external usernames;
- external IDs must be treated as provider-specific aliases;
- secrets, raw tokens and API key values must never appear in identity context;
- identity context may contain credential references, not credential material;
- business state must not be stored in identity context;
- authorization attributes may be attached later, but authentication itself must not decide permissions.

## 3. Consumer Types

Authentication must support different consumer types without mixing their trust models.

| Consumer type | Example | Authentication model | Output identity |
|---|---|---|---|
| Customer channel | Mini App, web app | Customer session, Telegram init data exchange or future identity provider token | `customer` |
| Operator channel | CRM, support console, admin dashboard | Operator session or future identity provider token | `operator` |
| Telegram channel | Telegram Mini App, Telegram bot | Telegram init data verification or bot webhook secret verification | `customer`, `provider` or channel-specific identity |
| Machine integration | Vending machine, terminal, gateway adapter | API key, signed request, mTLS or registered adapter credential | `machine` or `machine_adapter` |
| Payment integration | YooKassa or future provider callback | Provider signature, configured secret or provider credential | `provider` |
| Notification integration | Telegram, push, SMS or email provider callback | Provider signature, token or adapter credential | `provider` |
| Partner integration | Approved partner system, SDK client | API key, OAuth client credentials or signed request | `partner` |
| Internal platform consumer | Runtime, worker, scheduler | Internal service credential or platform-issued service token | `internal_service` |

Consumer rules:

- each consumer type must have an explicit authentication method;
- a credential issued for one consumer type must not silently authenticate another consumer type;
- machine credentials must not authenticate a human;
- human sessions must not authenticate machines or partners;
- provider webhook authentication must be separate from partner API authentication;
- anonymous consumers may only use explicitly public endpoints.

## 4. Human Authentication

Human authentication covers customers and operators.

Customer authentication may use:

- Telegram Mini App init data verification;
- platform customer session;
- future web login;
- future phone or email verification;
- future identity provider token.

Operator authentication may use:

- CRM operator session;
- future identity provider token;
- future multi-factor authentication;
- future single sign-on for approved staff.

Human authentication rules:

- human authentication verifies the person or external user account;
- customer and operator identities must be separate;
- customer session creation must not create operator privileges;
- operator authentication should produce stronger audit context than customer authentication;
- operator sessions should support stricter lifetime, revocation and audit rules;
- authentication must not decide whether a customer can place an order or whether an operator can perform a specific action;
- customer profile, loyalty status, trusted customer status and consent state belong to their owning Runtime or domain documentation.

Human identity context should include:

- identity type;
- platform subject ID;
- external subject alias when applicable;
- session ID;
- authentication method;
- authentication time;
- expiration time;
- safe device or client metadata when needed for security.

## 5. Machine Authentication

Machine authentication verifies a vending machine, terminal or machine adapter identity.

Supported future models:

- registered API key for a machine adapter;
- signed request with timestamp and nonce;
- mutual TLS for high-trust device communication;
- platform-issued machine token;
- gateway credential bound to a machine fleet or location.

Machine authentication rules:

- every machine or adapter must have an explicit registered identity;
- a machine credential must identify the machine, adapter or gateway that uses it;
- machine credentials must be rotatable;
- machine requests must include replay protection for state-changing actions;
- machine acknowledgements must be authenticated before Runtime receives them;
- machine authentication must not decide whether a command is valid for the current order;
- Machine Runtime owns dispatch, queue, acknowledgement, failure and physical outcome rules.

Recommended machine identity context:

| Field | Meaning |
|---|---|
| `identity_type` | `machine` or `machine_adapter`. |
| `machine_id` | Physical machine identifier when known. |
| `adapter_id` | Adapter or gateway identifier when used. |
| `credential_id` | Safe credential reference. |
| `location_id` | Optional location reference, not a permission decision. |
| `firmware_version` | Optional reported version for observability. |
| `authenticated_at` | Authentication time. |
| `correlation_id` | Request trace identifier. |

## 6. Telegram Mini App Authentication

Telegram Mini App authentication verifies that a Mini App request carries valid Telegram-provided init data.

Expected Telegram Mini App flow:

1. Mini App receives Telegram init data from the Telegram client.
2. Mini App sends init data to the platform authentication endpoint.
3. API verifies the init data server-side using the configured bot secret.
4. API validates freshness using `auth_date` and configured lifetime policy.
5. API maps the Telegram user alias to a platform customer identity.
6. API creates or resumes a platform customer session.
7. API issues a short-lived platform access token and, if applicable, a refresh token.
8. Runtime receives only authenticated identity context, not raw Telegram credential material.

Telegram Mini App rules:

- client-provided Telegram fields must not be trusted until server-side verification passes;
- bot tokens and Telegram secrets must be stored outside repository files;
- raw init data must not be logged;
- verification failure must not reveal secret validation details;
- Telegram user ID is an external alias, not the complete customer domain model;
- Telegram authentication does not prove payment eligibility, order eligibility, discount eligibility or loyalty status;
- customer identity linking belongs to Customer Runtime or a documented identity service contract.

Recommended Telegram identity context:

| Field | Meaning |
|---|---|
| `identity_type` | `customer`. |
| `external_subject_id` | Telegram user ID or equivalent safe alias. |
| `issuer` | Telegram. |
| `auth_method` | `telegram_init_data`. |
| `consumer_type` | `telegram_mini_app`. |
| `session_id` | Platform session reference. |
| `authenticated_at` | Time of platform verification. |
| `expires_at` | Platform access token expiry. |

## 7. Vending Machine Authentication

Vending machine authentication verifies platform-to-machine and machine-to-platform communication participants.

Inbound machine calls may include:

- machine health reports;
- command acknowledgements;
- dispense result reports;
- inventory telemetry;
- error reports;
- maintenance status updates.

Outbound platform calls may include:

- command delivery to a machine adapter;
- configuration synchronization;
- health check requests;
- future maintenance commands.

Vending machine authentication rules:

- machine or adapter identity must be verified before accepting machine facts;
- machine acknowledgements must include correlation to a platform command or dispatch record;
- replayed acknowledgements must be rejected or deduplicated before Runtime processing;
- machine credentials must be scoped to machine integration, not customer or operator sessions;
- machine authentication must be observable through telemetry and audit where required;
- vending machine authentication must not decide order state transitions;
- Machine Runtime and Order Runtime own the meaning of machine facts.

Recommended credential options:

| Option | Use case | Notes |
|---|---|---|
| API key | Simple MVP adapter authentication | Must be hashed at rest and rotatable. |
| Signed request | Machine facts and acknowledgements | Requires timestamp, nonce and signature verification. |
| mTLS | Higher-security future machine communication | Requires certificate issuance and rotation process. |
| Platform-issued service token | Internal gateway to platform | Must be short-lived and scoped to the adapter identity. |

## 8. Partner Authentication

Partner authentication verifies approved external systems and SDK clients.

Partner examples:

- future franchise partner system;
- future analytics export consumer;
- future external CRM integration;
- future accounting integration;
- future public SDK client.

Partner authentication models:

- partner API key;
- OAuth 2.0 client credentials in a future implementation;
- signed request with partner secret;
- mutual TLS for high-trust integrations;
- outbound webhook signature for platform-to-partner callbacks.

Partner authentication rules:

- every partner must have a registered `partner_id`;
- every partner credential must have a `credential_id`;
- credential metadata must include owner, environment, allowed consumer type and rotation state;
- partner authentication must not grant business access by itself;
- route access, scopes and contract exposure belong to authorization and API configuration;
- partner requests must carry contract version and correlation metadata where required;
- partner credentials must be revocable without code changes.

Recommended partner identity context:

| Field | Meaning |
|---|---|
| `identity_type` | `partner`. |
| `partner_id` | Registered partner identifier. |
| `integration_id` | Optional integration or application identifier. |
| `credential_id` | Safe credential reference. |
| `consumer_type` | `partner_api`, `partner_sdk` or equivalent. |
| `contract_version` | Requested or configured API contract version. |
| `authenticated_at` | Authentication time. |
| `correlation_id` | Request trace identifier. |

## 9. API Keys

API keys authenticate non-human consumers such as partner systems, machine adapters, provider adapters and selected internal tools.

API key rules:

- API keys must never be committed to the repository;
- API keys must never be logged;
- API keys should not be accepted in URL query parameters;
- API keys must be stored hashed or protected by a secrets manager;
- API keys must include a safe prefix for identification without exposing the secret value;
- API keys must have a `credential_id`;
- API keys must have owner metadata;
- API keys must support rotation and revocation;
- production keys must be separate from development and test keys;
- API keys authenticate an integration, not a human user;
- human-sensitive actions should require human identity in addition to an integration identity when needed.

Recommended API key metadata:

| Field | Meaning |
|---|---|
| `credential_id` | Stable safe credential reference. |
| `key_prefix` | Non-secret prefix used for lookup and support. |
| `owner_type` | Partner, machine adapter, provider adapter or internal service. |
| `owner_id` | Registered owner identifier. |
| `environment` | Development, staging or production. |
| `created_at` | Creation time. |
| `expires_at` | Optional expiration time. |
| `rotated_at` | Last rotation time. |
| `revoked_at` | Revocation time when applicable. |
| `status` | Active, rotating, revoked or expired. |

API key authentication output must be identity context only. Business capabilities, domain quotas, promotion eligibility and financial permissions must be handled outside API key verification.

## 10. JWT Tokens

JWT access tokens may be used as short-lived bearer tokens for authenticated sessions and internal service calls.

JWT rules:

- access tokens must be short-lived;
- tokens must be signed with a platform-approved key;
- token signatures must be verified before Runtime receives a request;
- token issuer and audience must be validated;
- token expiration must be enforced;
- token ID should be present for audit, revocation checks or replay analysis;
- signing keys must be rotatable;
- tokens must not contain secrets;
- tokens must not contain raw payment credentials;
- tokens should avoid personal data unless required and approved;
- tokens must not contain business state such as wallet balance, bonus balance, final price, discount eligibility or order state.

Recommended JWT claims:

| Claim | Meaning |
|---|---|
| `iss` | Token issuer. |
| `sub` | Platform subject ID. |
| `aud` | Intended API audience. |
| `exp` | Expiration time. |
| `iat` | Issued-at time. |
| `nbf` | Not-before time when needed. |
| `jti` | Token ID. |
| `identity_type` | Customer, operator, machine, partner, provider or internal service. |
| `consumer_type` | Mini App, web app, CRM, machine adapter, partner, provider or internal service. |
| `session_id` | Session reference when applicable. |
| `auth_method` | Method used to authenticate the actor. |
| `credential_id` | Safe credential reference when applicable. |

JWT validation must produce identity context. JWT presence alone must not bypass authorization, Runtime validation or idempotency requirements.

## 11. Refresh Tokens

Refresh tokens may be used to renew short-lived access tokens without repeating the full human authentication flow.

Refresh token rules:

- refresh tokens should be opaque when possible;
- refresh tokens must be stored hashed or protected by a secrets manager;
- refresh tokens must be bound to a session;
- refresh tokens must be revocable;
- refresh token rotation should be used for human sessions;
- reuse of an already rotated token must be treated as a security signal;
- refresh tokens must not be used as API keys;
- refresh tokens must not be sent to Runtime contracts;
- refresh tokens must not contain business state;
- refresh tokens must be invalidated on logout, credential compromise or session revocation.

Recommended refresh token metadata:

| Field | Meaning |
|---|---|
| `refresh_token_id` | Safe token reference. |
| `session_id` | Bound session. |
| `subject_id` | Authenticated subject. |
| `identity_type` | Customer or operator by default. |
| `issued_at` | Creation time. |
| `expires_at` | Expiration time. |
| `rotated_at` | Rotation time when applicable. |
| `revoked_at` | Revocation time when applicable. |
| `last_used_at` | Last successful use. |
| `device_reference` | Optional safe device reference. |

Machine, partner and provider credentials should normally use dedicated credential rotation instead of human-style refresh tokens.

## 12. Token Lifetime

Token lifetime is an infrastructure security policy. It must not encode business eligibility rules.

Recommended lifetime policy direction:

| Credential type | Suggested direction | Notes |
|---|---|---|
| Customer access token | Short-lived | Long enough for normal Mini App use, short enough to reduce exposure. |
| Operator access token | Short-lived and stricter than customer where practical | Operator actions require stronger audit and revocation control. |
| Internal service token | Short-lived | Prefer automated rotation and narrow audience. |
| Machine signed request | Very short freshness window | Use timestamp and nonce to reduce replay risk. |
| Partner API key | Longer-lived but rotatable | Must support expiration, rotation and revocation. |
| Refresh token | Longer-lived than access token | Must be revocable and preferably rotated on use. |
| Provider webhook signature | Provider-defined plus platform freshness checks where possible | Verify according to provider contract and platform policy. |

Lifetime rules:

- all token lifetime values must be explicit configuration;
- lifetime values must be environment-aware;
- Clock Service should provide consistent time checks;
- expired credentials must be rejected before Runtime processing;
- token renewal must not extend revoked sessions;
- lifetime policy must be reviewed before production launch;
- lifetime policy must not depend on product, order, payment, discount or loyalty state.

Future implementation should define exact production defaults after security review.

## 13. Session Management

Sessions connect repeated human requests to a verified identity.

Session state may include:

- `session_id`;
- `identity_type`;
- `subject_id`;
- authentication method;
- consumer type;
- safe device reference;
- creation time;
- last active time;
- expiration time;
- revocation time;
- refresh token references;
- security flags.

Session management rules:

- session records must not contain raw credentials;
- session records must not contain business state;
- customer sessions and operator sessions must be separated;
- logout must revoke or invalidate the active session according to configured policy;
- credential compromise must allow forced session revocation;
- operator sessions should be auditable;
- session creation, refresh, revocation and suspicious reuse should be observable;
- Runtime contracts should receive identity and session references, not session storage internals.

Session management must not decide product availability, final price, payment state, order state, machine queue state, loyalty status or promotion eligibility.

## 14. Security Rules

Authentication security rules:

- use secure transport for external authentication traffic;
- keep secrets outside repository source code;
- never log passwords, tokens, API keys, signatures, init data, bot tokens or raw secrets;
- reject invalid credentials before Runtime processing;
- verify token issuer, audience, signature, expiration and not-before fields where applicable;
- verify provider and Telegram signatures before trusting payloads;
- protect signed requests with timestamp and replay controls;
- rate-limit authentication endpoints and credential verification failures;
- use generic error messages for authentication failures;
- store credential material hashed or in an approved secrets system;
- support credential rotation and revocation;
- propagate only safe identity context;
- audit sensitive authentication events;
- do not expose internal stack traces or validation internals;
- use correlation IDs for authentication logs and telemetry;
- isolate authentication code from domain business logic.

Authentication failure behavior:

| Scenario | Expected result |
|---|---|
| Missing required credential | Reject as unauthenticated. |
| Invalid credential | Reject as unauthenticated. |
| Expired token | Reject as unauthenticated or require refresh when allowed. |
| Revoked session | Reject as unauthenticated. |
| Invalid Telegram init data | Reject as unauthenticated. |
| Invalid machine signature | Reject as unauthenticated. |
| Invalid partner API key | Reject as unauthenticated. |
| Valid identity but insufficient route access | Defer to authorization policy. |
| Valid identity but invalid business action | Defer to Runtime domain rules. |

## 15. Authentication Flow

The standard API authentication flow:

1. Receive request.
2. Assign or read `correlation_id`.
3. Identify consumer type from route, host, headers, client registration or integration boundary.
4. Extract expected credential type.
5. Reject missing credentials when the route requires authentication.
6. Verify credential signature, secret, token, session or provider proof.
7. Validate freshness, expiration, issuer, audience and replay controls where applicable.
8. Resolve safe credential reference and subject identity.
9. Build normalized identity context.
10. Attach identity context to security context.
11. Record safe telemetry and audit data where required.
12. Pass request to authorization and contract validation.
13. Route the request to Runtime contracts only after security context is established.

Authentication flow boundaries:

- authentication may stop the request before authorization;
- authentication may not approve a business action;
- authentication may not call Product, Pricing, Discount, Bonus, Payment, Order, Machine, Notification or Promotion engines to decide eligibility;
- Runtime receives authenticated context and owns domain validation.

Illustrative flow:

```text
Request
  -> API boundary
  -> credential extraction
  -> credential verification
  -> identity context
  -> authorization boundary
  -> contract validation
  -> Runtime contract
```

## 16. Acceptance Criteria

This documentation increment is acceptable when:

- `docs/api/AUTHENTICATION.md` defines the authentication vision;
- identity model is documented;
- consumer types are documented;
- human authentication is documented;
- machine authentication is documented;
- Telegram Mini App authentication is documented;
- vending machine authentication is documented;
- partner authentication is documented;
- API key rules are documented;
- JWT token rules are documented;
- refresh token rules are documented;
- token lifetime direction is documented;
- session management rules are documented;
- security rules are documented;
- authentication flow is documented;
- future roadmap is documented;
- authentication is explicitly limited to identity verification;
- authorization is explicitly documented as separate;
- authentication contains no business logic;
- no application source code, frontend code, backend code, Telegram bot code, runtime configuration or generated build output is modified.

Future implementation acceptance criteria:

- every protected request produces normalized identity context before Runtime processing;
- invalid credentials are rejected before Runtime processing;
- secrets are stored outside repository files;
- authentication failures are observable without leaking secrets;
- tokens and credentials are rotatable and revocable;
- authentication context is propagated through REST, events, webhooks, logs, telemetry and audit records;
- business decisions remain in Runtime and authorization contracts, not authentication handlers.

## 17. Future Roadmap

Recommended authentication roadmap:

1. Create `docs/api/AUTHORIZATION.md` to define route access, scopes, roles and Runtime authorization boundaries.
2. Define the Security Context contract shared by API, Kernel, Runtime, Event API and webhooks.
3. Define exact API authentication error codes in `docs/api/ERROR_CODES.md`.
4. Define OpenAPI security schemes for API keys, bearer tokens, signed requests and provider webhooks.
5. Define Telegram Mini App verification contract and freshness configuration.
6. Define machine credential provisioning and rotation process.
7. Define partner registration, credential issuance and credential revocation process.
8. Define JWT signing key rotation and `kid` handling policy.
9. Define refresh token storage and reuse detection policy.
10. Define session storage, logout and forced revocation contracts.
11. Define authentication audit events.
12. Define authentication telemetry dashboards and alert rules.
13. Define contract tests for authentication middleware and adapters.
14. Evaluate future OAuth 2.0 or OpenID Connect provider integration.
15. Review production token lifetimes before launch.
