# Customer Identity Core v1

Status: Implemented
Version: 1.0
Date: 2026-07-21
Project: Soft ICE Platform / «У Тимоши»

## Purpose

Customer Identity Core provides one canonical `customer_id` across Telegram Mini App, web, vending, CRM and future partner interfaces. It owns verified customer identifiers, external identity aliases and consent decisions. It does not own authentication sessions, loyalty, promotions, advertising, payment, order or machine behavior.

## Domain Model

`Customer` is the canonical entity. A verified E.164 phone number is its primary verified identifier and is unique across customers. `phoneVerifiedAt` proves that a configured phone verifier accepted the binding; callers cannot mark a phone verified directly.

`CustomerIdentity` stores verified external provider aliases. Provider subjects are stored as hashes and are unique by provider. Active providers in v1 are:

- `telegram` — implemented through verified Telegram Mini App init data;
- `sber_id` — provider boundary only, unavailable until an adapter is configured;
- `max` — provider boundary only, unavailable until an adapter is configured.

SberID and MAX placeholders fail closed with `IDENTITY_PROVIDER_UNAVAILABLE`. They do not accept raw provider identity as platform truth.

`CustomerConsent` is an immutable decision record tied to a versioned `DocumentVersion`. `customer_id + decisionId` makes repeated delivery idempotent without crossing customer boundaries. A negative decision is stored with `isGranted = false` and `revokedAt`; prior records are not overwritten.

## Runtime Boundaries

- `CustomerEntity` defines provider constants, E.164 normalization and safe identity state.
- `CustomerRepository` owns Prisma persistence and uniqueness conflicts.
- `CustomerService` owns phone verification, external binding, consent validation and audit facts.
- `CustomerRuntime` exposes customer commands and queries to API/Auth Core.
- `CustomerIdentityProviderRegistry` is the adapter boundary for phone, SberID and MAX verification.
- Auth Core still owns sessions and authentication context.

## API v1

All endpoints require a valid customer Bearer session.

| Method | Path | Contract |
|---|---|---|
| `GET` | `/api/v1/customers/me` | Returns safe customer identity status, including verified phone and provider-link flags. |
| `POST` | `/api/v1/customers/me/phone-verifications` | Submits E.164 phone plus opaque verification token to the configured phone verifier. |
| `GET` | `/api/v1/customers/me/identities` | Lists safe active external identity metadata without subject hashes or provider tokens. |
| `POST` | `/api/v1/customers/me/consent-decisions` | Appends an idempotent, versioned consent decision. |
| `GET` | `/api/v1/customers/me/consent-decisions` | Lists the customer consent decision history. |

External SberID/MAX linking is a Runtime/provider boundary in v1 and has no public route until provider callback authentication and exact provider contracts are approved.

## Security and Privacy

- phone verification requires an injected trusted verifier;
- raw OTPs, provider tokens and external subjects are not persisted or returned;
- external subjects are hashed before storage;
- identity and consent changes emit audit records with correlation IDs;
- unique phone/provider bindings reject cross-customer conflicts;
- API DTOs expose no Telegram init data, provider tokens or external subject hashes.

## Explicitly Out of Scope

- loyalty tiers, accrual or redemption;
- promotions, campaigns or discounts;
- advertising consent orchestration or targeting;
- production OTP delivery;
- production SberID and MAX adapters;
- identity merge, split, recovery or manual operator tooling;
- email verification and profile enrichment.

## Acceptance

Customer Identity Core v1 is accepted when Prisma validates, backend build passes and automated tests cover Telegram binding, verified phone as primary identifier, safe identity reads, fail-closed SberID/MAX placeholders, immutable/idempotent consent decisions and authentication enforcement.
