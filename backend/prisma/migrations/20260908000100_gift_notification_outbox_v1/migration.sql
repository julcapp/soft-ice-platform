ALTER TABLE "TransactionalOutboxEvent"
    ALTER COLUMN "organizationId" DROP NOT NULL;

COMMENT ON COLUMN "TransactionalOutboxEvent"."organizationId" IS
    'Required for tenant events; NULL is allowed only for explicitly allow-listed platform event types.';
