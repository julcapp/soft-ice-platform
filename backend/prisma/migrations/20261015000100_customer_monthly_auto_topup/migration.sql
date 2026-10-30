CREATE TABLE IF NOT EXISTS "CustomerAutoTopupSchedule" (
  "id" TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL UNIQUE REFERENCES "Customer"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'PENDING_SETUP',
  "amountRub" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
  "billingDay" INTEGER NOT NULL DEFAULT 1,
  "provider" TEXT NOT NULL DEFAULT 'YOOKASSA',
  "providerPaymentMethodRef" TEXT,
  "paymentMethodType" TEXT,
  "offerVersion" TEXT NOT NULL,
  "offerAcceptedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextChargeAt" TIMESTAMPTZ,
  "lastSucceededAt" TIMESTAMPTZ,
  "disabledAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerAutoTopupSchedule_amount_positive" CHECK ("amountRub" > 0),
  CONSTRAINT "CustomerAutoTopupSchedule_billing_day" CHECK ("billingDay" BETWEEN 1 AND 28),
  CONSTRAINT "CustomerAutoTopupSchedule_frequency_monthly" CHECK ("frequency" = 'MONTHLY')
);

CREATE INDEX IF NOT EXISTS "CustomerAutoTopupSchedule_due_idx"
  ON "CustomerAutoTopupSchedule" ("status", "nextChargeAt");

CREATE TABLE IF NOT EXISTS "CustomerAutoTopupAttempt" (
  "id" TEXT PRIMARY KEY,
  "scheduleId" TEXT NOT NULL REFERENCES "CustomerAutoTopupSchedule"("id") ON DELETE CASCADE,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE CASCADE,
  "provider" TEXT NOT NULL DEFAULT 'YOOKASSA',
  "providerPaymentId" TEXT UNIQUE,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "amountRub" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "scheduledFor" TIMESTAMPTZ NOT NULL,
  "attemptedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "succeededAt" TIMESTAMPTZ,
  "creditedTransactionId" TEXT,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CustomerAutoTopupAttempt_schedule_idx"
  ON "CustomerAutoTopupAttempt" ("scheduleId", "scheduledFor");
CREATE INDEX IF NOT EXISTS "CustomerAutoTopupAttempt_status_idx"
  ON "CustomerAutoTopupAttempt" ("status", "attemptedAt");
