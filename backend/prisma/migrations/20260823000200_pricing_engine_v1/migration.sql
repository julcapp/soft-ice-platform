-- Pricing Engine v1: immutable server-side quotes and pricing snapshots.

CREATE TABLE "PricingQuote" (
  "id" TEXT NOT NULL,
  "customerId" TEXT,
  "machineId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "baseAmount" DECIMAL(12,2) NOT NULL,
  "giftAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "promotionDiscountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "finalAmount" DECIMAL(12,2) NOT NULL,
  "bonusPaymentAllowed" BOOLEAN NOT NULL DEFAULT true,
  "partialBonusPaymentAllowed" BOOLEAN NOT NULL DEFAULT true,
  "transferAllowed" BOOLEAN NOT NULL DEFAULT true,
  "paymentRequired" BOOLEAN NOT NULL DEFAULT true,
  "campaignId" TEXT,
  "promotionVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedUntil" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "PricingQuote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PricingQuote_amounts_check" CHECK (
    "baseAmount" >= 0 AND "giftAmount" >= 0 AND "promotionDiscountAmount" >= 0 AND "finalAmount" >= 0
  )
);

CREATE INDEX "PricingQuote_customer_createdAt_idx" ON "PricingQuote"("customerId", "createdAt");
CREATE INDEX "PricingQuote_machine_createdAt_idx" ON "PricingQuote"("machineId", "createdAt");
CREATE INDEX "PricingQuote_lockedUntil_idx" ON "PricingQuote"("lockedUntil");
CREATE INDEX "PricingQuote_campaign_createdAt_idx" ON "PricingQuote"("campaignId", "createdAt");

CREATE TABLE "PricingSnapshot" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "baseAmount" DECIMAL(12,2) NOT NULL,
  "giftAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "promotionDiscountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "bonusAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "finalAmount" DECIMAL(12,2) NOT NULL,
  "pricingRuleVersion" TEXT NOT NULL DEFAULT 'pricing-v1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedUntil" TIMESTAMP(3) NOT NULL,
  "rules" JSONB,
  "metadata" JSONB,
  CONSTRAINT "PricingSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PricingSnapshot_quoteId_key" ON "PricingSnapshot"("quoteId");

CREATE TABLE "PricingSnapshotItem" (
  "id" TEXT NOT NULL,
  "pricingSnapshotId" TEXT NOT NULL,
  "itemId" TEXT,
  "sku" TEXT,
  "name" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "baseAmount" DECIMAL(12,2) NOT NULL,
  "giftAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "promotionDiscountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "finalAmount" DECIMAL(12,2) NOT NULL,
  "giftApplied" BOOLEAN NOT NULL DEFAULT false,
  "campaignId" TEXT,
  "promotionVersionId" TEXT,
  "metadata" JSONB,
  CONSTRAINT "PricingSnapshotItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PricingSnapshotItem_snapshot_idx" ON "PricingSnapshotItem"("pricingSnapshotId");

ALTER TABLE "PricingQuote"
  ADD CONSTRAINT "PricingQuote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PricingQuote"
  ADD CONSTRAINT "PricingQuote_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PricingQuote"
  ADD CONSTRAINT "PricingQuote_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PricingQuote"
  ADD CONSTRAINT "PricingQuote_promotionVersionId_fkey" FOREIGN KEY ("promotionVersionId") REFERENCES "PromotionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PricingSnapshot"
  ADD CONSTRAINT "PricingSnapshot_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "PricingQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PricingSnapshotItem"
  ADD CONSTRAINT "PricingSnapshotItem_pricingSnapshotId_fkey" FOREIGN KEY ("pricingSnapshotId") REFERENCES "PricingSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
