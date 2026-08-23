CREATE TABLE "AdminOperationsEscalationDelivery" (
    "id" TEXT NOT NULL,
    "escalationId" TEXT NOT NULL,
    "recipientCustomerId" TEXT,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "crmDeliveryId" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminOperationsEscalationDelivery_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AdminOperationsEscalationDelivery_escalationId_fkey" FOREIGN KEY ("escalationId") REFERENCES "AdminOperationsEscalation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AdminOperationsEscalationDelivery_escalationId_channel_key" ON "AdminOperationsEscalationDelivery"("escalationId", "channel");
CREATE INDEX "AdminOperationsEscalationDelivery_status_updatedAt_idx" ON "AdminOperationsEscalationDelivery"("status", "updatedAt");
