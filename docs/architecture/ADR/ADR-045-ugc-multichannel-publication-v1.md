# ADR-045 — UGC Multi-channel Publication v1

**Date:** 2026-08-22  
**Status:** Accepted  
**Project:** Soft ICE Platform / «У Тимоши»

## Context

Approved customer photos must be distributed to the project's public channels and their publication state must remain auditable independently per channel.

The confirmed VK target is `club239119350`. Telegram and MAX are also required publication channels, but their concrete target IDs remain configuration values and must not be faked before production adapters are configured.

## Decision

Introduce `PhotoPublishingOrchestrator` as a channel-neutral publishing coordinator.

Required targets for the «У Тимоши» UGC workflow are:

- VK — `club239119350`;
- Telegram — required, target configured separately;
- MAX — required, target configured separately.

Each channel receives an independent publish attempt with a stable idempotency key based on `photoChallengeId + channel`.

Publication state is persisted independently for each `PhotoChallenge/channel` pair. A retry of one failed channel must not create a second logical publication record and must not roll back or overwrite successful publication evidence from other channels.

Supported publication states include:

- `pending`;
- `published`;
- `failed`;
- `not_configured`.

The batch reports both `anyPublished` and `allRequiredPublished`. The complete UGC publication workflow reaches confirmed publication only when all currently required targets have successfully published. Partial success is retained and failed/unconfigured channels can be retried independently.

## Persistence

`PhotoPublication` is extended with:

- `targetId`;
- `attemptCount`;
- `lastAttemptAt`;
- `idempotencyKey`;
- unique `(photoChallengeId, channel)`.

The existing publication evidence remains: external publication ID, URL, published timestamp, confirmation timestamp and failure diagnostics.

## Failure behavior

- A successful VK publication is retained if Telegram or MAX fails.
- A missing Telegram/MAX target or publisher is `not_configured`, never simulated as success.
- A failed required channel prevents `allRequiredPublished=true` but does not undo other successful channels.
- Retry increments attempt state for that channel while preserving its logical identity.

## Reward and retention boundary

The orchestrator never grants bonuses and never deletes source media.

Reward eligibility and source-file deletion must depend on the configured workflow rule for confirmed publication. For the current three-required-channel policy, the complete publication condition is `allRequiredPublished=true`.

## Consequences

- VK `club239119350` is the fixed VK UGC target for this project.
- Telegram/MAX adapters can be connected later without changing orchestration semantics.
- Channel outages are isolated.
- Publication audit and customer-cabinet status can show channel-level progress.
- SaaS extraction remains possible because targets and publishers are injected configuration/adapters.
