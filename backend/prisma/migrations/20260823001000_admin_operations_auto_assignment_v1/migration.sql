ALTER TABLE "AdminOperationsWorkItem"
ADD COLUMN "sourceReferenceId" TEXT,
ADD COLUMN "assigneeDisplayName" TEXT,
ADD COLUMN "assignmentMode" TEXT,
ADD COLUMN "assignmentReason" TEXT;

CREATE INDEX "AdminOperationsWorkItem_source_sourceReferenceId_idx"
ON "AdminOperationsWorkItem"("source", "sourceReferenceId");
