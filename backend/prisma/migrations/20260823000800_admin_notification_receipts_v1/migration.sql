CREATE TABLE "AdminNotificationReceipt" (
  "id" TEXT NOT NULL,
  "adminSubject" TEXT NOT NULL,
  "notificationKey" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminNotificationReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminNotificationReceipt_adminSubject_notificationKey_key"
ON "AdminNotificationReceipt"("adminSubject", "notificationKey");

CREATE INDEX "AdminNotificationReceipt_adminSubject_readAt_idx"
ON "AdminNotificationReceipt"("adminSubject", "readAt");
