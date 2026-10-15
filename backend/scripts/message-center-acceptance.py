"""Isolated PostgreSQL acceptance; all schema and fixture changes roll back."""
import pathlib, subprocess, uuid, json
root=pathlib.Path(__file__).resolve().parents[1]
def acceptance_sql(migration):
    schema='message_center_acceptance_'+uuid.uuid4().hex
    prefix=f'''BEGIN;
CREATE SCHEMA "{schema}";
SET LOCAL search_path TO "{schema}";
CREATE TABLE "Customer" ("id" TEXT PRIMARY KEY,"name" TEXT);
CREATE TABLE "AdminUser" ("id" TEXT PRIMARY KEY,"roles" TEXT[],"status" TEXT);
CREATE TABLE "OrganizationMember" ("id" TEXT,"platformUserId" TEXT,"status" TEXT);
CREATE TABLE "OrganizationRoleAssignment" ("memberId" TEXT,"revokedAt" TIMESTAMP,"role" TEXT);
INSERT INTO "Customer" VALUES ('person','Тестовый Получатель');
INSERT INTO "AdminUser" VALUES ('owner',ARRAY['PLATFORM_OWNER'],'ACTIVE');
CREATE TABLE "CrmNotificationDelivery" ("id" TEXT,"customerId" TEXT,"channel" TEXT,"subject" TEXT,"body" TEXT,"status" TEXT,"providerId" TEXT,"failureReason" TEXT,"correlationId" TEXT,"createdBy" TEXT,"createdAt" TIMESTAMP,"sentAt" TIMESTAMP);
CREATE TABLE "CustomerNotification" ("id" TEXT,"customerId" TEXT,"title" TEXT,"body" TEXT,"createdAt" TIMESTAMP,"readAt" TIMESTAMP);
CREATE TABLE "NotificationDeliveryAttempt" ("id" TEXT,"notificationId" TEXT,"recipientCustomerId" TEXT,"channel" TEXT,"providerMessageId" TEXT,"status" TEXT,"attemptedAt" TIMESTAMP,"deliveredAt" TIMESTAMP,"openedAt" TIMESTAMP,"failedAt" TIMESTAMP,"failureCode" TEXT,"correlationId" TEXT);
INSERT INTO "CrmNotificationDelivery" VALUES ('c1','person','MAX','Тема','Тестовый текст','QUEUED',NULL,NULL,'corr','server','2026-10-08 04:00:00',NULL);
INSERT INTO "CustomerNotification" VALUES ('n1','person','Личный кабинет','Текст','2026-10-08 04:00:00',NULL);
INSERT INTO "NotificationDeliveryAttempt" VALUES ('g1','gift1','person','TELEGRAM','p1','SENT','2026-10-08 04:00:00',NULL,NULL,NULL,NULL,'corr');
'''
    suffix='''
DO $$ BEGIN
 IF (SELECT count(*) FROM "ProjectMessage")<>3 THEN RAISE EXCEPTION 'backfill count failed'; END IF;
 IF (SELECT "body" FROM "ProjectMessage" WHERE "id"='crm:c1')<>'Тестовый текст' THEN RAISE EXCEPTION 'body missing'; END IF;
 IF (SELECT "body" FROM "ProjectMessage" WHERE "id"='gift:gift1') IS NOT NULL THEN RAISE EXCEPTION 'historical text invented'; END IF;
END $$;
UPDATE "CrmNotificationDelivery" SET "status"='SENT',"providerId"='provider-77',"sentAt"='2026-10-08 04:01:00' WHERE "id"='c1';
UPDATE "CustomerNotification" SET "readAt"='2026-10-08 04:02:00' WHERE "id"='n1';
DO $$ BEGIN
 IF (SELECT "status" FROM "ProjectMessageDelivery" WHERE "id"='crm:c1')<>'SENT' THEN RAISE EXCEPTION 'status sync failed'; END IF;
 IF (SELECT "providerMessageId" FROM "ProjectMessageDelivery" WHERE "id"='crm:c1')<>'provider-77' THEN RAISE EXCEPTION 'provider identity lost'; END IF;
 IF (SELECT "deliveredAt" FROM "ProjectMessageDelivery" WHERE "id"='crm:c1') IS NOT NULL THEN RAISE EXCEPTION 'unconfirmed delivery invented'; END IF;
 IF (SELECT count(*) FROM "ProjectMessageDeliveryHistory" WHERE "deliveryId"='crm:c1')<>2 THEN RAISE EXCEPTION 'history lost'; END IF;
 IF (SELECT "status" FROM "ProjectMessageDelivery" WHERE "id"='inbox:n1')<>'READ' THEN RAISE EXCEPTION 'read status lost'; END IF;
END $$;
INSERT INTO "CrmNotificationDelivery" VALUES ('e1','person','MAX','Эскалация','Сообщение','QUEUED',NULL,NULL,'escalation1','operations-escalation',CURRENT_TIMESTAMP,NULL),('e2','person','TELEGRAM','Эскалация','Сообщение','QUEUED',NULL,NULL,'escalation1','operations-escalation',CURRENT_TIMESTAMP,NULL);
DO $$ BEGIN
 IF (SELECT count(*) FROM "ProjectMessage" WHERE "sourceId"='escalation1:person')<>1 THEN RAISE EXCEPTION 'multi channel message duplicated'; END IF;
 IF (SELECT count(*) FROM "ProjectMessageDelivery" WHERE "messageId"='crm:escalation1:person')<>2 THEN RAISE EXCEPTION 'channels lost'; END IF;
END $$;
UPDATE "NotificationDeliveryAttempt" SET "status"='DELIVERED',"deliveredAt"=CURRENT_TIMESTAMP WHERE "id"='g1';
DO $$ BEGIN
 IF (SELECT "status" FROM "ProjectMessageDelivery" WHERE "id"='legacy-gift:g1')<>'DELIVERED' THEN RAISE EXCEPTION 'gift confirmation lost'; END IF;
 IF (SELECT count(*) FROM "ProjectMessageDeliveryHistory" WHERE "deliveryId"='legacy-gift:g1')<>2 THEN RAISE EXCEPTION 'gift history lost'; END IF;
END $$;
ROLLBACK;
'''
    js = """const {MessageCenterService}=require(process.argv[1]);const calls=[];const prisma={$queryRawUnsafe:async(sql,...args)=>{calls.push([sql,args]);if(sql.includes('AdminUser'))return[{roles:['PLATFORM_OWNER']}];if(sql.includes('SELECT m.*'))return[{id:'crm:c1'}];return[];}};(async()=>{const service=new MessageCenterService({prisma});const context={auth_method:'password',subject_id:'owner'};await service.list({query:'MSG-1',channel:'MAX',from:'2026-10-08',to:'2026-10-08'},context);await service.get('crm:c1',context);process.stdout.write(JSON.stringify(calls));})().catch(()=>process.exit(1));"""
    calls=json.loads(subprocess.check_output(['node','-e',js,str(root/'src/modules/message_center/MessageCenterService.js')]))
    checks=''
    for index,(query,args) in enumerate(calls):
        values=','.join(str(value) if isinstance(value,(int,float)) else "'"+str(value).replace("'","''")+"'" for value in args)
        checks+=f'PREPARE mc_query_{index} AS {query}; EXECUTE mc_query_{index}({values}); DEALLOCATE mc_query_{index};\n'
    suffix=suffix.replace('ROLLBACK;',checks+'ROLLBACK;')
    return (prefix+migration.decode()+suffix).encode()
def main():
    migration=root/'prisma/migrations/20261008000100_message_center/migration.sql'
    user=subprocess.check_output(['docker','exec','utimoshi_postgres','printenv','POSTGRES_USER'],text=True).strip()
    result=subprocess.run(['docker','exec','-i','utimoshi_postgres','psql','-U',user,'-d','postgres','-v','ON_ERROR_STOP=1'],input=acceptance_sql(migration.read_bytes()),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:
        print(result.stderr.decode());raise SystemExit('FAIL: SQL acceptance failed; fixture transaction rolled back by disconnect.')
    print('PASS: backfill, channel grouping, status history and confirmed delivery tested in PostgreSQL. Fixtures rolled back.')
if __name__=='__main__':main()
