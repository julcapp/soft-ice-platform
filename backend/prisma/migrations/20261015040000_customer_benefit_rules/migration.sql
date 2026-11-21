CREATE TABLE "CustomerBenefitPolicyVersion" (
  "version" SERIAL PRIMARY KEY,
  "rules" JSONB NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('DRAFT','LIVE')),
  "actorId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "CustomerBenefitPosting" (
  "id" TEXT PRIMARY KEY,
  "operationKey" TEXT NOT NULL UNIQUE,
  "policyVersion" INTEGER NOT NULL REFERENCES "CustomerBenefitPolicyVersion"("version"),
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id"),
  "orderId" TEXT NOT NULL REFERENCES "Order"("id"),
  "ruleKey" TEXT NOT NULL,
  "amountBonus" INTEGER NOT NULL CHECK ("amountBonus" > 0),
  "bonusTransactionId" TEXT NOT NULL UNIQUE REFERENCES "BonusTransaction"("id"),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CustomerBenefitPosting_order_idx" ON "CustomerBenefitPosting"("orderId");
CREATE TABLE "CustomerBenefitPreview" (
  "id" TEXT PRIMARY KEY,
  "policyVersion" INTEGER NOT NULL REFERENCES "CustomerBenefitPolicyVersion"("version"),
  "actorId" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
