CREATE TABLE "ProjectMessage" (
 "id" TEXT PRIMARY KEY, "number" BIGSERIAL UNIQUE NOT NULL,
 "source" TEXT NOT NULL, "sourceId" TEXT NOT NULL,
 "recipientType" TEXT NOT NULL, "recipientId" TEXT, "recipientName" TEXT,
 "subject" TEXT, "body" TEXT, "sender" TEXT NOT NULL DEFAULT 'Сервер',
 "correlationId" TEXT, "redacted" BOOLEAN NOT NULL DEFAULT FALSE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("source","sourceId")
);
CREATE INDEX "ProjectMessage_created_idx" ON "ProjectMessage" ("createdAt" DESC,"number" DESC);
CREATE TABLE "ProjectMessageDelivery" (
 "id" TEXT PRIMARY KEY, "messageId" TEXT NOT NULL REFERENCES "ProjectMessage"("id"),
 "channel" TEXT NOT NULL, "recipientAddress" TEXT, "status" TEXT NOT NULL,
 "providerMessageId" TEXT, "failureCode" TEXT, "failureMessage" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "sentAt" TIMESTAMP(3), "deliveredAt" TIMESTAMP(3), "readAt" TIMESTAMP(3)
);
CREATE INDEX "ProjectMessageDelivery_message_idx" ON "ProjectMessageDelivery"("messageId");
CREATE INDEX "ProjectMessageDelivery_status_channel_idx" ON "ProjectMessageDelivery"("status","channel");
CREATE TABLE "ProjectMessageDeliveryHistory" (
 "id" BIGSERIAL PRIMARY KEY, "deliveryId" TEXT NOT NULL REFERENCES "ProjectMessageDelivery"("id"),
 "status" TEXT NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL,
 "providerMessageId" TEXT, "failureCode" TEXT, "failureMessage" TEXT
);
CREATE INDEX "ProjectMessageHistory_delivery_idx" ON "ProjectMessageDeliveryHistory"("deliveryId","occurredAt");
CREATE FUNCTION project_message_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR (OLD."status",OLD."providerMessageId",OLD."failureCode") IS DISTINCT FROM (NEW."status",NEW."providerMessageId",NEW."failureCode") THEN
  INSERT INTO "ProjectMessageDeliveryHistory"("deliveryId","status","occurredAt","providerMessageId","failureCode","failureMessage") VALUES(NEW."id",NEW."status",NEW."updatedAt",NEW."providerMessageId",NEW."failureCode",NEW."failureMessage");
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER project_message_history AFTER INSERT OR UPDATE ON "ProjectMessageDelivery" FOR EACH ROW EXECUTE FUNCTION project_message_history();

CREATE FUNCTION project_message_import_crm(j JSONB) RETURNS void LANGUAGE plpgsql AS $$
DECLARE mid TEXT; sid TEXT; team BOOLEAN;
BEGIN
 team := j->>'createdBy'='operations-escalation';
 sid := CASE WHEN team THEN COALESCE(j->>'correlationId',j->>'id')||':'||(j->>'customerId') ELSE j->>'id' END;
 mid := 'crm:'||sid;
 INSERT INTO "ProjectMessage"("id","source","sourceId","recipientType","recipientId","subject","body","sender","correlationId","createdAt") VALUES(mid,'CRM',sid,CASE WHEN team THEN 'TEAM' ELSE 'CUSTOMER' END,j->>'customerId',j->>'subject',j->>'body',COALESCE(j->>'createdBy','Сервер'),j->>'correlationId',(j->>'createdAt')::timestamp)
 ON CONFLICT("source","sourceId") DO NOTHING;
 INSERT INTO "ProjectMessageDelivery"("id","messageId","channel","status","providerMessageId","failureMessage","createdAt","updatedAt","sentAt") VALUES('crm:'||(j->>'id'),mid,upper(j->>'channel'),j->>'status',j->>'providerId',j->>'failureReason',(j->>'createdAt')::timestamp,COALESCE((j->>'sentAt')::timestamp,CURRENT_TIMESTAMP),(j->>'sentAt')::timestamp)
 ON CONFLICT("id") DO UPDATE SET "status"=EXCLUDED."status","providerMessageId"=EXCLUDED."providerMessageId","failureMessage"=EXCLUDED."failureMessage","sentAt"=EXCLUDED."sentAt","updatedAt"=CURRENT_TIMESTAMP;
END $$;
CREATE FUNCTION project_message_crm_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM project_message_import_crm(to_jsonb(NEW)); RETURN NEW; END $$;
CREATE TRIGGER project_message_crm AFTER INSERT OR UPDATE ON "CrmNotificationDelivery" FOR EACH ROW EXECUTE FUNCTION project_message_crm_trigger();
SELECT project_message_import_crm(to_jsonb(c)) FROM "CrmNotificationDelivery" c;

