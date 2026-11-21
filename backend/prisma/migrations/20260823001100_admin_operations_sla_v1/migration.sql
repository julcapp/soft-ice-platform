ALTER TABLE "AdminOperationsWorkItem"
ADD COLUMN "slaPolicyCode" TEXT,
ADD COLUMN "ackDueAt" TIMESTAMP(3),
ADD COLUMN "resolveDueAt" TIMESTAMP(3),
ADD COLUMN "ackBreachedAt" TIMESTAMP(3),
ADD COLUMN "resolveBreachedAt" TIMESTAMP(3),
ADD COLUMN "escalationLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "escalatedAt" TIMESTAMP(3);

CREATE INDEX "AdminOperationsWorkItem_sla_ack_idx"
ON "AdminOperationsWorkItem"("status", "ackDueAt");
CREATE INDEX "AdminOperationsWorkItem_sla_resolve_idx"
ON "AdminOperationsWorkItem"("status", "resolveDueAt");
CREATE INDEX "AdminOperationsWorkItem_escalation_idx"
ON "AdminOperationsWorkItem"("escalationLevel", "escalatedAt");
