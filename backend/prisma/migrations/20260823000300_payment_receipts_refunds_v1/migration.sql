ALTER TABLE "PrivateChannelPayment"
  ADD COLUMN IF NOT EXISTS "paymentMethodType" TEXT;

CREATE TABLE "PaymentReceipt" (
  "id" TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE RESTRICT,
  "paymentSourceType" TEXT NOT NULL,
  "paymentSourceId" TEXT NOT NULL,
  "orderId" TEXT,
  "subscriptionId" TEXT,
  "provider" TEXT NOT NULL,
  "providerReceiptId" TEXT,
  "receiptType" TEXT NOT NULL DEFAULT 'PAYMENT',
  "status" TEXT NOT NULL,
  "amountRub" DECIMAL(12,2) NOT NULL CHECK ("amountRub" >= 0),
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "fiscalDocumentNumber" TEXT,
  "fiscalDriveNumber" TEXT,
  "fiscalSign" TEXT,
  "receiptUrl" TEXT,
  "customerEmail" TEXT,
  "issuedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "PaymentReceipt_provider_receipt_key"
  ON "PaymentReceipt"("provider", "providerReceiptId")
  WHERE "providerReceiptId" IS NOT NULL;
CREATE INDEX "PaymentReceipt_customer_created_idx"
  ON "PaymentReceipt"("customerId", "createdAt" DESC);
CREATE INDEX "PaymentReceipt_source_idx"
  ON "PaymentReceipt"("paymentSourceType", "paymentSourceId");

CREATE TABLE "PaymentRefund" (
  "id" TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE RESTRICT,
  "paymentSourceType" TEXT NOT NULL,
  "paymentSourceId" TEXT NOT NULL,
  "orderId" TEXT,
  "subscriptionId" TEXT,
  "provider" TEXT NOT NULL,
  "providerRefundId" TEXT,
  "status" TEXT NOT NULL,
  "amountRub" DECIMAL(12,2) NOT NULL CHECK ("amountRub" > 0),
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "reason" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "succeededAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "PaymentRefund_provider_refund_key"
  ON "PaymentRefund"("provider", "providerRefundId")
  WHERE "providerRefundId" IS NOT NULL;
CREATE INDEX "PaymentRefund_customer_created_idx"
  ON "PaymentRefund"("customerId", "createdAt" DESC);
CREATE INDEX "PaymentRefund_source_idx"
  ON "PaymentRefund"("paymentSourceType", "paymentSourceId");
