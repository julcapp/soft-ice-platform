CREATE TABLE "MiniAppClubTopupCheckout" (
 "id" TEXT PRIMARY KEY,
 "customerId" TEXT NOT NULL REFERENCES "Customer"("id"),
 "policyVersion" INTEGER NOT NULL REFERENCES "CustomerBenefitPolicyVersion"("version"),
 "amountCents" INTEGER NOT NULL CHECK ("amountCents">0),
 "shopId" TEXT NOT NULL,
 "test" BOOLEAN NOT NULL DEFAULT TRUE CHECK ("test"=TRUE),
 "status" TEXT NOT NULL DEFAULT 'CREATING' CHECK ("status" IN ('CREATING','PENDING','SUCCEEDED','CANCELED')),
 "providerPaymentId" TEXT UNIQUE,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "confirmedAt" TIMESTAMPTZ
);
CREATE UNIQUE INDEX "MiniAppClubTopupCheckout_one_open" ON "MiniAppClubTopupCheckout"("customerId") WHERE "status" IN ('CREATING','PENDING');
