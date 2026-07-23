# Authorization

## Machine Operations permissions

Machine Operations v1 defines `machine_operations:maintenance:execute`, `machine_operations:test_run:execute`, `machine_operations:inventory:consume`, `machine_operations:photo_evidence:create`, `machine_operations:service_report:submit`, `machine_operations:actions:read_all`, `machine_operations:service_report:approve`, `machine_operations:checklist:configure`, and `machine_operations:machine_settings:manage`.

Operator receives only the first five execution/reporting grants. Admin additionally receives read-all, approval, checklist, and machine-settings grants. Neither role receives price, commercial, or loyalty mutation authority from Machine Operations. Operator identity headers are trusted only after gateway authentication.

Status: Draft
Version: 0.1
Date: 2026-07-06
Project: Soft ICE Platform / Utimoshi
Scope: Documentation only

## Purpose

This document defines the authorization direction for Soft ICE Platform API consumers, integrations and platform services.

Authorization answers:

```text
What are you allowed to do?
```

Core rule:

```text
Authentication answers: who are you?
Authorization answers: what are you allowed to do?
Authorization never contains business logic.
Runtime owns business rules.
API Gateway enforces access policy.
```

Authorization uses authenticated identity context, roles, scopes, permissions, route policy and trusted integration metadata to decide whether a request may reach a Runtime contract.

Authorization must not decide product eligibility, price, discount eligibility, bonus usage, payment outcome, order lifecycle state, machine fulfillment validity, loyalty status, campaign eligibility or support workflow business outcome.

## 1. Authorization Vision

Soft ICE Platform needs one consistent authorization model for many platform actors:

- customers;
- machines and machine adapters;
- CRM operators;
- administrators;
- partners;
- API clients;
- payment and notification providers;
- internal platform services;
- future SDK consumers.

The authorization vision is:

```text
One identity model.
Explicit permissions.
Scoped access.
Least privilege.
Auditable decisions.
Runtime-owned business rules.
```

Authorization is complete when the platform can decide whether an authenticated actor may call a route, use an API contract, read a resource class or submit a command envelope.

Authorization is not complete when the platform knows whether the requested business action should succeed. That belongs to Runtime contracts.

For example:

- API Gateway may decide that a customer can call `POST /api/v1/orders`.
- Order Runtime decides whether the submitted product configuration can become an order.
- API Gateway may decide that a machine adapter can submit a machine acknowledgement.
- Machine Runtime decides whether the acknowledgement is valid for the current dispatch state.

## 2. Difference Between Authentication and Authorization

Authentication and authorization are separate platform concerns.

| Concern | Question | Output | Must not do |
|---|---|---|---|
| Authentication | Who are you? | Identity context, session context, credential reference and trust metadata. | Decide permissions or business eligibility. |
| Authorization | What are you allowed to do? | Authorization context, allowed route access, scopes and permission decision. | Decide Runtime business rules. |
| Runtime validation | Is this business action valid now? | Domain result, rejection, event or state transition. | Trust API permission as business truth. |

Authentication verifies identity.

Authorization grants or denies platform access.

Runtime applies business rules.

Required identity rule:

```text
CustomerID is the primary platform identity.
```

Platform contracts should use `customer_id` as the canonical customer identity field.

External identities are aliases only:

- TelegramID;
- phone;
- email;
- VK ID;
- external OAuth IDs;
- payment provider customer references;
- partner customer references.

External identities may help authenticate or link a customer. They must not become the primary authorization subject inside platform contracts.

## 3. Permission Model

A permission is a stable authorization unit that allows a specific actor type to access a protected platform capability.

Recommended permission format:

```text
<domain>:<resource>:<action>
```

Examples:

```text
catalog:product:read
order:own:create
order:own:read
payment:own:initiate
machine:ack:create
crm:customer:read
crm:order:update
admin:configuration:update
partner:analytics:read
api_client:webhook:receive
```

Permission model rules:

- permissions must be stable and semantic;
- permissions must not encode implementation technology;
- permissions must not contain business rule outcomes;
- permissions should be grouped by domain or platform capability;
- permissions should distinguish read and write access;
- permissions should distinguish own-resource access from platform-wide access;
- permissions should be assigned through roles or scopes, not ad hoc route code;
- sensitive permissions must require audit logging;
- deprecated permissions remain reserved until migration is complete.

