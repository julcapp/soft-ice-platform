# Bot Core Prisma synchronization

Migration `20260820164000_referral_reward_welcome_bonus` creates two durable tables that must also exist in `backend/prisma/schema.prisma` before Bot Core can be merged.

Required Prisma models:

```prisma
model ReferralQualification {
  id            String   @id @default(uuid())
  referralId    String   @unique
  action        String
  sourceEventId String?  @unique
  occurredAt    DateTime
  createdAt     DateTime @default(now())

  @@index([action, occurredAt])
}

model WelcomeBonusGrant {
  id                 String    @id @default(uuid())
  customerId         String
  amountGranted      Int
  amountRemaining    Int
  status             String    @default("ACTIVE")
  issuedAt           DateTime  @default(now())
  expiresAt          DateTime
  qualifiedAt        DateTime?
  qualifyingAction   String?
  qualifyingEventId  String?   @unique
  convertedAt        DateTime?
  expiredAt          DateTime?
  metadata            Json?

  @@index([customerId, status])
  @@index([expiresAt, status])
}
```

The SQL migration additionally has foreign keys to `Referral(id)` and `Customer(id)`. Relations may be added to the Prisma models in the final schema patch, but scalar-only models are sufficient to make the storage contract explicit while the repositories still use raw SQL.

## Merge conflict with main

`main` is one commit ahead and adds durable `sale_flow`. The shared module registry must contain all four modules after resolution:

- `sale_flow`
- `bot_core`
- `referral`
- `welcome_bonus`

Do not discard the Sale Flow Prisma models/migrations when rebasing or merging main into this branch.

## Required checks before merge

```bash
cd backend
node scripts/check-bot-core-prisma-sync.js
npm run prisma:validate
npm test
```

Bot Core PR stays Draft until all three checks pass and GitHub reports the PR mergeable.
