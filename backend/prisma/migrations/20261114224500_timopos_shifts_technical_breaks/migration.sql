-- TimoPOS shifts and technical break accounting; migration is NOT applied to production.
CREATE TABLE "TimoPosShift" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "pointId" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "startedBySeller" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  "closedBySeller" BOOLEAN NOT NULL DEFAULT false,
  "summary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimoPosShift_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TimoPosShift_sellerId_startedAt_idx" ON "TimoPosShift"("sellerId","startedAt");
CREATE INDEX "TimoPosShift_pointId_startedAt_idx" ON "TimoPosShift"("pointId","startedAt");
CREATE INDEX "TimoPosShift_terminalId_status_idx" ON "TimoPosShift"("terminalId","status");
CREATE UNIQUE INDEX "TimoPosShift_one_open_per_terminal" ON "TimoPosShift"("terminalId") WHERE "status" = 'OPEN';

CREATE TABLE "TimoPosTechnicalBreak" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "pointId" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "reason" TEXT NOT NULL DEFAULT 'TECHNICAL',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimoPosTechnicalBreak_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TimoPosTechnicalBreak" ADD CONSTRAINT "TimoPosTechnicalBreak_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "TimoPosShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "TimoPosTechnicalBreak_shiftId_startedAt_idx" ON "TimoPosTechnicalBreak"("shiftId","startedAt");
CREATE INDEX "TimoPosTechnicalBreak_pointId_status_idx" ON "TimoPosTechnicalBreak"("pointId","status");
CREATE INDEX "TimoPosTechnicalBreak_sellerId_startedAt_idx" ON "TimoPosTechnicalBreak"("sellerId","startedAt");
CREATE UNIQUE INDEX "TimoPosTechnicalBreak_one_active_per_shift" ON "TimoPosTechnicalBreak"("shiftId") WHERE "status" = 'ACTIVE';
