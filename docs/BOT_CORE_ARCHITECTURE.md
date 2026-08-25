# Bot Core architecture

## Purpose

Bot Core provides one transport-neutral runtime for Telegram and MAX without duplicating business logic or the Mini App. Channel adapters normalize inbound updates; shared services resolve the customer, apply onboarding/referral logic, prepare transport-neutral views, and channel renderers convert those views into Telegram/MAX payloads.

## Main components

- `BotAdapter` — normalized inbound contract.
- `TelegramAdapter`, `MaxAdapter` — channel-specific normalization.
- `DeepLinkParser` — start/deep-link attribution parsing.
- `BotGateway` — customer identity resolution boundary.
- `BotOnboardingService` — onboarding and identity linking flow.
- `OnboardingPolicy` — onboarding rules.
- `BotUserFlowService` — shared user flow actions.
- `BotClubView` — transport-neutral club/referral view models.
- `BotActionRouter` — callback/action routing.
- `TelegramRenderer`, `MaxRenderer` — transport payload rendering.
- `BotTransportSender` — preview-safe outbound boundary.
- `BotRuntime` — inbound update -> normalize -> resolve -> route -> render -> send.
- `createBotRuntimeComposition` — runtime composition root.

## Referral and welcome bonus

Referral processing is isolated in `modules/referral` and consists of referral policy, repository, service, event orchestrator and reward engine. Welcome bonus processing is isolated in `modules/welcome_bonus` with a separate grant lifecycle and promo balance semantics.

The database side is synchronized in Prisma:

- `ReferralQualification` is a one-to-one qualification record for `Referral`;
- `WelcomeBonusGrant` belongs to `Customer`;
- both models mirror migration `20260820164000_referral_reward_welcome_bonus` including unique keys, indexes and cascade relations.

## Webhooks and security

Telegram and MAX webhooks use separate handlers but share Bot Runtime. Telegram checks `X-Telegram-Bot-Api-Secret-Token`; MAX checks `X-Max-Bot-Api-Secret`. Tokens and webhook secrets are environment-only and are not stored in the repository.

`BOT_WEBHOOKS_ENABLED=false` is the default production safety boundary. Existing Telegram/YooKassa production behavior is not replaced until the Bot Core rollout is explicitly enabled.

Telegram Bot API 10.3 capabilities are controlled separately by `TELEGRAM_RICH_MESSAGES_ENABLED`, `TELEGRAM_EPHEMERAL_MESSAGES_ENABLED` and `TELEGRAM_DISABLED_BUTTONS_ENABLED`. All three default to `false`; their adoption and noncritical-delivery boundary are defined in ADR-046.

## CI readiness gate

Bot Core CI is mandatory before production enablement and runs:

1. dependency installation;
2. `prisma validate` against the current primary schema;
3. `check-bot-core-prisma-sync.js` as a hard guardrail;
4. Bot Core, transport, webhook, referral and welcome-bonus test suites.

The PR remains Draft until this CI is green for the current head.

## Production rollout sequence

1. Keep PR Draft while validating schema and tests.
2. Confirm CI green on the exact PR head.
3. Prepare isolated Telegram test-bot token and webhook secret in environment only.
4. Enable Bot Core only in the test environment.
5. Exercise `/start`, identity/onboarding, `Мой клуб`, referral deep link and reward qualification end-to-end.
6. Test duplicate events/idempotency and invalid webhook secrets.
7. Only after the test bot passes, plan a separate production rollout for Telegram.
8. Add MAX real client/webhook after the common runtime is stable; business logic remains shared.
