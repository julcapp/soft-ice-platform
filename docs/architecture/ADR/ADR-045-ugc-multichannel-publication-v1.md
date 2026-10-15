# ADR-045 — UGC Multi-channel Publication v1

**Date:** 2026-08-22  
**Status:** Accepted  
**Project:** Soft ICE Platform / «У Тимоши»

## Context

Approved customer photos must be distributed to the project's public channels and their publication state must remain auditable independently per channel.

The confirmed public targets are VK `club239119350`, Telegram `@ice_robo_club`, and MAX `https://max.ru/channel_soft_icecream`. The technical MAX `chat_id` remains a deployment configuration value and must not be inferred from the public URL.

Photo Verification may approve automatically in AI-assisted mode or route a submission to a manual moderation queue. A manual moderator decision must not bypass the same publishing, reward, and retention boundaries used by the automated workflow.

## Decision

Introduce `PhotoPublishingOrchestrator` as a channel-neutral publishing coordinator.

Required targets for the «У Тимоши» UGC workflow are:

- VK — `club239119350`;
- Telegram — `@ice_robo_club`;
- MAX — required, API target configured separately through `MAX_CHANNEL_CHAT_ID`.

Each channel receives an independent publish attempt with a stable idempotency key based on `photoChallengeId + channel`.

Publication state is persisted independently for each `PhotoChallenge/channel` pair. A retry of one failed channel must not create a second logical publication record and must not roll back or overwrite successful publication evidence from other channels.

Supported publication states include:

- `pending`;
- `published`;
- `confirmed`;
- `failed`;
- `not_configured`.

Both `published` and `confirmed` are durable positive publication evidence for the customer read model. Completion is evaluated against `requiredChannels` from Photo Verification settings rather than a hard-coded channel count.

## Manual moderation boundary

`PhotoManualReviewService` owns administrator decisions for submissions routed to `manual_review`.

The administrator can:

- approve;
- send to additional review;
- reject.

Additional-review and rejection decisions require a reason. Every decision is stored as a separate manual verification result and an audit event carrying the administrator actor ID, action, decision, reason and correlation ID.

Manual approval does not directly publish, credit bonus units, or delete source media. It resumes the same deterministic sequence:

`manual approval → required publication → Reward Engine → customer reward notification → retention/deletion`.

If required publication is incomplete, the reward is blocked. If reward units are not configured, the reward remains pending and source media is retained. Repeated reward processing uses the same `photo-reward:<photoChallengeId>` idempotency boundary.

## Persistence

`PhotoPublication` contains:

- `targetId`;
- `attemptCount`;
- `lastAttemptAt`;
- `idempotencyKey`;
- unique `(photoChallengeId, channel)`;
- external publication ID and URL;
- published and confirmed timestamps;
- failure diagnostics.

Manual moderation remains append-only in `PhotoVerificationResult` and `PhotoVerificationEvent`; the prior AI/technical evidence is retained for audit.

## Failure behavior

- A successful VK publication is retained if Telegram or MAX fails.
- A missing required target or publisher is `not_configured`, never simulated as success.
- A failed required channel prevents the complete-publication condition but does not undo successful channels.
- Manual rejection/additional review never starts publishing.
- Manual approval with publishing disabled stops at `publication_pending`.
- Publication success without configured reward units stops at `reward_pending` and retains the source file.

## Reward and retention boundary

The publishing and manual-moderation services never write bonus balances directly. Rewarding is delegated to `BonusRewardEngine`, which is idempotent and settings-backed.

Source deletion is permitted only after complete required publication and successful reward. Deletion evidence is recorded after the storage adapter confirms deletion.

## Consequences

- Manual and AI-assisted approvals obey the same business boundary.
- Moderator identity and reason are auditable without overwriting AI evidence.
- Channel outages are isolated.
- Publication audit and customer-cabinet status can show channel-level progress.
- The design remains extractable to a future multi-tenant photo-verification service.
