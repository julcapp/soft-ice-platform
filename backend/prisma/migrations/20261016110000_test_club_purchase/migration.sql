-- Separate TEST ledger: never debit or credit the real ClubAccount.
CREATE TABLE "MiniAppTestClubDebit" (
 "id" TEXT PRIMARY KEY,
 "customerId" TEXT NOT NULL REFERENCES "Customer"("id"),
 "orderId" TEXT NOT NULL UNIQUE REFERENCES "Order"("id"),
 "paymentId" TEXT NOT NULL UNIQUE REFERENCES "Payment"("id"),
 "amountCents" INTEGER NOT NULL CHECK ("amountCents">0),
 "test" BOOLEAN NOT NULL DEFAULT TRUE CHECK ("test"=TRUE),
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MiniAppTestClubDebit_customer" ON "MiniAppTestClubDebit"("customerId");
