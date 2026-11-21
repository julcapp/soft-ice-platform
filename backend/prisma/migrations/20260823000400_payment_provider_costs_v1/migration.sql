CREATE TABLE "PaymentProviderCost" (
  "id" TEXT PRIMARY KEY,
  "customerId" TEXT REFERENCES "Customer"("id") ON DELETE SET NULL,
  "paymentSourceType" TEXT NOT NULL,
  "paymentSourceId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerPaymentId" TEXT,
  "paymentMethodType" TEXT,
  "grossAmountRub" DECIMAL(12,2) NOT NULL CHECK ("grossAmountRub" >= 0),
  "netSettlementRub" DECIMAL(12,2) NOT NULL CHECK ("netSettlementRub" >= 0),
  "processorCostTotalRub" DECIMAL(12,2) NOT NULL CHECK ("processorCostTotalRub" >= 0),
  "processorCommissionRub" DECIMAL(12,2),
  "processorCommissionVatRub" DECIMAL(12,2),
  "commissionRatePct" DECIMAL(8,4),
  "calculationSource" TEXT NOT NULL,
  "isFinal" BOOLEAN NOT NULL DEFAULT FALSE,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_provider_cost_amount_check" CHECK ("netSettlementRub" + "processorCostTotalRub" = "grossAmountRub"),
  CONSTRAINT "payment_provider_cost_component_check" CHECK (
    "processorCommissionRub" IS NULL OR "processorCommissionRub" >= 0
  ),
  CONSTRAINT "payment_provider_cost_vat_check" CHECK (
    "processorCommissionVatRub" IS NULL OR "processorCommissionVatRub" >= 0
  )
);

CREATE UNIQUE INDEX "PaymentProviderCost_source_key"
  ON "PaymentProviderCost"("paymentSourceType", "paymentSourceId");
CREATE UNIQUE INDEX "PaymentProviderCost_provider_payment_key"
  ON "PaymentProviderCost"("provider", "providerPaymentId")
  WHERE "providerPaymentId" IS NOT NULL;
CREATE INDEX "PaymentProviderCost_occurred_idx"
  ON "PaymentProviderCost"("occurredAt" DESC);
CREATE INDEX "PaymentProviderCost_customer_idx"
  ON "PaymentProviderCost"("customerId", "occurredAt" DESC);
