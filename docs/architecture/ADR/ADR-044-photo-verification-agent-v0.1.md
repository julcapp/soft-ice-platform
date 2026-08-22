# ADR-044 — Photo Verification Agent v0.1

**Date:** 2026-08-22  
**Status:** Accepted  
**Project:** Soft ICE Platform / «У Тимоши»

## Context

The platform needs automated verification of user-submitted photos for loyalty and UGC scenarios. The capability must initially serve «У Тимоши», remain switchable from administration, and be designed so it can later become a reusable B2B/SaaS service.

The AI decision must not directly publish content or grant loyalty bonuses. Bonus units are an internal loyalty unit and are not equivalent to rubles.

User-facing lifecycle requirements are:

1. a submitted photo is reported as being under moderation;
2. verification combines technical checks, metadata, anti-fraud signals and AI vision;
3. uncertain or risky cases can go to manual review;
4. an approved photo is published through a separate publishing boundary;
5. the user is notified after confirmed publication;
6. only after confirmed publication may the Reward Engine grant the configured bonus;
7. after confirmed publication the source photo may be deleted from platform object storage according to retention policy, while an auditable database trail remains.

## Decision

Create `backend/src/modules/photo_verification` as a separate backend bounded module.

V0.1 introduces:

- explicit modes: `disabled`, `manual_only`, `ai_assisted`;
- a replaceable Vision Provider boundary;
- a deterministic Mock Vision Provider for testing;
- a Photo Verification Agent decision engine;
- normalized decisions: `approved`, `rejected`, `manual_review`;
- normalized photo lifecycle status constants including moderation, publication, reward and source-file deletion stages;
- configurable approval/rejection confidence thresholds and maximum accepted fraud score;
- durable PostgreSQL persistence migration for verification results, moderation events, fingerprints, publication evidence and source-file deletion evidence;
- a Prisma-backed persistence adapter using parameterized raw queries until the generated Prisma model layer is synchronized in a later schema-maintenance increment;
- a lifecycle service enforcing the rule that source media cannot be marked deleted before confirmed publication.

Risk handling is fail-safe: high fraud score and unsafe-content signals route to `manual_review`; they do not produce business side effects.

## Domain boundaries

`Photo Verification Agent` owns verification decisions only.

It MUST NOT:

- grant bonuses;
- mutate loyalty balances;
- publish user content;
- delete source media;
- treat an AI response as proof of publication.

`PhotoModerationLifecycle` records moderation/publication/deletion facts but does not execute channel publication, reward posting or object-storage deletion itself.

Future `Publishing Service`, notification delivery and `Reward Engine` remain separate responsibilities.

## Existing PhotoChallenge compatibility

The existing `PhotoChallenge` domain remains the customer/challenge-facing record. Photo Verification integrates with it rather than create a competing customer challenge aggregate.

Durable records reference `PhotoChallenge.id` through dedicated tables:

- `PhotoVerificationResult`;
- `PhotoVerificationEvent`;
- `PhotoFingerprint`;
- `PhotoPublication`;
- `PhotoSourceDeletion`.

Binary photo objects remain outside PostgreSQL.

## Persistence and evidence

The persistence layer records:

- verification provider/model and versioned decision data;
- AI confidence and fraud score;
- metadata and anti-fraud payloads;
- immutable-style lifecycle events;
- SHA-256 and perceptual hash fields;
- publication channel, external publication ID/URL, published and confirmed timestamps;
- source-file deletion request/result and deletion timestamp.

The migration constrains confidence and fraud score to the range 0..1.

## Source photo retention

Source media must not be deleted merely because a publish command was sent. Deletion is allowed only after confirmed publication (or another explicitly approved retention condition). Failure to publish keeps the source object available for retry.

After deletion, the database retains the audit trail needed to establish what submission was moderated, when moderation occurred, where and when it was published, relevant hashes/metadata, and when the source object was deleted.

## Reward boundary

A confirmed AI moderation result is not reward eligibility by itself.

Reward Engine may act only after the full workflow has reached confirmed publication. Reward records remain separate from monetary balances. Bonus units are not rubles and no implicit `1 bonus = 1 RUB` conversion exists.

## SaaS direction

No provider name, brand name, reward amount or channel is hard-coded into the verification core. These become tenant/configuration inputs so the module can later be extracted behind a stable API.

## Consequences

- AI remains advisory and replaceable.
- Business side effects remain auditable and independently controlled.
- Administration can disable or downgrade AI verification without stopping the platform.
- The platform can minimize retained photo binaries after publication.
- Publication/deletion facts remain queryable after the binary object is gone.
- Future external tenants can reuse the verification core without inheriting «У Тимоши» business rules.
