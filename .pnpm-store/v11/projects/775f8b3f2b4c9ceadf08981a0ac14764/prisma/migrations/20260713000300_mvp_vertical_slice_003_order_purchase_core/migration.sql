-- MVP vertical slice 003: Order purchase core, customer order history and paid-event readiness.

CREATE TYPE "OrderStatus" AS ENUM (
    'CREATED',
    'PAYMENT_PENDING',
    'PAID',
    'DISPENSING',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
);

ALTER TABLE "Order"
    ADD COLUMN "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    ADD COLUMN "amount" DOUBLE PRECISION,
    ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'RUB',
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Order"
SET "amount" = COALESCE("amountPaidRub", "basePriceRub", 0);

ALTER TABLE "Order"
    ALTER COLUMN "amount" SET NOT NULL,
    ALTER COLUMN "machineId" DROP NOT NULL,
    ALTER COLUMN "flavor" DROP NOT NULL,
    ALTER COLUMN "basePriceRub" DROP NOT NULL,
    ALTER COLUMN "amountPaidRub" DROP NOT NULL,
    ALTER COLUMN "paymentMethod" DROP NOT NULL;

UPDATE "Order"
SET "status" = CASE
    WHEN "paymentStatus" = 'paid' THEN 'PAID'::"OrderStatus"
    WHEN "paymentStatus" = 'failed' THEN 'FAILED'::"OrderStatus"
    ELSE 'CREATED'::"OrderStatus"
END;

ALTER TABLE "Order" DROP CONSTRAINT "Order_customerId_fkey";
ALTER TABLE "Order" DROP CONSTRAINT "Order_machineId_fkey";

ALTER TABLE "Order"
    ALTER COLUMN "customerId" SET NOT NULL;

ALTER TABLE "Order"
    ADD CONSTRAINT "Order_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
    ADD CONSTRAINT "Order_machineId_fkey"
    FOREIGN KEY ("machineId") REFERENCES "Machine"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
