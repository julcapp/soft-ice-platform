# ADR-045 — UGC Multi-channel Publication v1

**Date:** 2026-08-22  
**Status:** Accepted  
**Project:** Soft ICE Platform / «У Тимоши»

## Context

Approved customer photos must be distributed to the project's public channels and their publication state must remain auditable independently per channel.

The confirmed public targets are:

- VK — `club239119350`, `https://vk.com/club239119350`;
- Telegram — `@ice_robo_club`, `https://t.me/ice_robo_club`;
- MAX — `https://max.ru/channel_soft_icecream`, while its API `chat_id` is supplied separately through `MAX_CHANNEL_CHAT_ID`.

## Decision

Introduce `PhotoPublishingOrchestrator` as a channel-neutral publishing coordinator.

Each channel receives an independent publish attempt with a stable idempotency key based on `photoChallengeId + channel`.

Publication state is persisted independently for each `PhotoChallenge/channel` pair. A retry of one failed channel must not create a second logical publication record and must not roll back or overwrite successful publication evidence from other channels.

Supported publication states include:

- `pending`;
- `published`;
- `failed`;
- `not_configured`.

The batch reports both `anyPublished` and `allRequiredPublished`. The complete UGC publication workflow reaches confirmed publication only when all currently required targets have successfully published. Partial success is retained and failed/unconfigured channels can be retried independently.

## Persistence

`PhotoPublication` contains:

- `targetId`;
- `attemptCount`;
- `lastAttemptAt`;
- `idempotencyKey`;
- unique `(photoChallengeId, channel)`;
- external publication ID;
- publication URL;
- published/confirmed timestamps;
- failure diagnostics.

## Failure behavior

- A successful publication in one channel is retained if another channel fails.
- A missing target or publisher is `not_configured`, never simulated as success.
- A failed required channel prevents `allRequiredPublished=true` but does not undo other successful channels.
- Retry increments attempt state for that channel while preserving its logical identity.

## MAX chat_id resolution

The public MAX URL is not used as an API identifier. The helper command:

```bash
npm run max:resolve-chat-id
```

reads MAX Bot API updates and prints discovered `chat_id` values. The bot must be added by an administrator to the public channel. The resolved value is stored only as the runtime secret/configuration value `MAX_CHANNEL_CHAT_ID`.

## Guarded integration smoke-test

The first real three-channel publication is executed through:

```bash
npm run photo:publish-smoke
```

The command is fail-closed and refuses to publish unless `PHOTO_PUBLISH_SMOKE_CONFIRM=YES` is explicitly set. It also requires:

- `PHOTO_PUBLISH_SMOKE_IMAGE` — absolute path to the test image;
- `TELEGRAM_BOT_TOKEN`;
- `VK_ACCESS_TOKEN`;
- `MAX_BOT_TOKEN`;
- `MAX_CHANNEL_CHAT_ID`.

Optional `PHOTO_PUBLISH_SMOKE_CAPTION` controls the test caption.

Example on a trusted staging/production host:

```bash
PHOTO_PUBLISH_SMOKE_CONFIRM=YES \
PHOTO_PUBLISH_SMOKE_IMAGE=/absolute/path/test-photo.jpg \
PHOTO_PUBLISH_SMOKE_CAPTION='Тест публикации Photo Verification — У Тимоши' \
npm run photo:publish-smoke
```

The same image is submitted to VK, Telegram and MAX in parallel. The result of every channel is printed independently. Partial success is reported as partial failure; it is never promoted to full success.

## Reward and retention boundary

The publishing orchestrator never grants bonuses and never deletes source media.

Reward eligibility and source-file deletion depend on confirmed publication. For the current three-required-channel policy, the complete publication condition is `allRequiredPublished=true`.

## Consequences

- all three public UGC targets are explicit;
- MAX API identity remains separate from its public URL;
- channel outages are isolated;
- publication audit and customer-cabinet status can show channel-level progress;
- integration publishing cannot be triggered accidentally by the smoke-test script;
- SaaS extraction remains possible because targets and publishers are injected configuration/adapters.
