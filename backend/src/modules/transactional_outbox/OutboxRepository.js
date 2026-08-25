const crypto = require('crypto');

const CLAIMABLE = ['PENDING', 'RETRY'];
const SECRET_FIELDS = new Set([
  'password', 'passwd', 'token', 'accesstoken', 'refreshtoken', 'secret',
  'clientsecret', 'apikey', 'apitoken', 'authorization', 'cookie', 'credential',
  'credentials', 'paymentcredential', 'paymentcredentials', 'rtspcredential',
  'rtspcredentials', 'simcredential', 'simcredentials', 'cvv', 'cvc',
  'cardnumber', 'paymentcard',
]);

class PrismaOutboxRepository {
  constructor(prisma) { this.prisma = prisma; this.persistenceMode = 'POSTGRESQL'; }
  createEvent(event) { validateEvent(event); return this.prisma.transactionalOutboxEvent.create({ data: normalize(event) }); }
  getByEventId(eventId, scope = {}) { return this.prisma.transactionalOutboxEvent.findFirst({ where: { eventId, ...tenantWhere(scope) } }); }
  getPendingCount(scope = {}) { return this.prisma.transactionalOutboxEvent.count({ where: { status: { in: ['PENDING', 'RETRY'] }, ...tenantWhere(scope) } }); }
  list(filters = {}, scope = {}) {
    const where = { ...tenantWhere(scope) };
    for (const key of ['status', 'eventType', 'organizationId', 'machineId']) if (filters[key]) where[key] = filters[key];
    if (filters.dateFrom || filters.dateTo) where.createdAt = { ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }), ...(filters.dateTo && { lte: new Date(filters.dateTo) }) };
    return this.prisma.transactionalOutboxEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(Number(filters.limit) || 100, 500) });
  }
  async counts(scope = {}) {
    const rows = await this.prisma.transactionalOutboxEvent.groupBy({ by: ['status'], where: tenantWhere(scope), _count: { _all: true } });
    return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
  }
  async claimPendingEvents({ workerId, batchSize = 50, now = new Date(), organizationId, eventTypes } = {}) {
    if (!workerId) throw invalid('workerId обязателен.');
    const types = Array.isArray(eventTypes) && eventTypes.length ? eventTypes : null;
    const tenantClause = organizationId ? this.prisma.$queryRaw`
      WITH candidates AS (
        SELECT "id" FROM "TransactionalOutboxEvent"
        WHERE "status" IN ('PENDING','RETRY') AND "availableAt" <= ${now} AND "organizationId" = ${organizationId}
          AND (${types}::text[] IS NULL OR "eventType" = ANY(${types}::text[]))
        ORDER BY "availableAt", "createdAt" FOR UPDATE SKIP LOCKED LIMIT ${batchSize}
      )
      UPDATE "TransactionalOutboxEvent" e SET "status"='PROCESSING', "lockedAt"=${now}, "lockedBy"=${workerId}, "updatedAt"=${now}
      FROM candidates WHERE e."id"=candidates."id" RETURNING e.*` : this.prisma.$queryRaw`
      WITH candidates AS (
        SELECT "id" FROM "TransactionalOutboxEvent"
        WHERE "status" IN ('PENDING','RETRY') AND "availableAt" <= ${now}
          AND (${types}::text[] IS NULL OR "eventType" = ANY(${types}::text[]))
        ORDER BY "availableAt", "createdAt" FOR UPDATE SKIP LOCKED LIMIT ${batchSize}
      )
      UPDATE "TransactionalOutboxEvent" e SET "status"='PROCESSING', "lockedAt"=${now}, "lockedBy"=${workerId}, "updatedAt"=${now}
      FROM candidates WHERE e."id"=candidates."id" RETURNING e.*`;
    return tenantClause;
  }
  markPublished(eventId, workerId, now = new Date()) { return this.transition(eventId, workerId, { status: 'PUBLISHED', publishedAt: now, lockedAt: null, lockedBy: null, lastError: null, attemptCount: { increment: 1 } }); }
  scheduleRetry(eventId, workerId, { availableAt, error }) { return this.transition(eventId, workerId, { status: 'RETRY', availableAt, lastError: safeError(error), lockedAt: null, lockedBy: null, attemptCount: { increment: 1 } }); }
  markDeadLetter(eventId, workerId, error) { return this.transition(eventId, workerId, { status: 'DEAD_LETTER', lastError: safeError(error), lockedAt: null, lockedBy: null, attemptCount: { increment: 1 } }); }
  async transition(eventId, workerId, data) {
    const result = await this.prisma.transactionalOutboxEvent.updateMany({ where: { eventId, status: 'PROCESSING', lockedBy: workerId }, data });
    if (result.count !== 1) throw conflict('OUTBOX_LEASE_LOST', 'Outbox lock потерян или событие уже обработано.');
    return this.getByEventId(eventId, { platform: true });
  }
  async releaseExpiredLocks({ before, now = new Date() }) {
    return this.prisma.transactionalOutboxEvent.updateMany({ where: { status: 'PROCESSING', lockedAt: { lt: before } }, data: { status: 'RETRY', availableAt: now, lockedAt: null, lockedBy: null, lastError: 'WORKER_LEASE_EXPIRED' } });
  }
  async retryDeadLetter(eventId, scope = {}) {
    const result = await this.prisma.transactionalOutboxEvent.updateMany({ where: { eventId, status: 'DEAD_LETTER', ...tenantWhere(scope) }, data: { status: 'RETRY', availableAt: new Date(), lockedAt: null, lockedBy: null, lastError: null } });
    if (result.count !== 1) throw conflict('OUTBOX_RETRY_NOT_ALLOWED', 'Повтор разрешён только для доступного DEAD_LETTER события.');
    return this.getByEventId(eventId, scope);
  }
}

