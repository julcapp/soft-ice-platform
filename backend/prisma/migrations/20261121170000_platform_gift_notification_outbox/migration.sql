-- Allow organization-less gift notification events; tenant-scoped events remain validated by API.
ALTER TABLE "TransactionalOutboxEvent" ALTER COLUMN "organizationId" DROP NOT NULL;
