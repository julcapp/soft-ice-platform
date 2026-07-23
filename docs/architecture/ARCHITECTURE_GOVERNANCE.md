# Architecture Governance

Status: Approved
Document code: ARCH-GOV-001
Version: 1.0
Effective date: 2026-07-23
Architecture owner: Product Owner and approved architecture reviewers

## Purpose

This document establishes mandatory governance for future Soft ICE Platform modules and engineering slices. It applies to application code, APIs, adapters, data models, infrastructure and architecture documentation.

## Governance Baseline

The following documents form the high-level baseline:

- `SOFT_ICE_PLATFORM_MAP.md`;
- `PLATFORM_BOUNDARIES.md`;
- `PLATFORM_ROLES_AND_ACCESS.md`;
- `PLATFORM_DATA_FLOWS.md`;
- `ARCHITECTURE_STATUS.md`;
- `PROJECT_DECISIONS.md`;
- accepted ADRs and detailed domain contracts.

Changes must preserve the project principles: model first, interface second; business logic in services; stable semantic IDs; shared catalog; vendor isolation; responsive interfaces; safe incremental delivery; and GitHub as the source of truth.

## Mandatory Rules

### 1. Domain document before a new module

Every new module requires an approved domain document before implementation. At minimum it defines:

- purpose and bounded context;
- owned entities, value objects and state transitions;
- commands, queries and business invariants;
- data ownership and retention;
- API/event integration boundaries;
- permissions and audit requirements;
- failure, idempotency and reconciliation behavior;
- status classification and explicit out-of-scope items.

### 2. ADR for every major architectural choice

Every major architectural choice requires an ADR before or with the implementing slice. Major choices include:

- creating, splitting or merging a bounded context;
- changing source-of-truth ownership;
- adopting a new database, transport, provider or vendor SDK;
- changing authentication, permission or audit architecture;
- introducing cross-domain transaction or event-delivery strategy;
- changing public API compatibility or platform deployment shape.

The ADR records context, decision, alternatives, consequences, status and supersession relationship.

### 3. Depend on ports, not vendor adapters

Application and domain code must not depend directly on vendor-specific adapters.

- Machine code depends on `MachineGateway`, not Huaxin protocol classes.
- Payment code depends on provider-neutral Payment contracts, not YooKassa/Sber SDK types.
- Identity code depends on verification-provider ports, not provider payloads.
- Object storage, messaging and other infrastructure use explicit ports when replaceability or isolation matters.

Vendor types are translated at the adapter boundary and must not leak into domain entities, public events or general application services.

### 4. Backend-enforced permissions

Permissions must be enforced in backend services and route policies, not only in UI.

- deny by default;
- authenticate before authorization;
- validate actor role, permission and resource scope;
- revalidate domain invariants in the owning service;
- audit sensitive access and privileged mutations;
- test allowed, denied and out-of-scope cases.

### 5. Configurable business rules

Business rules must be configurable through CRM/Admin Console where appropriate, especially commercial settings, prices, menu availability, loyalty policy, advertising configuration and operational checklists.

Configuration must be:

- validated by the owning backend service;
- versioned or effective-dated when historical reconstruction matters;
- permission-controlled and audited;
- safe by default;
- separated from secrets and deployment-only configuration.

Not every invariant is configurable. Legal, security, accounting and safety invariants require explicit architecture approval before configurability is introduced.

### 6. Complete engineering slices

Each implementation slice must update, as applicable:

- domain and architecture documentation;
- API and event contracts;
- automated tests and `docs/testing/TEST_SCENARIOS.md`;
- database migrations when approved;
- `CHANGELOG.md`;
- `ARCHITECTURE_STATUS.md`;
- roadmap documents when sequencing changes.

Required builds and validations in repository instructions must pass. Generated build output, credentials and local environment files must not be committed.

### 7. Honest capability status

Documentation must distinguish:

- **Implemented**;
- **Foundation**;
- **Documented**;
- **Future**.

Every document that describes mixed maturity must label it per capability. A port, schema, mock, simulator, configuration placeholder or design document is not evidence of a production integration.

## Required Slice Review

Before implementation starts:

- identify the owning domain and affected platform boundaries;
- confirm a domain document exists;
- decide whether an ADR is required;
- define actor permissions and audit events;
- define API/event contracts and idempotency;
- classify current and target status;
- obtain Product Owner approval for major product or commercial decisions.

Before merge:

- verify dependency direction and vendor isolation;
- verify backend authorization and negative tests;
- verify data ownership and migration safety;
- verify idempotency, failure and reconciliation behavior;
- update tests, contracts, status and changelog;
- run required builds and diff validation;
- confirm no generated output or credentials are included.

## Architecture Change Classification

| Change | Required governance |
|---|---|
| Documentation clarification without boundary change | Document review and changelog when meaningful |
| New endpoint inside an existing boundary | Domain/API update, permission review and tests |
| New module or aggregate | Domain document, status update and usually an ADR |
| New external provider/vendor | Adapter contract, security review, integration tests and ADR when significant |
| Boundary/source-of-truth change | ADR, master-map/boundary update and Product Owner approval |
| Pricing, loyalty or advertising policy change | Product Owner approval, versioned configuration, audit and tests |
| Identity, consent, payment or machine-safety change | Security/privacy/financial/operational review as applicable |

## Documentation Authority and Conflict Resolution

1. Accepted ADRs explain why a major decision was made.
2. The master map and boundary documents define current high-level ownership.
3. Detailed domain documents define behavior inside a boundary.
4. API/event/data contracts define integration shape.
5. Architecture Status records actual delivery maturity.
6. Roadmaps record intended sequence and never imply implementation.

When documents conflict:

1. stop implementation at the conflicting boundary;
2. identify the newest accepted decision and actual executable behavior;
3. propose an ADR or explicit correction;
4. obtain required approval;
5. update every affected document in the same slice.

Silent divergence between code and documentation is not allowed.

## Exceptions

Emergency operational work may use a time-limited exception only when:

- the incident and business impact are recorded;
- the Product Owner or delegated authority approves the scope;
- security and data-integrity boundaries remain protected;
- every action is audited;
- follow-up documentation, tests and remediation are scheduled.

An exception cannot authorize committing credentials, deleting immutable history, bypassing payment verification or dispensing without an accepted payment/test authorization.

## Architecture Status Ownership

`ARCHITECTURE_STATUS.md` is updated with each meaningful slice to record:

- snapshot date and version;
- capability status;
- executable evidence;
- foundations and documented-only contracts;
- known gaps and production-readiness verdict.

Claims must be evidence-based. Future plans belong in roadmap documents, not in the implemented column.

## Acceptance Checklist for a New Module

- [ ] Domain document approved.
- [ ] Ownership and exclusions defined.
- [ ] ADR accepted if the choice is major.
- [ ] Interfaces depend on application/domain contracts.
- [ ] Vendor dependencies isolated behind adapters.
- [ ] Backend permissions and scope defined.
- [ ] Audit, idempotency and error behavior defined.
- [ ] API/event/data contracts versioned.
- [ ] Tests and test scenarios updated.
- [ ] Changelog and Architecture Status updated.
- [ ] Required validation passes.
- [ ] Capability status is stated honestly.

## Non-Implementation Scope

This governance baseline adds no application code, Prisma schema, tests or business-logic changes.
