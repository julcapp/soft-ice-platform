CREATE TABLE "UnverifiedPurchaseContact" (
    "id" TEXT NOT NULL,
    "phoneCiphertext" TEXT NOT NULL,
    "phoneFingerprint" TEXT NOT NULL,
    "phoneMasked" TEXT NOT NULL,
    "phoneStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "machineId" TEXT NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT NOT NULL DEFAULT 'TERMINAL',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchaseCompletedAt" TIMESTAMP(3),
    "linkedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnverifiedPurchaseContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseNotificationIntent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT,
    "contactId" TEXT,
    "machineId" TEXT,
    "notificationType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_IDENTITY',
    "phoneStatus" TEXT,
    "phoneCiphertext" TEXT,
    "phoneFingerprint" TEXT,
    "phoneMasked" TEXT,
    "amountRub" DOUBLE PRECISION,
    "bonusAccrued" INTEGER,
    "bonusBalance" INTEGER,
    "receiptUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SALE_FLOW',
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "PurchaseNotificationIntent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UnverifiedPurchaseContact_phoneFingerprint_status_idx"
ON "UnverifiedPurchaseContact"("phoneFingerprint", "status");

CREATE INDEX "UnverifiedPurchaseContact_machineId_capturedAt_idx"
ON "UnverifiedPurchaseContact"("machineId", "capturedAt");

CREATE INDEX "UnverifiedPurchaseContact_orderId_idx"
ON "UnverifiedPurchaseContact"("orderId");

CREATE INDEX "UnverifiedPurchaseContact_customerId_idx"
ON "UnverifiedPurchaseContact"("customerId");

CREATE INDEX "PurchaseNotificationIntent_orderId_notificationType_idx"
ON "PurchaseNotificationIntent"("orderId", "notificationType");

CREATE INDEX "PurchaseNotificationIntent_customerId_status_idx"
ON "PurchaseNotificationIntent"("customerId", "status");

CREATE INDEX "PurchaseNotificationIntent_phoneFingerprint_status_idx"
ON "PurchaseNotificationIntent"("phoneFingerprint", "status");

CREATE INDEX "PurchaseNotificationIntent_createdAt_idx"
ON "PurchaseNotificationIntent"("createdAt");
