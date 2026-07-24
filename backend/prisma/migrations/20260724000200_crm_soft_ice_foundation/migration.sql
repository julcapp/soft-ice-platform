CREATE TABLE "CrmCustomerProfile" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "managerId" TEXT,
  "serviceNote" TEXT,
  "preferredChannel" TEXT NOT NULL DEFAULT 'TELEGRAM',
  "communicationStatus" TEXT NOT NULL DEFAULT 'ALLOWED',
  "updatedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmCustomerProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CrmCustomerProfile_customerId_key" ON "CrmCustomerProfile"("customerId");

CREATE TABLE "CrmCampaign" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "segmentId" TEXT,
  "channel" TEXT NOT NULL,
  "messageTemplate" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmCampaign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CrmCampaign_code_key" ON "CrmCampaign"("code");
CREATE INDEX "CrmCampaign_status_startsAt_idx" ON "CrmCampaign"("status", "startsAt");
CREATE INDEX "CrmCampaign_segmentId_idx" ON "CrmCampaign"("segmentId");

CREATE TABLE "CrmNotificationDelivery" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "campaignId" TEXT,
  "channel" TEXT NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "providerId" TEXT,
  "failureReason" TEXT,
  "idempotencyKey" TEXT,
  "correlationId" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "CrmNotificationDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CrmNotificationDelivery_idempotencyKey_key" ON "CrmNotificationDelivery"("idempotencyKey");
CREATE INDEX "CrmNotificationDelivery_customerId_createdAt_idx" ON "CrmNotificationDelivery"("customerId", "createdAt");
CREATE INDEX "CrmNotificationDelivery_status_createdAt_idx" ON "CrmNotificationDelivery"("status", "createdAt");

ALTER TABLE "CrmCustomerProfile" ADD CONSTRAINT "CrmCustomerProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmNotificationDelivery" ADD CONSTRAINT "CrmNotificationDelivery_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmNotificationDelivery" ADD CONSTRAINT "CrmNotificationDelivery_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CrmCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
