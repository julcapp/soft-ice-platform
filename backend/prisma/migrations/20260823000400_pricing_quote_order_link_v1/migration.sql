ALTER TABLE "PricingQuote" ADD COLUMN "orderId" TEXT;
CREATE UNIQUE INDEX "PricingQuote_orderId_key" ON "PricingQuote"("orderId");
ALTER TABLE "PricingQuote"
  ADD CONSTRAINT "PricingQuote_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PricingSnapshot" ADD COLUMN "orderId" TEXT;
CREATE UNIQUE INDEX "PricingSnapshot_orderId_key" ON "PricingSnapshot"("orderId");
ALTER TABLE "PricingSnapshot"
  ADD CONSTRAINT "PricingSnapshot_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
