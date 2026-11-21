ALTER TYPE "OrganizationRoleType" ADD VALUE IF NOT EXISTS 'SELLER';
-- TimoPOS employee authentication; separate from Mini App customer identities.
-- Apply to staging after reviewing OrganizationMember/OrganizationLocation data.
CREATE TABLE "TimoPosTerminal" (
 "id" TEXT NOT NULL, "terminalId" TEXT NOT NULL, "pointId" TEXT NOT NULL,
 "active" BOOLEAN NOT NULL DEFAULT TRUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "TimoPosTerminal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TimoPosTerminal_terminalId_key" ON "TimoPosTerminal"("terminalId");
CREATE INDEX "TimoPosTerminal_pointId_active_idx" ON "TimoPosTerminal"("pointId","active");
CREATE TABLE "TimoPosSellerPoint" (
 "id" TEXT NOT NULL, "sellerId" TEXT NOT NULL, "pointId" TEXT NOT NULL,
 "active" BOOLEAN NOT NULL DEFAULT TRUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "TimoPosSellerPoint_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TimoPosSellerPoint_sellerId_pointId_key" ON "TimoPosSellerPoint"("sellerId","pointId");
CREATE INDEX "TimoPosSellerPoint_pointId_active_idx" ON "TimoPosSellerPoint"("pointId","active");
CREATE TABLE "TimoPosMaxIdentity" (
 "id" TEXT NOT NULL, "sellerId" TEXT NOT NULL, "maxSubjectHash" TEXT NOT NULL,
 "recipientCiphertext" TEXT NOT NULL, "verifiedPhoneHash" TEXT NOT NULL,
 "verifiedAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "TimoPosMaxIdentity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TimoPosMaxIdentity_sellerId_key" ON "TimoPosMaxIdentity"("sellerId");
CREATE UNIQUE INDEX "TimoPosMaxIdentity_maxSubjectHash_key" ON "TimoPosMaxIdentity"("maxSubjectHash");
CREATE TABLE "TimoPosLoginChallenge" (
 "id" TEXT NOT NULL, "sellerId" TEXT NOT NULL, "pointId" TEXT NOT NULL,
 "terminalId" TEXT NOT NULL, "codeHash" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
 "attempts" INTEGER NOT NULL DEFAULT 0, "maxAttempts" INTEGER NOT NULL DEFAULT 5,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL, "sentAt" TIMESTAMP(3), "consumedAt" TIMESTAMP(3),
 CONSTRAINT "TimoPosLoginChallenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TimoPosLoginChallenge_sellerId_status_expiresAt_idx"
 ON "TimoPosLoginChallenge"("sellerId","status","expiresAt");
CREATE INDEX "TimoPosLoginChallenge_terminalId_createdAt_idx"
 ON "TimoPosLoginChallenge"("terminalId","createdAt");
CREATE TABLE "TimoPosSellerSession" (
 "id" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "sellerId" TEXT NOT NULL,
 "pointId" TEXT NOT NULL, "terminalId" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
 "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "TimoPosSellerSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TimoPosSellerSession_tokenHash_key" ON "TimoPosSellerSession"("tokenHash");
CREATE INDEX "TimoPosSellerSession_sellerId_revokedAt_idx" ON "TimoPosSellerSession"("sellerId","revokedAt");
CREATE INDEX "TimoPosSellerSession_terminalId_expiresAt_idx" ON "TimoPosSellerSession"("terminalId","expiresAt");