Permission categories:

| Category | Example permissions | Boundary |
|---|---|---|
| Public read | `catalog:product:read`, `media:public:read` | May be anonymous only when explicitly configured. |
| Customer self-service | `order:own:create`, `order:own:read`, `payment:own:initiate` | Requires `customer_id` subject. |
| Machine integration | `machine:health:write`, `machine:ack:create`, `machine:telemetry:write` | Requires machine or adapter identity. |
| CRM operation | `crm:customer:read`, `crm:order:read`, `crm:support:update` | Requires operator identity and audit context. |
| Administration | `admin:configuration:update`, `admin:operator:assign_role`, `admin:machine:register` | Requires administrator role and strong audit. |
| Partner API | `partner:catalog:read`, `partner:orders:read`, `partner:webhook:manage` | Requires registered partner and scoped contract. |
| Internal service | `runtime:event:publish`, `runtime:job:execute`, `runtime:health:read` | Requires internal service identity and narrow scope. |

Authorization must check permission presence. Runtime must check business validity.

## 4. Role Model

A role is a named bundle of permissions for a class of actors.

Roles make administration easier, but permissions remain the atomic authorization unit.

Recommended role examples:

| Role ID | Actor type | Direction |
|---|---|---|
| `role_customer` | Customer | Customer self-service access for own orders, payments, profile and loyalty views. |
| `role_machine_adapter` | Machine adapter | Machine telemetry, health and acknowledgement access for assigned adapter boundary. |
| `role_crm_operator` | Operator | CRM read and support workflow permissions. |
| `role_crm_manager` | Operator | CRM operator permissions plus selected support escalation permissions. |
| `role_admin` | Operator | Platform administration permissions with audit. |
| `role_security_admin` | Operator | Credential, role, scope and policy administration with elevated audit. |
| `role_partner` | Partner | Approved partner API permissions according to contract. |
| `role_api_client` | API client | Non-human API access with client-specific scopes. |
| `role_internal_service` | Internal service | Service-to-service permissions for a specific platform service. |

Role rules:

- roles must be explicit and documented;
- roles must be assigned to platform identities or registered clients;
- role assignment must be auditable;
- roles must not contain business state such as loyalty tier, wallet balance, discount eligibility or order status;
- customer and operator roles must be separate;
- machine roles must not grant human permissions;
- partner roles must not grant internal service permissions;
- admin roles must not automatically bypass Runtime business rules;
- high-risk roles should require stronger authentication and approval workflow before assignment.

Role expansion:

```text
identity -> roles -> scopes -> permissions -> route decision
```

Runtime may receive the resulting authorization context, but Runtime remains responsible for business validation.

## 5. Scope Model

A scope limits where a role or permission applies.

Scopes make permissions safer by reducing blast radius.

Recommended scope dimensions:

| Scope dimension | Example | Purpose |
|---|---|---|
| Resource ownership | `own` | Actor can access only resources bound to its own identity. |
| Machine boundary | `machine_id`, `adapter_id`, `machine_group_id` | Machine or adapter can access only assigned equipment. |
| Partner boundary | `partner_id`, `integration_id` | Partner can access only approved integration resources. |
| Organization boundary | `tenant_id` or future franchise ID | Future multi-tenant or franchise isolation. |
| Environment | `development`, `staging`, `production` | Prevent credential reuse across environments. |
| Contract version | `api:v1` | Limit client access to approved API contracts. |
| Operation group | `read`, `write`, `admin`, `webhook` | Separate access class by action type. |
| Time boundary | `valid_from`, `valid_until` | Temporary access and emergency elevation. |
| Channel boundary | `mini_app`, `crm`, `machine_adapter`, `partner_api` | Prevent cross-channel credential reuse. |

Scope rules:

- scope must be explicit in authorization policy or credential metadata;
- narrow scope must be preferred over broad scope;
- own-resource checks must use platform IDs such as `customer_id`, not external aliases;
- scope must not encode domain business eligibility;
- missing required scope must deny access;
- scope changes must be auditable for operators, partners, machines and API clients;
- temporary scopes must expire automatically;
- production scope must never be granted by development credentials.

Example:

