CREATE TABLE "CustomerMachineRewardCounter" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "machineId" TEXT NOT NULL,
  "completedPurchases" INTEGER NOT NULL DEFAULT 0,
  "lastCompletedOrderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerMachineRewardCounter_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerMachineRewardCounter_completedPurchases_check" CHECK ("completedPurchases" >= 0)
);

CREATE UNIQUE INDEX "CustomerMachineRewardCounter_customer_machine_key"
  ON "CustomerMachineRewardCounter"("customerId", "machineId");

CREATE TABLE "GiftRewardReservation" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "machineId" TEXT NOT NULL,
  "purchaseOrdinal" INTEGER NOT NULL,
  "itemId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "orderId" TEXT,
  "metadata" JSONB,
  CONSTRAINT "GiftRewardReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GiftRewardReservation_purchaseOrdinal_check" CHECK ("purchaseOrdinal" > 0)
);

CREATE UNIQUE INDEX "GiftRewardReservation_quote_key" ON "GiftRewardReservation"("quoteId");
CREATE UNIQUE INDEX "GiftRewardReservation_active_customer_machine_unique"
  ON "GiftRewardReservation"("customerId", "machineId") WHERE "status" = 'RESERVED';
CREATE INDEX "GiftRewardReservation_customer_machine_status_idx"
  ON "GiftRewardReservation"("customerId", "machineId", "status", "expiresAt");

ALTER TABLE "CustomerMachineRewardCounter"
  ADD CONSTRAINT "CustomerMachineRewardCounter_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerMachineRewardCounter"
  ADD CONSTRAINT "CustomerMachineRewardCounter_machineId_fkey"
  FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GiftRewardReservation"
  ADD CONSTRAINT "GiftRewardReservation_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "PricingQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GiftRewardReservation"
  ADD CONSTRAINT "GiftRewardReservation_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GiftRewardReservation"
  ADD CONSTRAINT "GiftRewardReservation_machineId_fkey"
  FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
