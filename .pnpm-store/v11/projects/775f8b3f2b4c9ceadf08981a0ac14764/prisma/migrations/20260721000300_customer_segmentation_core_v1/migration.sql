CREATE TYPE "SegmentType" AS ENUM ('MANUAL', 'SYSTEM');
CREATE TYPE "SegmentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "Segment" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "SegmentType" NOT NULL,
  "status" "SegmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SegmentRule" (
  "id" TEXT NOT NULL,
  "segmentId" TEXT NOT NULL,
  "ruleType" TEXT NOT NULL,
  "criteria" JSONB NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SegmentRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerSegment" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "segmentId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "reason" TEXT,
  "assignedBy" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unassignedAt" TIMESTAMP(3),
  CONSTRAINT "CustomerSegment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Segment_code_key" ON "Segment"("code");
CREATE INDEX "Segment_status_type_idx" ON "Segment"("status", "type");
CREATE INDEX "SegmentRule_segmentId_priority_idx" ON "SegmentRule"("segmentId", "priority");
CREATE INDEX "CustomerSegment_customerId_unassignedAt_assignedAt_idx" ON "CustomerSegment"("customerId", "unassignedAt", "assignedAt");
CREATE INDEX "CustomerSegment_segmentId_unassignedAt_assignedAt_idx" ON "CustomerSegment"("segmentId", "unassignedAt", "assignedAt");
CREATE UNIQUE INDEX "CustomerSegment_active_assignment_key" ON "CustomerSegment"("customerId", "segmentId") WHERE "unassignedAt" IS NULL;
ALTER TABLE "SegmentRule" ADD CONSTRAINT "SegmentRule_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerSegment" ADD CONSTRAINT "CustomerSegment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerSegment" ADD CONSTRAINT "CustomerSegment_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
