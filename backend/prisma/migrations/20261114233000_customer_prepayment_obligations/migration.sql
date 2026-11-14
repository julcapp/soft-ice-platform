-- Separate legal monetary obligations from Club bonuses. NOT deployed.
CREATE TABLE "CustomerPrepaymentObligation" (
 "id" TEXT NOT NULL,
 "orderId" TEXT NOT NULL,
 "customerId" TEXT NOT NULL,
 "sourcePaymentId" TEXT NOT NULL,
 "amountKopecks" BIGINT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PICKUP_AVAILABLE',
 "paidAt" TIMESTAMP(3) NOT NULL,
 "pickupUntil" TIMESTAMP(3) NOT NULL,
 "fulfilledAt" TIMESTAMP(3),
 "creditedToBalanceAt" TIMESTAMP(3),
 "refundedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CustomerPrepaymentObligation_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "CustomerPrepaymentObligation_amount_positive" CHECK ("amountKopecks" > 0),
 CONSTRAINT "CustomerPrepaymentObligation_status_check" CHECK ("status" IN ('PICKUP_AVAILABLE','ISSUED','BALANCE_CREDITED','REFUNDED'))
);
CREATE UNIQUE INDEX "CustomerPrepaymentObligation_orderId_key" ON "CustomerPrepaymentObligation"("orderId");
CREATE UNIQUE INDEX "CustomerPrepaymentObligation_sourcePaymentId_key" ON "CustomerPrepaymentObligation"("sourcePaymentId");
CREATE INDEX "CustomerPrepaymentObligation_customerId_status_pickupUntil_idx" ON "CustomerPrepaymentObligation"("customerId","status","pickupUntil");
CREATE INDEX "CustomerPrepaymentObligation_status_pickupUntil_idx" ON "CustomerPrepaymentObligation"("status","pickupUntil");

CREATE TABLE "CustomerAdvanceLedgerEntry" (
 "id" TEXT NOT NULL,
 "customerId" TEXT NOT NULL,
 "orderId" TEXT,
 "sourcePaymentId" TEXT,
 "movementType" TEXT NOT NULL,
 "amountKopecks" BIGINT NOT NULL,
 "idempotencyKey" TEXT NOT NULL,
 "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "metadata" JSONB,
 CONSTRAINT "CustomerAdvanceLedgerEntry_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "CustomerAdvanceLedgerEntry_amount_nonzero" CHECK ("amountKopecks" <> 0)
);
CREATE UNIQUE INDEX "CustomerAdvanceLedgerEntry_idempotencyKey_key" ON "CustomerAdvanceLedgerEntry"("idempotencyKey");
CREATE INDEX "CustomerAdvanceLedgerEntry_customerId_occurredAt_idx" ON "CustomerAdvanceLedgerEntry"("customerId","occurredAt");
CREATE INDEX "CustomerAdvanceLedgerEntry_orderId_movementType_idx" ON "CustomerAdvanceLedgerEntry"("orderId","movementType");
