-- MVP vertical slice 004: Machine integration foundation and dispense request flow.

CREATE TYPE "MachineStatus" AS ENUM (
    'ONLINE',
    'OFFLINE',
    'MAINTENANCE',
    'ERROR'
);

CREATE TYPE "DispenseRequestState" AS ENUM (
    'REQUESTED',
    'STARTED',
    'COMPLETED',
    'FAILED'
);

ALTER TABLE "Machine"
    ADD COLUMN "machineCode" TEXT;

UPDATE "Machine"
SET "machineCode" = CONCAT('machine_', "id")
WHERE "machineCode" IS NULL;

ALTER TABLE "Machine"
    ALTER COLUMN "machineCode" SET NOT NULL,
    ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Machine"
    ALTER COLUMN "status" TYPE "MachineStatus"
    USING (
        CASE
            WHEN UPPER("status") = 'ONLINE' THEN 'ONLINE'::"MachineStatus"
            WHEN UPPER("status") = 'OFFLINE' THEN 'OFFLINE'::"MachineStatus"
            WHEN UPPER("status") = 'MAINTENANCE' THEN 'MAINTENANCE'::"MachineStatus"
            WHEN UPPER("status") = 'ERROR' THEN 'ERROR'::"MachineStatus"
            ELSE 'OFFLINE'::"MachineStatus"
        END
    );

ALTER TABLE "Machine"
    ALTER COLUMN "status" SET DEFAULT 'OFFLINE'::"MachineStatus",
    DROP COLUMN "currentFlavor",
    DROP COLUMN "cupsCapacity";

CREATE UNIQUE INDEX "Machine_machineCode_key" ON "Machine"("machineCode");

CREATE TABLE "DispenseRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "state" "DispenseRequestState" NOT NULL DEFAULT 'REQUESTED',
    "commandId" TEXT NOT NULL,
    "commandType" TEXT NOT NULL DEFAULT 'DispenseCommand',
    "commandPayload" JSONB NOT NULL,
    "failureReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispenseRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DispenseRequest_orderId_key" ON "DispenseRequest"("orderId");
CREATE UNIQUE INDEX "DispenseRequest_commandId_key" ON "DispenseRequest"("commandId");
CREATE INDEX "DispenseRequest_machineId_state_idx" ON "DispenseRequest"("machineId", "state");
CREATE INDEX "DispenseRequest_state_createdAt_idx" ON "DispenseRequest"("state", "createdAt");

ALTER TABLE "DispenseRequest"
    ADD CONSTRAINT "DispenseRequest_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DispenseRequest"
    ADD CONSTRAINT "DispenseRequest_machineId_fkey"
    FOREIGN KEY ("machineId") REFERENCES "Machine"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