```text
role_customer
  scope: own
  permissions:
    - order:own:create
    - order:own:read
    - payment:own:initiate
```

## 6. Customer Permissions

Customer authorization is based on `customer_id`.

CustomerID is the primary platform identity. TelegramID, phone, email, VK ID and external OAuth IDs are external identities only.

Customer permissions should support self-service access.

Recommended customer permissions:

| Permission | Meaning |
|---|---|
| `catalog:product:read` | Read published customer catalog contracts where public or customer access is enabled. |
| `media:public:read` | Read approved public product or brand media metadata. |
| `configuration:own:validate` | Submit own product configuration for Runtime validation. |
| `pricing:own:quote` | Request price quote for own customer flow. |
| `order:own:create` | Submit own order creation command to Order Runtime. |
| `order:own:read` | Read own order status and history. |
| `payment:own:initiate` | Start payment for own accepted order. |
| `payment:own:read` | Read own payment status exposed by platform contract. |
| `customer:own:read` | Read own customer profile view. |
| `customer:own:update` | Update own allowed profile fields through Customer Runtime. |
| `loyalty:own:read` | Read own loyalty or Club Timofey view when available. |
| `notification:own:manage` | Manage own notification preferences where supported. |

Customer permission rules:

- customers can access only resources associated with their `customer_id`;
- external aliases must be resolved to `customer_id` before authorization;
- customer permissions must not grant CRM, admin, machine, partner or internal service access;
- customer permissions do not guarantee order acceptance, payment success, bonus usage or fulfillment;
- Runtime decides product validity, price, discount, order state, payment state and fulfillment state.

## 7. Machine Permissions

Machine authorization covers physical machines, vending terminals, gateways and machine adapters.

Machine permissions should be scoped to machine identity, adapter identity or machine group.

Recommended machine permissions:

| Permission | Meaning |
|---|---|
| `machine:health:write` | Submit machine or adapter health status. |
| `machine:telemetry:write` | Submit operational telemetry. |
| `machine:ack:create` | Submit command acknowledgement or dispense result. |
| `machine:inventory:write` | Submit ingredient or inventory telemetry when supported. |
| `machine:error:write` | Submit machine error facts. |
| `machine:configuration:read` | Read assigned machine configuration where allowed. |
| `machine:command:receive` | Receive or pull commands assigned to the machine adapter. |

Machine permission rules:

- machine credentials must not grant customer, CRM, admin or partner permissions;
- machine access must be scoped to assigned `machine_id`, `adapter_id` or machine group;
- replay protection is required for state-changing machine calls;
- machine acknowledgement access does not prove that the acknowledgement is valid for an order;
- Machine Runtime owns dispatch, queue, acknowledgement, failure and physical outcome rules;
- Order Runtime owns order state transitions caused by accepted machine facts.

## 8. Admin Permissions

Admin permissions protect platform-wide and high-risk operations.

Recommended admin permissions:

| Permission | Meaning |
|---|---|
| `admin:configuration:read` | Read platform or runtime configuration metadata where allowed. |
| `admin:configuration:update` | Update approved configuration through documented process. |
| `admin:operator:read` | Read operator account and role metadata. |
| `admin:operator:assign_role` | Assign or revoke operator roles. |
| `admin:credential:manage` | Create, rotate or revoke credentials. |
| `admin:machine:register` | Register machine or adapter identity. |
| `admin:partner:manage` | Register or update partner access metadata. |
| `admin:audit:read` | Read audit logs according to retention and privacy policy. |
| `admin:runtime:read` | Read runtime health, registry and contract metadata. |
| `admin:feature_flag:update` | Update approved feature flags. |

Admin permission rules:

- admin access requires operator identity;
- admin access must be strongly audited;
- admin access should require stronger authentication than customer access;
- admin role assignment must be approved and traceable;
- admin permissions must not bypass Runtime business rules;
- emergency access must be temporary, scoped and reviewed after use;
- admin APIs must never expose secrets or raw credentials.

## 9. Partner Permissions

Partner permissions apply to approved external organizations, integrations and SDK clients.

Recommended partner permissions:

