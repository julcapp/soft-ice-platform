-- MVP vertical slice 002: Club Account status, balance projection and immutable loyalty ledger records.

ALTER TABLE "ClubAccount"
    ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'RUB',
    ADD COLUMN "availableBalanceRub" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "reservedBalanceRub" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "lastTransactionId" TEXT,
    ADD COLUMN "projectionVersion" INTEGER NOT NULL DEFAULT 0;

UPDATE "ClubAccount"
SET
    "status" = CASE WHEN "clubActive" THEN 'active' ELSE 'pending_activation' END,
    "availableBalanceRub" = "balanceRub",
    "reservedBalanceRub" = 0;

CREATE TABLE "ClubAccountTransaction" (
    "id" TEXT NOT NULL,
    "clubAccountId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amountRub" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "availableDeltaRub" DOUBLE PRECISION NOT NULL,
    "reservedDeltaRub" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availableBalanceAfterRub" DOUBLE PRECISION NOT NULL,
    "reservedBalanceAfterRub" DOUBLE PRECISION NOT NULL,
    "balanceAfterRub" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "reason" TEXT NOT NULL,
    "referenceEntityType" TEXT,
    "referenceEntityId" TEXT,
    "sourceDomain" TEXT,
    "sourceId" TEXT,
    "idempotencyKey" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'customer',
    "actorId" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubAccountTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubAccountTransaction_clubAccountId_idempotencyKey_key"
    ON "ClubAccountTransaction"("clubAccountId", "idempotencyKey");

CREATE INDEX "ClubAccountTransaction_customerId_postedAt_idx"
    ON "ClubAccountTransaction"("customerId", "postedAt");

CREATE INDEX "ClubAccountTransaction_clubAccountId_postedAt_idx"
    ON "ClubAccountTransaction"("clubAccountId", "postedAt");

ALTER TABLE "ClubAccountTransaction"
    ADD CONSTRAINT "ClubAccountTransaction_clubAccountId_fkey"
    FOREIGN KEY ("clubAccountId") REFERENCES "ClubAccount"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BonusTransaction"
    ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'credit',
    ADD COLUMN "reason" TEXT,
    ADD COLUMN "referenceEntityType" TEXT,
    ADD COLUMN "referenceEntityId" TEXT,
    ADD COLUMN "balanceAfterBonus" INTEGER,
    ADD COLUMN "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