class InMemoryOutboxRepository {
  constructor(store = new Map()) { this.store = store; this.persistenceMode = 'IN_MEMORY_TEST'; }
  async createEvent(event) { validateEvent(event); if ([...this.store.values()].some((x) => x.eventId === event.eventId || x.idempotencyKey === event.idempotencyKey)) throw Object.assign(new Error('Duplicate outbox event.'), { code: 'P2002' }); const row = { id: crypto.randomUUID(), status: 'PENDING', attemptCount: 0, maxAttempts: 5, availableAt: new Date(), createdAt: new Date(), updatedAt: new Date(), lockedAt: null, lockedBy: null, publishedAt: null, lastError: null, ...normalize(event) }; this.store.set(row.eventId, row); return row; }
  async getByEventId(id, scope = {}) { const row = this.store.get(id); return row && allowed(row, scope) ? row : null; }
  async getPendingCount(scope = {}) { return [...this.store.values()].filter((x) => allowed(x, scope) && CLAIMABLE.includes(x.status)).length; }
  async list(filters = {}, scope = {}) { return [...this.store.values()].filter((x) => allowed(x, scope) && ['status','eventType','organizationId','machineId'].every((k) => !filters[k] || x[k] === filters[k])); }
  async counts(scope = {}) { return [...this.store.values()].filter((x) => allowed(x, scope)).reduce((a,x) => ({ ...a, [x.status]: (a[x.status] || 0) + 1 }), {}); }
  async claimPendingEvents({ workerId, batchSize = 50, now = new Date(), organizationId, eventTypes } = {}) { const claimed = [...this.store.values()].filter((x) => CLAIMABLE.includes(x.status) && x.availableAt <= now && (!organizationId || x.organizationId === organizationId) && (!eventTypes?.length || eventTypes.includes(x.eventType))).slice(0,batchSize); for (const x of claimed) Object.assign(x,{status:'PROCESSING',lockedAt:now,lockedBy:workerId,updatedAt:now}); return claimed; }
  async transition(id, workerId, data) { const row=this.store.get(id); if(!row || row.status!=='PROCESSING' || row.lockedBy!==workerId) throw conflict('OUTBOX_LEASE_LOST','Outbox lock потерян или событие уже обработано.'); const inc=data.attemptCount?.increment||0; Object.assign(row,data,{attemptCount:row.attemptCount+inc,updatedAt:new Date()}); return row; }
  markPublished(id,w,now=new Date()){return this.transition(id,w,{status:'PUBLISHED',publishedAt:now,lockedAt:null,lockedBy:null,lastError:null,attemptCount:{increment:1}});}
  scheduleRetry(id,w,{availableAt,error}){return this.transition(id,w,{status:'RETRY',availableAt,lastError:safeError(error),lockedAt:null,lockedBy:null,attemptCount:{increment:1}});}
  markDeadLetter(id,w,error){return this.transition(id,w,{status:'DEAD_LETTER',lastError:safeError(error),lockedAt:null,lockedBy:null,attemptCount:{increment:1}});}
  async releaseExpiredLocks({before,now=new Date()}){let count=0; for(const x of this.store.values())if(x.status==='PROCESSING'&&x.lockedAt<before){Object.assign(x,{status:'RETRY',availableAt:now,lockedAt:null,lockedBy:null,lastError:'WORKER_LEASE_EXPIRED'});count++;} return {count};}
  async retryDeadLetter(id,scope={}){const x=await this.getByEventId(id,scope);if(!x||x.status!=='DEAD_LETTER')throw conflict('OUTBOX_RETRY_NOT_ALLOWED','Повтор разрешён только для доступного DEAD_LETTER события.');Object.assign(x,{status:'RETRY',availableAt:new Date(),lastError:null});return x;}
}

