CREATE TABLE "TerminalChannelChallenge" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "phoneFingerprint" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "externalUserIdHash" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "TerminalChannelChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TerminalChannelChallenge_tokenHash_key"
    ON "TerminalChannelChallenge"("tokenHash");

CREATE INDEX "TerminalChannelChallenge_status_expiresAt_idx"
    ON "TerminalChannelChallenge"("status", "expiresAt");

CREATE INDEX "TerminalChannelChallenge_phoneFingerprint_channel_status_idx"
    ON "TerminalChannelChallenge"("phoneFingerprint", "channel", "status");

CREATE INDEX "TerminalChannelChallenge_machineId_createdAt_idx"
    ON "TerminalChannelChallenge"("machineId", "createdAt");
