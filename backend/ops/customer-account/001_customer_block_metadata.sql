-- Soft ICE customer account controls; apply after backup and schema reconciliation.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "blockedUntil" TIMESTAMPTZ;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "blockReason" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS "Customer_status_blockedUntil_idx" ON "Customer" ("status", "blockedUntil");