| Permission | Meaning |
|---|---|
| `partner:catalog:read` | Read approved partner catalog contracts. |
| `partner:media:read` | Read approved media metadata for partner usage. |
| `partner:orders:read` | Read approved order data according to partner contract. |
| `partner:analytics:read` | Read approved analytics exports. |
| `partner:webhook:manage` | Manage outbound webhook endpoint metadata where allowed. |
| `partner:webhook:receive` | Receive signed platform webhook events. |
| `partner:integration:read` | Read own integration metadata. |

Partner permission rules:

- every partner must have `partner_id`;
- partner access must be scoped to partner contract, environment and API version;
- partner credentials authenticate the partner but do not grant business access by themselves;
- partner permissions must not expose internal storage, engine implementation or unrestricted customer data;
- partner access must be revocable without code changes;
- partner actions must carry correlation metadata;
- partner scopes must be reviewed before production enablement.

## 10. CRM Permissions

CRM permissions apply to support, operations and customer service users.

Recommended CRM permissions:

| Permission | Meaning |
|---|---|
| `crm:customer:read` | Read approved customer support profile view. |
| `crm:order:read` | Read order support view. |
| `crm:payment:read` | Read payment support metadata safe for operators. |
| `crm:machine:read` | Read machine support status. |
| `crm:support_case:create` | Create support case or note. |
| `crm:support_case:update` | Update support workflow state. |
| `crm:refund:request` | Submit refund request to Runtime contract where allowed. |
| `crm:notification:send` | Request customer notification through Notification Runtime. |
| `crm:audit:read_limited` | Read limited audit trail for support cases. |

CRM permission rules:

- CRM access requires operator identity;
- CRM access must be scoped by role and need-to-know;
- CRM screens must not grant direct repository or engine access;
- CRM support actions must be auditable;
- CRM permissions may allow submitting Runtime commands, but Runtime decides whether the business action is valid;
- sensitive customer, payment and machine data must be minimized;
- refund, cancellation, compensation and account actions require explicit permissions and audit.

## 11. API Client Permissions

API client permissions apply to non-human clients such as internal services, SDK clients, scheduled jobs, adapters and provider bridges.

Recommended API client permissions:

| Permission | Meaning |
|---|---|
| `api_client:contract:read` | Read allowed API contract metadata. |
| `api_client:webhook:receive` | Receive or process inbound webhook facts. |
| `api_client:webhook:send` | Send outbound webhooks through approved boundary. |
| `runtime:event:publish` | Publish events through Event Runtime where approved. |
| `runtime:event:consume` | Consume events through Event Runtime subscription. |
| `runtime:health:read` | Read health state for approved runtime boundary. |
| `runtime:job:execute` | Execute approved scheduled or background job. |

API client permission rules:

- API clients must have stable `client_id`, `service_id`, `adapter_id` or `integration_id`;
- API client credentials must be scoped to a consumer type and environment;
- API clients must not impersonate customers or operators unless a documented delegation flow exists;
- service-to-service access must use narrow scopes and correlation metadata;
- provider webhooks must be authenticated before authorization;
- API clients must not bypass Runtime contracts or access internal storage directly.

## 12. Least Privilege Principle

Soft ICE Platform authorization must follow least privilege by default.

Least privilege rules:

- grant only the permissions required for the intended task;
- prefer read-only access where write access is not required;
- prefer own-resource access over platform-wide access;
- prefer scoped machine, partner and integration access over broad access;
- deny access by default when policy is missing or ambiguous;
- require explicit approval for elevated roles;
- make temporary access expire automatically;
- review high-risk permissions regularly;
- log and audit sensitive grants, revocations and denied attempts;
- avoid hidden superuser paths in API or Runtime code.

Least privilege applies to humans, machines, partners, providers and internal services.

## 13. Role Assignment

Role assignment connects a platform identity or registered client to a role and scope.

Recommended role assignment fields:

| Field | Meaning |
|---|---|
| `assignment_id` | Stable role assignment identity. |
| `subject_type` | Customer, operator, machine, partner, API client or internal service. |
| `subject_id` | Platform identity such as `customer_id`, `operator_id`, `machine_id`, `partner_id` or `service_id`. |
| `role_id` | Assigned role. |
| `scope` | Resource, environment, channel, contract or time scope. |
| `assigned_by` | Operator, system process or provisioning workflow that assigned the role. |
| `assigned_at` | Assignment timestamp. |
| `expires_at` | Optional expiration timestamp. |
| `revoked_at` | Optional revocation timestamp. |
| `reason` | Safe operational reason for high-risk assignments. |
| `correlation_id` | Trace identifier. |

