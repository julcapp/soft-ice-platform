-- Immutable pickup evidence for prepaid Mini App orders.
-- Migration for staging only. Must be applied after previous TimoPOS migrations.
CREATE TABLE "TimoPosPrepaidFulfillment" (
 "id" TEXT NOT NULL,
 "orderId" TEXT NOT NULL,
 "customerId" TEXT NOT NULL,
 "pointId" TEXT NOT NULL,
 "pointCode" TEXT NOT NULL,
 "pointName" TEXT NOT NULL,
 "terminalId" TEXT NOT NULL,
 "sellerId" TEXT NOT NULL,
 "shiftId" TEXT NOT NULL,
 "pickupProofHash" TEXT NOT NULL,
 "paymentId" TEXT NOT NULL,
 "amountKopecks" BIGINT NOT NULL,
 "issuedAt" TIMESTAMP(3) NOT NULL,
 "idempotencyKey" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "TimoPosPrepaidFulfillment_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "TimoPosPrepaidFulfillment_amount_positive" CHECK ("amountKopecks" > 0)
);
CREATE UNIQUE INDEX "TimoPosPrepaidFulfillment_orderId_key" ON "TimoPosPrepaidFulfillment"("orderId");
CREATE UNIQUE INDEX "TimoPosPrepaidFulfillment_pickupProofHash_key" ON "TimoPosPrepaidFulfillment"("pickupProofHash");
CREATE UNIQUE INDEX "TimoPosPrepaidFulfillment_idempotencyKey_key" ON "TimoPosPrepaidFulfillment"("idempotencyKey");
CREATE INDEX "TimoPosPrepaidFulfillment_customerId_issuedAt_idx" ON "TimoPosPrepaidFulfillment"("customerId","issuedAt");
CREATE INDEX "TimoPosPrepaidFulfillment_pointId_issuedAt_idx" ON "TimoPosPrepaidFulfillment"("pointId","issuedAt");
CREATE INDEX "TimoPosPrepaidFulfillment_shiftId_issuedAt_idx" ON "TimoPosPrepaidFulfillment"("shiftId","issuedAt");
