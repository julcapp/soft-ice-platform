CREATE TABLE "AdminOperationsEscalation" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "recipientSubject" TEXT NOT NULL,
    "recipientDisplayName" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "AdminOperationsEscalation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AdminOperationsEscalation_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "AdminOperationsWorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AdminOperationsEscalation_workItemId_level_key"
ON "AdminOperationsEscalation"("workItemId", "level");

CREATE INDEX "AdminOperationsEscalation_status_level_createdAt_idx"
ON "AdminOperationsEscalation"("status", "level", "createdAt");

CREATE INDEX "AdminOperationsEscalation_recipientSubject_status_idx"
ON "AdminOperationsEscalation"("recipientSubject", "status");
