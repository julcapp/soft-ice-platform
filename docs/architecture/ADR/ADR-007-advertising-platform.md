# ADR-007: Establish the Advertising Platform Foundation

Status: Accepted
Date: 2026-07-23

## Context

Future advertising needs explicit identity, consent, campaign and attribution boundaries. Implementing advertising as CRM fields, consent flags or undifferentiated analytics events would combine independent lifecycles and make consent enforcement and audit unreliable.

The repository contains an earlier numeric ADR filename for Transaction Ledger. This descriptive ADR is a new checkpoint record and does not supersede or rewrite that historical file.

## Decision

Advertising Platform is established as a separate future bounded context.

Access is available only to an authenticated customer with at least a verified phone number. Consent enforcement is mandatory and fail closed. Advertiser, campaign, creative, placement, referral link and click tracking are separate entities with independent identifiers and lifecycle history.

CRM/Admin Console remains the central future advertising-management interface, while Advertising Platform owns advertising records and rules.

Advertising delivery algorithms are deferred. This decision does not approve targeting, ranking, bidding, pacing, recommendations, personalization or outbound delivery.

## Consequences

- identity verification and consent remain authoritative external gates;
- withdrawal or absence of required consent blocks applicable operations;
- click facts are append-only advertising records and may feed analytics projections;
- segmentation, loyalty and CRM may integrate through explicit contracts but do not own campaign execution;
- implementation requires a later approved increment covering moderation, fraud, retention, delivery and reporting policy.

## Alternatives rejected

- Model advertising as fields on Customer or CRM records.
- Treat a consent decision as an advertiser, campaign or delivery instruction.
- Implement delivery algorithms before entity, identity and consent boundaries are approved.

## Scope

Documentation only. No application code, Prisma schema or business logic is changed.
