-- MVP vertical slice 001: Telegram customer registration, Auth Core sessions and Club Account creation.

ALTER TABLE "Customer" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "name" DROP NOT NULL;

CREATE TABLE "CustomerIdentity" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalSubjectHash" TEXT NOT NULL,
    "externalUsername" TEXT,
    "displayName" TEXT,
    "verificationMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sourceChannel" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "authMethod" TEXT NOT NULL,
    "consumerType" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "actorContext" JSONB,
    "semanticHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resultReference" TEXT,
    "correlationId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "action" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reasonCode" TEXT,
    "authMethod" TEXT,
    "sourceChannel" TEXT,
    "correlationId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerIdentity_provider_externalSubjectHash_key"
    ON "CustomerIdentity"("provider", "externalSubjectHash");

CREATE UNIQUE INDEX "AuthSession_accessTokenHash_key"
    ON "AuthSession"("accessTokenHash");

CREATE UNIQUE INDEX "IdempotencyRecord_scope_key_key"
    ON "IdempotencyRecord"("scope", "key");

CREATE INDEX "AuthSession_customerId_idx" ON "AuthSession"("customerId");
CREATE INDEX "AuditEvent_correlationId_idx" ON "AuditEvent"("correlationId");
CREATE INDEX "AuditEvent_subjectType_subjectId_idx" ON "AuditEvent"("subjectType", "subjectId");

ALTER TABLE "CustomerIdentity"
    ADD CONSTRAINT "CustomerIdentity_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuthSession"
    ADD CONSTRAINT "AuthSession_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
