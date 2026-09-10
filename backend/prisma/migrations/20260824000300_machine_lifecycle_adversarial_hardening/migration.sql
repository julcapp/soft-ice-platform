ALTER TABLE "MachineCallbackInbox"
  ADD COLUMN "processingStartedAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3),
  ADD COLUMN "processingLeaseVersion" INTEGER NOT NULL DEFAULT 0;

UPDATE "MachineCallbackInbox"
SET "processingStartedAt" = COALESCE("processingLockedAt", "processedAt", "receivedAt")
WHERE "status" IN ('PROCESSING', 'PROCESSED', 'FAILED');

UPDATE "MachineCallbackInbox"
SET "failedAt" = COALESCE("processedAt", "processingStartedAt", "receivedAt")
WHERE "status" = 'FAILED';

ALTER TABLE "MachineCallbackInbox"
  ADD CONSTRAINT "MachineCallbackInbox_processing_temporal_check" CHECK (
    ("status" <> 'PROCESSING' OR ("processingStartedAt" IS NOT NULL AND "processingLockedAt" IS NOT NULL AND "processingLockedBy" IS NOT NULL)) AND
    ("status" <> 'PROCESSED' OR ("processingStartedAt" IS NOT NULL AND "processedAt" IS NOT NULL)) AND
    ("status" <> 'FAILED' OR ("processingStartedAt" IS NOT NULL AND "failedAt" IS NOT NULL))
  );

ALTER TABLE "MachineDispenseAttempt"
  ADD CONSTRAINT "MachineDispenseAttempt_command_temporal_check" CHECK (
    ("status" <> 'SENT' OR "sentAt" IS NOT NULL) AND
    ("status" <> 'ACCEPTED' OR ("sentAt" IS NOT NULL AND "acceptedAt" IS NOT NULL)) AND
    ("status" <> 'DISPENSING' OR ("sentAt" IS NOT NULL AND "acceptedAt" IS NOT NULL AND "startedAt" IS NOT NULL)) AND
    ("status" <> 'DISPENSED' OR ("sentAt" IS NOT NULL AND "acceptedAt" IS NOT NULL AND "startedAt" IS NOT NULL AND "completedAt" IS NOT NULL)) AND
    ("status" <> 'FAILED' OR "failedAt" IS NOT NULL) AND
    ("status" <> 'TIMED_OUT' OR "timedOutAt" IS NOT NULL)
  );

ALTER TABLE "MachineReconciliation"
  ADD CONSTRAINT "MachineReconciliation_resolution_temporal_check" CHECK (
    "status" <> 'RESOLVED' OR "resolvedAt" IS NOT NULL
  );
