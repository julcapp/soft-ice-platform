CREATE TABLE "PrivateChannelAccessGrant" (
  "id" TEXT PRIMARY KEY,
  "subscriptionId" TEXT NOT NULL REFERENCES "PrivateChannelSubscription"("id") ON DELETE RESTRICT,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE RESTRICT,
  "channelType" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerChatRef" TEXT,
  "inviteLink" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3) NOT NULL,
  "grantedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "PrivateChannelAccessGrant_subscription_status_idx"
  ON "PrivateChannelAccessGrant"("subscriptionId", "status", "validUntil");
CREATE INDEX "PrivateChannelAccessGrant_customer_status_idx"
  ON "PrivateChannelAccessGrant"("customerId", "status", "validUntil");
