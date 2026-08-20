ALTER TABLE "SaleFlowIdempotencyKey"
ADD CONSTRAINT "SaleFlowIdempotencyKey_flowId_fkey"
FOREIGN KEY ("flowId") REFERENCES "SaleFlow"("flowId")
ON DELETE RESTRICT ON UPDATE CASCADE;
