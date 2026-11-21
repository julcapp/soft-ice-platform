-- Compatibility patch for v0.36: blockedUntil, blockReason, deletedAt
-- already exist (20261012000100_customer_account_controls).
-- Apply ONLY after backing up and verifying the active DB schema.
-- Match Prisma's TIMESTAMP(3) convention; never alter existing column types here.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Customer_status_blockedUntil_idx" ON "Customer" ("status", "blockedUntil");
