ALTER TABLE "MachineCallbackInbox"
  ADD COLUMN "callbackFailureCode" TEXT,
  ADD COLUMN "callbackFailureMessageSafe" TEXT,
  ADD COLUMN "physicalConsumptionUnknown" BOOLEAN,
  ADD COLUMN "processingLockedAt" TIMESTAMP(3),
  ADD COLUMN "processingLockedBy" TEXT;

CREATE INDEX "MachineCallbackInbox_processing_claim_idx"
  ON "MachineCallbackInbox"("status", "processingLockedAt", "receivedAt");
