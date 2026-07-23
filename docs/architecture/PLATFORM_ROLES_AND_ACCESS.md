# Platform Roles and Access

Status: Approved
Document code: ARCH-ACCESS-001
Version: 1.0
Effective date: 2026-07-23

## Purpose

This document defines the high-level human actor model and mandatory access boundaries across Soft ICE Platform. Detailed permissions may be more restrictive. Absence of an explicit permission means deny.

## Access Principles

1. Authenticate before authorizing.
2. Enforce permissions and scope in backend services, not only in UI.
3. Use stable platform actor IDs after identity resolution.
4. Deny by default.
5. Separate route access from domain business validation.
6. Audit sensitive reads, all privileged mutations and permission changes.
7. Administrator authority does not bypass immutable records or domain invariants.
8. Machine, provider and internal-service credentials never grant human permissions.

## Human Roles

### Customer

The Customer role uses Telegram Mini App, landing/customer web surfaces and future approved customer channels.

Allowed at high level:

- authenticate and manage an own session;
- read and update approved own-profile fields;
- record and review own consent decisions;
- access own Club Account, loyalty, referrals, orders and payment projections;
- create an own checkout/payment request;
- view eligible advertising after identity and consent gates pass;
- create click/referral interaction facts through approved customer endpoints.

Not allowed:

- access another customer;
- access Operator App or CRM/Admin Console;
- change prices, product commercial settings, loyalty rules or advertising configuration;
- access raw provider, machine, operator, audit or secret data;
- command a machine directly.

### Operator

The Operator role uses only the Operator App and approved operational endpoints.

Allowed at high level:

- view assigned machines and tasks;
- execute the assigned versioned checklist;
- record service work and faults;
- record approved inventory movements;
- perform approved test runs;
- attach photo evidence metadata and governed object references;
- submit a service report.

Not allowed:

- access unassigned machines except through an explicit emergency authorization;
- manage customers;
- change prices or product commercial settings;
- change loyalty rules;
- manage advertising;
- approve the operator's own report unless a separately approved role policy permits it;
- rewrite machine, inventory, payment, financial, consent or audit history.

### Administrator

The Administrator role uses CRM/Admin Console and approved elevated APIs. Permissions are granular; the role name alone is not sufficient for every action.

Allowed at high level when the required permission is present:

- manage customers through Customer contracts;
- configure loyalty through Loyalty contracts;
- change prices and product commercial settings through their owning services;
- manage products and menu;
- oversee payments and reconciliation without rewriting immutable ledger facts;
- view reports and analytics;
- configure Advertising entities and policy-controlled placements;
- assign and monitor operators and machines;
- review, approve or reject service reports;
- configure versioned checklists and approved system settings;
- view complete operator audit history;
- perform an operational action in an emergency when explicitly authorized and audited.

Not allowed:

- bypass owning domain services;
- directly edit immutable payment, ledger, consent, inventory or audit facts;
- treat provider callbacks or machine results as trusted without verification;
- expose secrets or unrestricted personal data;
- disable required audit.

## Permission Domains

Permissions use semantic resources and actions, for example:

```text
customer:own:read
consent:own:record
order:own:create
payment:own:initiate
machine_operations:assigned:execute
inventory:assigned_machine:move
service_report:assigned:submit
admin:pricing:manage
admin:product_commercial:manage
admin:loyalty:manage
admin:advertising:manage
admin:operator_audit:read
```

Exact permission names may evolve through a documented security increment. Their meaning and scope must remain explicit and versioned.

## High-Level Access Matrix

| Capability | Customer | Operator | Administrator |
|---|---:|---:|---:|
| Own profile and consent | Own only | No | Permission-scoped support/oversight |
| Own purchase and payment | Own only | No | Read/reconcile by permission |
| Assigned machine service | No | Yes | Assign, oversee or explicitly execute |
| Approved test run | No | Assigned scope | Yes, explicitly audited |
| Inventory movement | No | Assigned operational scope | Oversight/correction by permission |
| Prices | Read effective price | No | Change by explicit permission |
| Product commercial settings | Read customer projection | No | Change by explicit permission |
| Loyalty rules | Consume own outcome | No | Change by explicit permission |
| Advertising configuration | Consume eligible display | No | Change by explicit permission |
| Operator audit | No | Own permitted history only | All operator actions |
| System configuration | No | No | Permission-scoped |

## Advertising Gate

Customer advertising access is allowed only when:

```text
authenticated customer
AND verified phone
AND all required active consents
AND requested placement/campaign is otherwise eligible
```

Identity and Consent services provide authoritative facts. Advertising applies the gate and records the decision context. UI state is never sufficient evidence.

## Operator Assignment and Evidence

- Every operator action carries `operator_id`, machine/task scope, correlation ID and timestamp.
- Assigned scope is checked on every protected read and mutation.
- Photo evidence access follows least privilege and privacy/retention policy.
- Checklist versions attached to completed work are immutable.
- Test and service consumption must be recorded as non-sale inventory movements.
- Service report submission and administrator approval/rejection are separate audited transitions.

## Administrative Audit

Audit must cover:

- price, commercial, loyalty and advertising configuration changes;
- operator assignment and permission changes;
- checklist publication/versioning;
- service report review;
- payment reconciliation actions;
- sensitive customer access;
- emergency operational actions;
- system configuration and feature-flag changes;
- denied privileged operations.

Audit records include actor, action, target, decision/result, reason where required, timestamp and correlation reference. They must exclude secrets, raw tokens, provider signatures and unnecessary personal data.

## Non-Human Actors

Machine, provider webhook, Telegram and internal-service actors use separate credentials and policies. They:

- cannot receive Customer, Operator or Administrator roles;
- are restricted to explicit integration endpoints;
- use freshness, signature, replay and idempotency controls appropriate to the channel;
- produce auditable integration facts.

## Non-Implementation Scope

This document establishes governance-level access rules only. It changes no middleware, roles database, API route, Prisma schema or UI.
