CREATE TABLE "CustomerBenefitEventPosting" (
 "id" TEXT PRIMARY KEY,
 "operationKey" TEXT NOT NULL UNIQUE,
 "policyVersion" INTEGER NOT NULL REFERENCES "CustomerBenefitPolicyVersion"("version"),
 "customerId" TEXT NOT NULL REFERENCES "Customer"("id"),
 "ruleKey" TEXT NOT NULL,
 "amountBonus" INTEGER NOT NULL CHECK ("amountBonus">0),
 "bonusTransactionId" TEXT NOT NULL UNIQUE REFERENCES "BonusTransaction"("id"),
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CustomerBenefitEventPosting_customer_idx" ON "CustomerBenefitEventPosting"("customerId","createdAt");
