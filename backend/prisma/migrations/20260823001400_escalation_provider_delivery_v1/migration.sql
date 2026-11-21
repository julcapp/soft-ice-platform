ALTER TABLE "AdminOperationsEscalationDelivery"
  ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "AdminOperationsEscalationDelivery_status_idx"
  ON "AdminOperationsEscalationDelivery"("status", "updatedAt");
