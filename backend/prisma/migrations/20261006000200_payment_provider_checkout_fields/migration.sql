ALTER TABLE "Payment"
  ADD COLUMN "confirmationUrl" TEXT,
  ADD COLUMN "paymentMethodType" TEXT,
  ADD COLUMN "incomeAmount" DECIMAL(18,2),
  ADD COLUMN "channel" TEXT,
  ADD COLUMN "failureCode" TEXT;
