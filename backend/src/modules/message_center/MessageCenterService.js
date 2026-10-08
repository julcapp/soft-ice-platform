const { ApiError } = require('../../platform/errors/ApiError');
class MessageCenterService {
  constructor({ prisma }) { this.prisma = prisma; }
  async authorize(context) {
    if (context?.auth_method !== 'password' || !context?.subject_id) throw denied();
    const rows = await this.prisma.$queryRawUnsafe(`SELECT "roles" FROM "AdminUser" WHERE "id"::text=$1 AND "status"='ACTIVE'`, String(context.subject_id));
    if (!rows[0]?.roles?.some(role => ['PLATFORM_OWNER','ADMIN'].includes(role))) throw denied();
  }
  async list(filters, context) {
    await this.authorize(context);
    const limit = Math.min(Math.max(Number.parseInt(filters.limit,10) || 50,1),100);
    const offset = Math.min(Math.max(Number.parseInt(filters.offset,10) || 0,0),100000);
    const query = String(filters.query || '').trim().slice(0,200).replace(/^MSG-(\d+)$/i,'$1');
    const from = validDate(filters.from), to = validDate(filters.to);
    if (from && to && from > to) throw new ApiError({statusCode:422,code:'MESSAGE_DATE_INVALID',message:'Дата начала не должна быть позже даты окончания.'});
    const channel = String(filters.channel || '').toUpperCase(), status = String(filters.status || '').toUpperCase();
    const where = `($1='' OR m."number"::text=$1 OR m."id"=$1 OR POSITION(lower($1) IN lower(concat_ws(' ',m."recipientName",c."name",m."recipientId",m."subject",m."body")))>0) AND ($4='' OR (m."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tomsk')::date >= NULLIF($4,'')::date) AND ($5='' OR (m."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tomsk')::date <= NULLIF($5,'')::date) AND EXISTS (SELECT 1 FROM "ProjectMessageDelivery" d WHERE d."messageId"=m."id" AND ($2='' OR d."channel"=$2) AND ($3='' OR d."status"=$3))`;
    const rows = await this.prisma.$queryRawUnsafe(`SELECT m."id",'MSG-'||m."number"::text AS "number",m."subject",m."recipientType",COALESCE(m."recipientName",c."name",m."recipientId",'Не указан') AS "recipientName",m."recipientId",(SELECT array_agg(DISTINCT r."role"::text) FROM "OrganizationMember" om JOIN "OrganizationRoleAssignment" r ON r."memberId"=om."id" AND r."revokedAt" IS NULL WHERE om."platformUserId"=m."recipientId" AND om."status"='ACTIVE') AS "recipientRoles",m."source",m."createdAt",m."redacted",(SELECT jsonb_agg(jsonb_build_object('id',d."id",'channel',d."channel",'status',d."status",'sentAt',d."sentAt",'updatedAt',d."updatedAt") ORDER BY d."createdAt") FROM "ProjectMessageDelivery" d WHERE d."messageId"=m."id") AS deliveries FROM "ProjectMessage" m LEFT JOIN "Customer" c ON c."id"=m."recipientId" WHERE ${where} ORDER BY m."createdAt" DESC,m."number" DESC LIMIT $6 OFFSET $7`, query,channel,status,from,to,limit,offset);
    const counts = await this.prisma.$queryRawUnsafe(`SELECT count(*)::int AS total FROM "ProjectMessage" m LEFT JOIN "Customer" c ON c."id"=m."recipientId" WHERE ${where}`,query,channel,status,from,to);
    return { items: rows, total: counts[0]?.total || 0, limit, offset };
  }
  async get(id, context) {
    await this.authorize(context);
    const rows = await this.prisma.$queryRawUnsafe(`SELECT m.*,(SELECT array_agg(DISTINCT r."role"::text) FROM "OrganizationMember" om JOIN "OrganizationRoleAssignment" r ON r."memberId"=om."id" AND r."revokedAt" IS NULL WHERE om."platformUserId"=m."recipientId" AND om."status"='ACTIVE') AS "recipientRoles",m."number"::text AS "sequence",'MSG-'||m."number"::text AS "number",COALESCE(m."recipientName",c."name",m."recipientId",'Не указан') AS "recipientName" FROM "ProjectMessage" m LEFT JOIN "Customer" c ON c."id"=m."recipientId" WHERE m."id"=$1`, id);
    if (!rows[0]) throw new ApiError({statusCode:404,code:'MESSAGE_NOT_FOUND',message:'Сообщение не найдено.'});
    const deliveries = await this.prisma.$queryRawUnsafe(`SELECT * FROM "ProjectMessageDelivery" WHERE "messageId"=$1 ORDER BY "createdAt","id"`,id);
    const history = await this.prisma.$queryRawUnsafe(`SELECT h."id"::text,h."deliveryId",h."status",h."occurredAt",h."providerMessageId",h."failureCode",h."failureMessage" FROM "ProjectMessageDeliveryHistory" h JOIN "ProjectMessageDelivery" d ON d."id"=h."deliveryId" WHERE d."messageId"=$1 ORDER BY h."occurredAt",h."id"`,id);
    return { ...rows[0], deliveries, history };
  }
}
function validDate(value) {
  if (!value) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(value).getTime()) || new Date(value).toISOString().slice(0,10)!==value) throw new ApiError({statusCode:422,code:'MESSAGE_DATE_INVALID',message:'Укажите корректную дату.'});
  return value;
}
function denied() { return new ApiError({statusCode:403,code:'MESSAGE_CENTER_ACCESS_DENIED',message:'Центр сообщений доступен владельцу платформы и администратору.'}); }
module.exports = { MessageCenterService };
