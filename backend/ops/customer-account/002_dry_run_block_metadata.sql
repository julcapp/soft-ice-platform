\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Customer_status_blockedUntil_idx" ON "Customer" ("status", "blockedUntil");
SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Customer' AND column_name IN ('blockedAt','blockedUntil','blockReason') ORDER BY column_name;
ROLLBACK;
