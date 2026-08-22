CREATE TABLE "PrivateChannelPlan" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "channelType" TEXT NOT NULL,
  "targetExternalId" TEXT,
  "priceRub" DECIMAL(12,2) NOT NULL CHECK ("priceRub" > 0),
  "billingPeriodDays" INTEGER NOT NULL CHECK ("billingPeriodDays" > 0),
  "isActive" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PrivateChannelSubscription" (
  "id" TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE RESTRICT,
  "planId" TEXT NOT NULL REFERENCES "PrivateChannelPlan"("id") ON DELETE RESTRICT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "recurringEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "recurringConsentAt" TIMESTAMP(3),
  "recurringConsentVersion" TEXT,
  "providerPaymentMethodRef" TEXT,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT FALSE,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "private_channel_recurring_consent_check" CHECK (
    "recurringEnabled" = FALSE OR ("recurringConsentAt" IS NOT NULL AND "recurringConsentVersion" IS NOT NULL)
  )
);

CREATE INDEX "PrivateChannelSubscription_customer_status_idx" ON "PrivateChannelSubscription"("customerId", "status");
CREATE INDEX "PrivateChannelSubscription_period_end_idx" ON "PrivateChannelSubscription"("currentPeriodEnd");

CREATE TABLE "PrivateChannelPayment" (
  "id" TEXT PRIMARY KEY,
  "subscriptionId" TEXT NOT NULL REFERENCES "PrivateChannelSubscription"("id") ON DELETE RESTRICT,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE RESTRICT,
  "provider" TEXT NOT NULL,
  "providerPaymentId" TEXT,
  "paymentKind" TEXT NOT NULL,
  "amountRub" DECIMAL(12,2) NOT NULL CHECK ("amountRub" > 0),
  "status" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "idempotencyKey" TEXT UNIQUE,
  "paidAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "PrivateChannelPayment_subscription_created_idx" ON "PrivateChannelPayment"("subscriptionId", "createdAt");
CREATE INDEX "PrivateChannelPayment_paid_at_idx" ON "PrivateChannelPayment"("paidAt");
