CREATE TABLE "PrivateChannelRenewalAttempt" (
  "id" TEXT PRIMARY KEY,
  "subscriptionId" TEXT NOT NULL REFERENCES "PrivateChannelSubscription"("id") ON DELETE RESTRICT,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE RESTRICT,
  "planCode" TEXT NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'YOOKASSA',
  "providerPaymentId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("subscriptionId", "periodEnd")
);

CREATE INDEX "PrivateChannelRenewalAttempt_status_period_idx"
  ON "PrivateChannelRenewalAttempt"("status", "periodEnd");
