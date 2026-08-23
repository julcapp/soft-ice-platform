CREATE TABLE "AdminOperationsWorkItem" (
    "id" TEXT NOT NULL,
    "notificationKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "deepLink" TEXT,
    "sourceActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "lastSourceSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assigneeSubject" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminOperationsWorkItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminOperationsWorkItem_notificationKey_key"
ON "AdminOperationsWorkItem"("notificationKey");
CREATE INDEX "AdminOperationsWorkItem_status_assigneeSubject_idx"
ON "AdminOperationsWorkItem"("status", "assigneeSubject");
CREATE INDEX "AdminOperationsWorkItem_category_severity_status_idx"
ON "AdminOperationsWorkItem"("category", "severity", "status");
CREATE INDEX "AdminOperationsWorkItem_sourceActive_lastSourceSeenAt_idx"
ON "AdminOperationsWorkItem"("sourceActive", "lastSourceSeenAt");

CREATE TABLE "AdminOperationsWorkEvent" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorSubject" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "assigneeSubject" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminOperationsWorkEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AdminOperationsWorkEvent_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "AdminOperationsWorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AdminOperationsWorkEvent_workItemId_createdAt_idx"
ON "AdminOperationsWorkEvent"("workItemId", "createdAt");
