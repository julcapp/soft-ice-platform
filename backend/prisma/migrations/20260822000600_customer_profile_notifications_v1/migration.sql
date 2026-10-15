CREATE TABLE "CustomerNotification" (
  "id" TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "importance" TEXT NOT NULL DEFAULT 'NORMAL',
  "actionType" TEXT,
  "actionPayload" JSONB,
  "significant" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3)
);

CREATE INDEX "CustomerNotification_customer_read_created_idx"
  ON "CustomerNotification"("customerId", "readAt", "createdAt" DESC);

CREATE TABLE "CustomerEmailVerification" (
  "id" TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3)
);

CREATE INDEX "CustomerEmailVerification_customer_status_idx"
  ON "CustomerEmailVerification"("customerId", "status", "createdAt" DESC);
CREATE INDEX "CustomerEmailVerification_expires_idx"
  ON "CustomerEmailVerification"("expiresAt");

CREATE TABLE "CustomerCommunicationConsent" (
  "id" TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE CASCADE,
  "consentType" TEXT NOT NULL,
  "isGranted" BOOLEAN NOT NULL,
  "rulesVersion" TEXT NOT NULL,
  "rulesUrl" TEXT,
  "sourceChannel" TEXT NOT NULL,
  "correlationId" TEXT,
  "grantedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "CustomerCommunicationConsent_customer_type_created_idx"
  ON "CustomerCommunicationConsent"("customerId", "consentType", "createdAt" DESC);
