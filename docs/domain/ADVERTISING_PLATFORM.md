# Advertising Platform

Status: Approved foundation
Version: 1.0
Checkpoint date: 2026-07-23

## Purpose and boundary

Advertising Platform is a future bounded context for advertiser identity, campaign structure, creative assets, placements, referral links and click facts. It is separate from CRM, Customer Identity, Consent, Segmentation, Loyalty, Pricing, Analytics and Machine Operations.

CRM/Admin Console will be the central future management interface for advertising. Advertising Platform remains the owner of advertising entities and lifecycle rules; CRM does not absorb that ownership.

## Access eligibility

Advertising capabilities are available only to an authenticated customer with at least a verified phone number. Authentication and verified phone status are necessary but not sufficient: applicable legal and product consents must be checked before each controlled advertising action.

Consent enforcement remains mandatory. Advertising Platform consumes authoritative consent decisions and must fail closed when required consent is absent, withdrawn, expired, unsupported or cannot be verified. It does not create, rewrite or infer consent.

## Separate entities

| Entity | Responsibility |
|---|---|
| Advertiser | Advertising party linked to an eligible authenticated customer and its verification/audit state. |
| Campaign | Commercial objective, lifecycle, ownership and approved operating window. |
| Creative | Versioned advertising content and review state; media bytes remain in the media subsystem. |
| Placement | Approved delivery surface or slot, independent of a creative. |
| Referral link | Stable campaign/creative/placement attribution reference with revocation state. |
| Click | Append-only observed interaction fact with safe attribution and deduplication metadata. |

These entities must not be collapsed into a customer profile, consent record, segment, analytics event or generic CRM note. Entity IDs and histories remain stable and auditable.

## Integration boundaries

- Auth Core establishes the authenticated actor.
- Customer Identity supplies canonical customer identity and verified-phone evidence.
- Consent owns legal consent decisions and history.
- Segmentation may supply approved audience projections in a future increment but does not execute advertising.
- Media Library owns binary creative assets and metadata storage conventions.
- Analytics may consume governed advertising facts; click tracking remains an Advertising entity and source fact.
- CRM/Admin Console provides management workflows through Advertising contracts.

## Deferred decisions

Advertising delivery algorithms are explicitly deferred, including targeting, ranking, bidding, pacing, frequency capping, recommendation, personalization, optimization and automated audience selection. No delivery behavior may be inferred from this foundation.

Commercial terms, advertiser onboarding verification beyond the minimum identity gate, moderation policy, placement inventory, attribution windows, fraud controls, retention and reporting require later approval.

## Out of scope for this checkpoint

This document adds no advertising execution, outbound delivery, profiling, Prisma models, API routes, UI, click collector or business logic.
