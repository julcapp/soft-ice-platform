CREATE TABLE "BotRecipientBinding" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "externalSubjectHash" TEXT NOT NULL,
    "recipientCiphertext" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotRecipientBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BotRecipientBinding_customerId_channel_key"
    ON "BotRecipientBinding"("customerId", "channel");

CREATE UNIQUE INDEX "BotRecipientBinding_channel_externalSubjectHash_key"
    ON "BotRecipientBinding"("channel", "externalSubjectHash");

CREATE INDEX "BotRecipientBinding_status_lastSeenAt_idx"
    ON "BotRecipientBinding"("status", "lastSeenAt");

ALTER TABLE "BotRecipientBinding"
    ADD CONSTRAINT "BotRecipientBinding_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
