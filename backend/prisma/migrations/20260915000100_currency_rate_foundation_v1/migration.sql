-- Currency Rate Foundation v0.1
-- Historical FX cache for official and explicitly identified rate sources.

CREATE TABLE "CurrencyRate" (
    "id" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "rateDate" TIMESTAMP(3) NOT NULL,
    "nominal" DECIMAL(18,6) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "unitRate" DECIMAL(18,8) NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rawResponseHash" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CurrencyRate_currencyCode_requestedDate_source_key"
ON "CurrencyRate"("currencyCode", "requestedDate", "source");

CREATE INDEX "CurrencyRate_currencyCode_rateDate_idx"
ON "CurrencyRate"("currencyCode", "rateDate");

CREATE INDEX "CurrencyRate_requestedDate_idx"
ON "CurrencyRate"("requestedDate");

ALTER TABLE "CurrencyRate"
    ADD CONSTRAINT "CurrencyRate_nominal_positive" CHECK ("nominal" > 0),
    ADD CONSTRAINT "CurrencyRate_rate_positive" CHECK ("rate" > 0),
    ADD CONSTRAINT "CurrencyRate_unitRate_positive" CHECK ("unitRate" > 0);