Role assignment rules:

- assignment changes must be auditable;
- high-risk assignment must require an authorized administrator;
- role assignment must not be controlled by customer-provided data;
- expired or revoked assignments must not authorize requests;
- assignment policy must be environment-aware;
- role assignment must not encode business state;
- automated assignment must have a documented provisioning contract;
- manual assignment must leave an audit record.

## 14. Permission Checks

Permission checks happen after authentication and before Runtime contract execution.

Standard authorization flow:

1. Receive authenticated identity context.
2. Identify route, method, consumer type and contract version.
3. Load route authorization policy.
4. Resolve roles, scopes and permissions for the subject.
5. Validate required permissions.
6. Validate required scope.
7. Validate credential, channel, environment and contract boundaries.
8. Produce authorization decision.
9. Attach authorization context to security context.
10. Record safe telemetry and audit data where required.
11. Route the request to Runtime contract when allowed.
12. Deny before Runtime execution when not allowed.

Recommended authorization decision fields:

| Field | Meaning |
|---|---|
| `decision_id` | Unique decision identifier for audit and support. |
| `subject_id` | Platform subject ID. |
| `subject_type` | Customer, operator, machine, partner, API client or service. |
| `route_id` | API route or contract identifier. |
| `required_permissions` | Permissions required by route policy. |
| `granted_permissions` | Permissions used for decision. |
| `scope` | Scope used for decision. |
| `decision` | `allow` or `deny`. |
| `reason_code` | Safe machine-readable reason. |
| `correlation_id` | Request trace identifier. |
| `decided_at` | Decision timestamp. |

Permission check rules:

- missing authentication context must fail before authorization;
- missing route policy must deny access by default;
- missing required permission must deny access;
- missing required scope must deny access;
- policy checks must be deterministic;
- authorization must not call domain engines to decide business eligibility;
- Runtime should receive authorization context for audit and domain-sensitive decisions;
- Runtime must still validate business rules.

## 15. Access Denied Handling

Access denied handling must be safe, consistent and observable.

Recommended status behavior:

| Scenario | Recommended result |
|---|---|
| Missing identity where required | `401 Unauthorized`. |
| Invalid or expired authentication context | `401 Unauthorized`. |
| Authenticated but missing permission | `403 Forbidden`. |
| Authenticated but outside scope | `403 Forbidden`. |
| Authenticated but route not exposed to consumer type | `403 Forbidden` or `404 Not Found` when hiding existence is required. |
| Rate limit exceeded | `429 Too Many Requests`. |
| Runtime business rejection | Runtime-defined domain error, not authorization error. |

Access denied rules:

- error messages must not reveal sensitive policy internals;
- responses must include a correlation identifier;
- denied access to sensitive resources should be audited;
- repeated denied attempts should be observable through telemetry;
- authorization errors must be distinguishable from Runtime business errors;
- API Gateway should deny before Runtime execution when policy fails;
- denial behavior must be contract-stable for API clients.

Recommended error code direction:

```text
AUTHENTICATION_REQUIRED
AUTHORIZATION_DENIED
AUTHORIZATION_SCOPE_DENIED
AUTHORIZATION_POLICY_MISSING
AUTHORIZATION_ROLE_EXPIRED
AUTHORIZATION_PERMISSION_REVOKED
```

Detailed error code contracts should be documented in `docs/api/ERROR_CODES.md`.

## 16. Audit Logging

Authorization audit logging records sensitive access decisions and role changes.

Audit logging is required for:

- admin role assignment and revocation;
- operator role assignment and revocation;
- credential creation, rotation and revocation;
- partner access enablement or revocation;
- machine registration and credential changes;
- CRM access to sensitive customer, payment, order or machine data;
- refund, cancellation, compensation or support actions;
- configuration and feature flag changes;
- denied access to sensitive routes;
- emergency access usage.

Recommended audit fields:

