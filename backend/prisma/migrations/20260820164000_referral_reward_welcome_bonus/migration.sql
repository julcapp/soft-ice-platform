-- Bot Core 1.2/1.3: referral qualification + separate welcome promo balance

CREATE TABLE "ReferralQualification" (
  "id" TEXT NOT NULL,
  "referralId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "sourceEventId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralQualification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralQualification_referralId_key" ON "ReferralQualification"("referralId");
CREATE UNIQUE INDEX "ReferralQualification_sourceEventId_key" ON "ReferralQualification"("sourceEventId");
CREATE INDEX "ReferralQualification_action_occurredAt_idx" ON "ReferralQualification"("action", "occurredAt");
ALTER TABLE "ReferralQualification" ADD CONSTRAINT "ReferralQualification_referralId_fkey"
  FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WelcomeBonusGrant" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "amountGranted" INTEGER NOT NULL,
  "amountRemaining" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "qualifiedAt" TIMESTAMP(3),
  "qualifyingAction" TEXT,
  "qualifyingEventId" TEXT,
  "convertedAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "WelcomeBonusGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WelcomeBonusGrant_qualifyingEventId_key" ON "WelcomeBonusGrant"("qualifyingEventId");
CREATE INDEX "WelcomeBonusGrant_customerId_status_idx" ON "WelcomeBonusGrant"("customerId", "status");
CREATE INDEX "WelcomeBonusGrant_expiresAt_status_idx" ON "WelcomeBonusGrant"("expiresAt", "status");
ALTER TABLE "WelcomeBonusGrant" ADD CONSTRAINT "WelcomeBonusGrant_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
