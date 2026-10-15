const { randomUUID } = require('node:crypto');
const STATUSES = new Set(['QUEUED','SENDING','SENT','DELIVERED','READ','FAILED','UNAVAILABLE','BLOCKED','ACCEPTED','AVAILABLE','UNKNOWN']);
class MessageJournal {
  constructor({ prisma, clock = () => new Date() }) { this.prisma = prisma; this.clock = clock; }
  async begin(input) {
    const sourceId = input.sourceId || randomUUID();
    return this.prisma.$transaction(async (db) => {
      let recipientId = input.recipientId || null, recipientName = input.recipientName || null, recipientType = input.recipientType || 'PARTICIPANT';
      if (input.source === 'BOT' && input.recipientAddress) {
        const profiles = await db.$queryRawUnsafe(`SELECT "customerId" FROM "CustomerExternalProfile" WHERE "externalUserId"=$1 AND upper("channelType")=$2 AND "isVerified"=TRUE ORDER BY "updatedAt" DESC LIMIT 1`, String(input.recipientAddress), String(input.channel).toUpperCase());
        let customerId = profiles[0]?.customerId;
        if (!customerId && String(input.channel).toUpperCase()==='TELEGRAM') {
          const customers = await db.$queryRawUnsafe(`SELECT "id" FROM "Customer" WHERE "telegramId"::text=$1 LIMIT 1`, String(input.recipientAddress)); customerId=customers[0]?.id;
        }
        if (customerId) { recipientId=customerId; recipientType='CUSTOMER'; }
      }
      if (input.source === 'SECURITY' && input.recipientAddress) {
        const users = await db.$queryRawUnsafe(`SELECT "id"::text AS "recipientId","displayName" FROM "AdminUser" WHERE "status"='ACTIVE' AND (($2='MAX' AND "maxUserId"=$1) OR ($2='EMAIL' AND lower("email")=lower($1))) LIMIT 1`, String(input.recipientAddress), String(input.channel).toUpperCase());
        if (users[0]?.recipientId) { recipientId=users[0].recipientId; recipientName=users[0].displayName; }
      }
      const rows = await db.$queryRawUnsafe(`INSERT INTO "ProjectMessage" ("id","source","sourceId","recipientType","recipientId","recipientName","subject","body","sender","correlationId","redacted","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT ("source","sourceId") DO UPDATE SET "body"=COALESCE("ProjectMessage"."body",EXCLUDED."body") RETURNING "id"`, randomUUID(), input.source, sourceId, recipientType, recipientId, recipientName, input.subject || null, input.redacted ? 'Код подтверждения скрыт.' : input.body ?? null, input.sender || 'Сервер', input.correlationId || null, Boolean(input.redacted), this.clock());
      const deliveryId = randomUUID();
      await db.$executeRawUnsafe(`INSERT INTO "ProjectMessageDelivery" ("id","messageId","channel","recipientAddress","status","createdAt","updatedAt") VALUES ($1,$2,$3,$4,'SENDING',$5,$5)`, deliveryId, rows[0].id, String(input.channel).toUpperCase(), input.recipientAddress || null, this.clock());
      return deliveryId;
    });
  }
  async finish(id, result) {
    const status = STATUSES.has(result.status) ? result.status : 'UNKNOWN';
    await this.prisma.$executeRawUnsafe(`UPDATE "ProjectMessageDelivery" SET "status"=$2,"providerMessageId"=$3,"failureCode"=$4,"failureMessage"=$5,"sentAt"=CASE WHEN $2 IN ('SENT','DELIVERED','READ') THEN COALESCE("sentAt",$6) ELSE "sentAt" END,"deliveredAt"=CASE WHEN $2='DELIVERED' THEN $6 ELSE "deliveredAt" END,"updatedAt"=$6 WHERE "id"=$1`, id, status, result.providerMessageId == null ? null : String(result.providerMessageId), safeCode(result.failureCode), result.failureCode ? 'Отправка не выполнена. См. код причины.' : null, this.clock());
  }
  async track(input, operation, interpret = providerResult) {
    const id = await this.begin(input); // Persist intent before contacting a provider.
    let result;
    try { result = await operation(); }
    catch (error) { await this.finish(id, { status: 'FAILED', failureCode: error.code || 'SEND_FAILED' }); throw error; }
    try { await this.finish(id, interpret(result)); }
    catch { console.error('MESSAGE_JOURNAL_RESULT_NOT_RECORDED', id); } // Never repeat an accepted send because its journal update failed.
    return result;
  }
}
function safeCode(value) { return value ? String(value).replace(/[^a-zA-Z0-9_.:-]/g,'_').slice(0,120) : null; }
function providerResult(result) {
  if (result?.sent === false) return { status: 'UNAVAILABLE', failureCode: result.reason || 'CHANNEL_UNAVAILABLE' };
  return { status: 'SENT', providerMessageId: result?.message_id ?? result?.message?.body?.mid ?? result?.message?.mid ?? result?.mid ?? null };
}
let journal;
function defaultMessageJournal() {
  if (process.env.MESSAGE_CENTER_ENABLED !== 'true') return null;
  if (!journal) journal = new MessageJournal({ prisma: require('../../common/database/prismaClient').getPrismaClient() });
  return journal;
}
module.exports = { MessageJournal, defaultMessageJournal, providerResult };
