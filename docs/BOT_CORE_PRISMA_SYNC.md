# Bot Core Prisma sync

## Status

`ReferralQualification` and `WelcomeBonusGrant` are now represented in the primary `backend/prisma/schema.prisma` and match migration `20260820164000_referral_reward_welcome_bonus`.

The schema contains:

- `Customer.welcomeBonusGrants -> WelcomeBonusGrant[]`;
- `Referral.qualification -> ReferralQualification?`;
- `ReferralQualification.referralId` as a unique 1:1 foreign key with cascade delete;
- `ReferralQualification.sourceEventId` as unique;
- `ReferralQualification(action, occurredAt)` index;
- `WelcomeBonusGrant.customerId -> Customer.id` with cascade delete;
- `WelcomeBonusGrant.qualifyingEventId` as unique;
- `WelcomeBonusGrant(customerId, status)` index;
- `WelcomeBonusGrant(expiresAt, status)` index.

## Guardrail

`backend/scripts/check-bot-core-prisma-sync.js` verifies that both required models remain present. The Bot Core CI workflow treats this audit as a mandatory step together with `prisma validate` and the Bot/Referral/Welcome Bonus tests.

## Migration ownership

The existing SQL migration remains the source of database DDL for these tables. No replacement migration was generated during schema synchronization, so deployed migration history stays stable.

## Production rule

Do not enable production Telegram/MAX webhook runtime until the Bot Core CI run for the current PR head is green. `BOT_WEBHOOKS_ENABLED=false` remains the default safety boundary.