| Field | Meaning |
|---|---|
| `audit_id` | Stable audit record identity. |
| `event_type` | Authorization decision, role assignment, revocation or policy change. |
| `subject_type` | Actor type. |
| `subject_id` | Platform actor identity. |
| `target_type` | Resource or policy target. |
| `target_id` | Target identity when safe. |
| `permissions` | Permissions involved. |
| `roles` | Roles involved. |
| `scope` | Scope involved. |
| `decision` | Allow, deny, assign, revoke or update. |
| `reason_code` | Safe reason. |
| `correlation_id` | Request trace identifier. |
| `occurred_at` | Audit event timestamp. |

Audit rules:

- audit records must not contain secrets, raw tokens, API keys or payment credentials;
- audit records should use platform IDs, not external aliases, when possible;
- audit records must be tamper-resistant in future implementation;
- audit retention must match security, support, finance and privacy requirements;
- audit logging observes authorization facts and does not decide business outcomes;
- Runtime defines required domain audit facts for business actions.

## 17. Security Rules

Authorization security rules:

- deny by default;
- require authentication before protected authorization checks;
- use `customer_id` as the primary customer authorization subject;
- treat TelegramID, phone, email, VK ID and external OAuth IDs as external aliases only;
- enforce least privilege by default;
- keep policy configuration explicit and versioned;
- separate customer, operator, machine, partner and service permissions;
- never grant broad access from an external identity alone;
- never store secrets in authorization policy files;
- never log credentials, tokens, signatures or raw secrets;
- validate route, method, consumer type, environment and scope;
- require audit for sensitive permission grants and denials;
- make elevated access temporary where possible;
- make role and credential revocation effective quickly;
- avoid hardcoded authorization exceptions in route handlers;
- review high-risk policy changes before production.

Authorization must remain business-logic free.

Runtime remains responsible for business rules.

API Gateway remains responsible for access policy enforcement.

## 18. Acceptance Criteria

This documentation increment is acceptable when:

- `docs/api/AUTHORIZATION.md` defines the authorization vision;
- authentication and authorization are clearly separated;
- CustomerID is defined as the primary platform identity;
- TelegramID, phone, email, VK ID and external OAuth IDs are defined as external identities only;
- permission model is documented;
- role model is documented;
- scope model is documented;
- customer permissions are documented;
- machine permissions are documented;
- admin permissions are documented;
- partner permissions are documented;
- CRM permissions are documented;
- API client permissions are documented;
- least privilege principle is documented;
- role assignment rules are documented;
- permission check flow is documented;
- access denied handling is documented;
- audit logging rules are documented;
- security rules are documented;
- future roadmap is documented;
- authorization is explicitly free of business logic;
- Runtime is explicitly documented as the owner of business rules;
- API Gateway is explicitly documented as the access policy enforcement point;
- no application source code, frontend code, backend code, Telegram bot code, runtime configuration or generated build output is modified.

Future implementation acceptance criteria:

- every protected route has explicit authorization policy;
- every protected request has identity context before authorization;
- every allowed request has authorization context before Runtime execution;
- denied requests are observable without leaking policy internals;
- role assignment and revocation are auditable;
- high-risk permissions are scoped and reviewed;
- Runtime business rules remain outside API Gateway authorization handlers.

## 19. Future Roadmap

Recommended authorization roadmap:

1. Define Security Context contract shared by API Gateway, Kernel, Runtime, Event API and webhooks.
2. Define exact authorization error codes in `docs/api/ERROR_CODES.md`.
3. Define route-level permission matrix for REST API in `docs/api/REST_API.md`.
4. Define event producer and consumer permission policy in `docs/api/EVENT_API.md`.
5. Define inbound and outbound webhook authorization rules in `docs/api/WEBHOOKS.md`.
6. Define OpenAPI security requirements and scope annotations.
7. Define role assignment storage model and audit events.
8. Define policy configuration format and validation rules.
9. Define customer self-service access policy.
10. Define CRM operator and admin role hierarchy.
11. Define machine adapter provisioning and authorization scope.
12. Define partner onboarding, contract scope and revocation process.
13. Define internal service-to-service authorization policy.
14. Define emergency access and break-glass procedure.
15. Define authorization telemetry dashboards and alerts.
16. Add contract tests for route authorization, scope checks and denied access handling.
17. Review production permission matrix before launch.