CREATE FUNCTION project_message_import_inbox(j JSONB) RETURNS void LANGUAGE plpgsql AS $$
DECLARE mid TEXT := 'inbox:'||(j->>'id');
BEGIN
 INSERT INTO "ProjectMessage"("id","source","sourceId","recipientType","recipientId","subject","body","createdAt") VALUES(mid,'INBOX',j->>'id','CUSTOMER',j->>'customerId',j->>'title',j->>'body',(j->>'createdAt')::timestamp) ON CONFLICT("source","sourceId") DO NOTHING;
 INSERT INTO "ProjectMessageDelivery"("id","messageId","channel","status","createdAt","updatedAt","readAt") VALUES(mid,mid,'MINI_APP',CASE WHEN j->>'readAt' IS NULL THEN 'AVAILABLE' ELSE 'READ' END,(j->>'createdAt')::timestamp,COALESCE((j->>'readAt')::timestamp,(j->>'createdAt')::timestamp),(j->>'readAt')::timestamp)
 ON CONFLICT("id") DO UPDATE SET "status"=EXCLUDED."status","readAt"=EXCLUDED."readAt","updatedAt"=CURRENT_TIMESTAMP;
END $$;
CREATE FUNCTION project_message_inbox_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM project_message_import_inbox(to_jsonb(NEW)); RETURN NEW; END $$;
DO $$ BEGIN
 IF to_regclass('"CustomerNotification"') IS NOT NULL THEN
  EXECUTE 'CREATE TRIGGER project_message_inbox AFTER INSERT OR UPDATE ON "CustomerNotification" FOR EACH ROW EXECUTE FUNCTION project_message_inbox_trigger()';
  PERFORM project_message_import_inbox(to_jsonb(n)) FROM "CustomerNotification" n;
 END IF;
END $$;
-- Old gift delivery records have no original message text. Preserve that absence.
CREATE FUNCTION project_message_import_old_gift(j JSONB) RETURNS void LANGUAGE plpgsql AS $$
DECLARE mid TEXT := 'gift:'||(j->>'notificationId');
BEGIN
 INSERT INTO "ProjectMessage"("id","source","sourceId","recipientType","recipientId","subject","body","correlationId","createdAt") VALUES(mid,'GIFT',j->>'notificationId','CUSTOMER',j->>'recipientCustomerId','Уведомление о подарке',NULL,j->>'correlationId',(j->>'attemptedAt')::timestamp) ON CONFLICT("source","sourceId") DO NOTHING;
 INSERT INTO "ProjectMessageDelivery"("id","messageId","channel","status","providerMessageId","failureCode","createdAt","updatedAt","deliveredAt","readAt") VALUES('legacy-gift:'||(j->>'id'),mid,upper(j->>'channel'),j->>'status',j->>'providerMessageId',j->>'failureCode',(j->>'attemptedAt')::timestamp,(j->>'attemptedAt')::timestamp,(j->>'deliveredAt')::timestamp,(j->>'openedAt')::timestamp) ON CONFLICT("id") DO NOTHING;
END $$;
DO $$ BEGIN
 IF to_regclass('"NotificationDeliveryAttempt"') IS NOT NULL THEN PERFORM project_message_import_old_gift(to_jsonb(n)) FROM "NotificationDeliveryAttempt" n; END IF;
END $$;
-- Keep the fallback registry current even for a worker without the feature flag.
CREATE FUNCTION project_message_gift_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE did TEXT;
BEGIN
 SELECT d."id" INTO did FROM "ProjectMessageDelivery" d JOIN "ProjectMessage" m ON m."id"=d."messageId"
 WHERE m."source"='GIFT' AND m."sourceId"=NEW."notificationId" AND d."channel"=upper(NEW."channel")
 AND d."id" NOT LIKE 'legacy-gift:%' AND (d."providerMessageId" IS NOT DISTINCT FROM NEW."providerMessageId") ORDER BY d."createdAt" DESC LIMIT 1;
 IF did IS NOT NULL THEN
  UPDATE "ProjectMessageDelivery" SET "status"=NEW."status","deliveredAt"=COALESCE(NEW."deliveredAt","deliveredAt"),"readAt"=COALESCE(NEW."openedAt","readAt"),"failureCode"=COALESCE(NEW."failureCode","failureCode"),"updatedAt"=GREATEST("updatedAt",NEW."attemptedAt") WHERE "id"=did;
 ELSE
  PERFORM project_message_import_old_gift(to_jsonb(NEW));
  UPDATE "ProjectMessageDelivery" SET "status"=NEW."status","providerMessageId"=NEW."providerMessageId","failureCode"=NEW."failureCode","deliveredAt"=NEW."deliveredAt","readAt"=NEW."openedAt","updatedAt"=NEW."attemptedAt" WHERE "id"='legacy-gift:'||NEW."id";
 END IF;
 RETURN NEW;
END $$;
DO $$ BEGIN
 IF to_regclass('"NotificationDeliveryAttempt"') IS NOT NULL THEN EXECUTE 'CREATE TRIGGER project_message_gift AFTER INSERT OR UPDATE ON "NotificationDeliveryAttempt" FOR EACH ROW EXECUTE FUNCTION project_message_gift_trigger()'; END IF;
END $$;