function normalize(event) { return { eventId: event.eventId, eventType: event.eventType, eventVersion: event.eventVersion || 1, aggregateType: event.aggregateType, aggregateId: event.aggregateId, organizationId: event.organizationId, machineId: event.machineId || null, saleFlowId: event.saleFlowId || null, payload: event.payload || {}, status: event.status || 'PENDING', attemptCount: event.attemptCount || 0, maxAttempts: event.maxAttempts || 5, availableAt: event.availableAt || new Date(), occurredAt: event.occurredAt || new Date(), correlationId: event.correlationId || null, causationId: event.causationId || null, idempotencyKey: event.idempotencyKey }; }
function validateEvent(event) { for (const key of ['eventId','eventType','aggregateType','aggregateId','organizationId','idempotencyKey']) if (!event[key]) throw invalid(`${key} обязателен.`); const path = findSecret(event.payload); if (path) throw invalid(`Outbox payload содержит запрещённое поле: ${path}.`); }
function findSecret(value, path = '') { if (!value || typeof value !== 'object') return null; for (const [key, child] of Object.entries(value)) { const next=Array.isArray(value)?`${path}[${key}]`:(path?`${path}.${key}`:key); if (SECRET_FIELDS.has(normalizeFieldName(key))) return next; const found=findSecret(child,next); if(found)return found; } return null; }
function normalizeFieldName(value) { return String(value).replace(/[^a-z0-9]/gi, '').toLowerCase(); }
function tenantWhere(scope) { if (scope.platform) return {}; if (!scope.organizationId) throw Object.assign(new Error('Tenant scope обязателен.'), { code: 'OUTBOX_TENANT_SCOPE_REQUIRED', statusCode: 403 }); return { organizationId: scope.organizationId }; }
function allowed(row,scope){return scope.platform || (scope.organizationId && row.organizationId===scope.organizationId);}
function safeError(error){return String(error?.message||error||'PUBLISH_FAILED').slice(0,2000);}
function invalid(message){return Object.assign(new Error(message),{code:'OUTBOX_VALIDATION_FAILED',statusCode:400});}
function conflict(code,message){return Object.assign(new Error(message),{code,statusCode:409});}
module.exports={PrismaOutboxRepository,InMemoryOutboxRepository,validateEvent};
