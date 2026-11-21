# ADR-054: MAX customer and security bot boundary

Status: Accepted  
Date: 2026-11-02

## Context

Soft ICE operates two independent MAX bots with different responsibilities. Mixing their tokens, webhook URLs, start flows or messages causes customer-facing security prompts and makes terminal verification unreliable.

## Decision

### Customer bot

- Name: `Клуб "У Тимоши"`
- MAX username: `id7017438363_bot`
- Production webhook: `https://display.utimoshi.ru/api/webhooks/max`
- Credentials: `MAX_BOT_TOKEN` and `MAX_WEBHOOK_SECRET`
- Mini App: `https://miniapp.utimoshi.ru`

Ordinary MAX `/start` or `bot_started` opens the Club main menu. It does not request a phone number and does not invoke security-code flows.

Phone confirmation starts only from a terminal-created deep link carrying `verify_<opaque-token>`. The bot then renders MAX `request_contact` with the action «Поделиться номером и подтвердить». The backend validates the MAX contact, compares it with the terminal-entered phone fingerprint, links the MAX identity only on a match, and sets the terminal challenge to `VERIFIED`.

A customer purchase is not blocked while phone verification is incomplete.

### Security bot

- Name: `Soft_ICE Безопасность`
- MAX username: `id7017438363_1_bot`
- It is a separate service boundary and must not use `MAX_BOT_TOKEN`.
- Administrative/security delivery may use only `ADMIN_SECURITY_MAX_BOT_TOKEN` (or explicit test credentials in test mode).
- Customer Club flows, Mini App onboarding, terminal verification and customer rewards must never be handled by this bot.

The current legacy security gateway may continue to own its isolated `/webhooks/max` endpoint until migrated. The customer Node backend must not expose `/webhooks/max` as an alias; its MAX endpoint is only `/api/webhooks/max`.

## Invariants

1. Customer and security MAX tokens are never interchangeable or used as fallback credentials.
2. Customer `/start` means Club menu; `verify_<token>` means terminal phone verification.
3. Security messages and codes never appear in the customer bot.
4. No phone number is embedded in a MAX deep link; only an opaque challenge token is allowed.
5. A verified MAX contact is accepted only when its phone matches the terminal challenge.
6. Existing customer purchases remain possible when verification is pending.
7. Deployment configuration must preserve separate webhook subscriptions for the two bots.

## Verification

Regression coverage must include:
- ordinary customer MAX start bypasses onboarding and opens `menu`;
- verification deep link renders `request_contact`;
- phone mismatch is rejected;
- challenge subject cannot be rebound to another MAX user;
- admin security delivery fails closed when only the customer token is configured.
