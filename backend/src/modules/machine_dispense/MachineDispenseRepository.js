class MachineDispenseRepository {
  constructor(prisma) { this.prisma = prisma; this.persistenceMode = 'POSTGRESQL'; }
  transaction(work) { return this.prisma.$transaction ? this.prisma.$transaction((tx) => work(new MachineDispenseRepository(tx), tx)) : work(this, this.prisma); }
  get(organizationId, id) { return this.prisma.machineDispenseAttempt.findFirst({ where: { organizationId, OR: [{ id }, { dispenseAttemptId: id }] } }); }
  getByCommand(provider, providerCommandId) { return this.prisma.machineDispenseAttempt.findFirst({ where: { provider, OR: [{ providerCommandId }, { commandId: providerCommandId }] } }); }
  async lockAttempt(id) { await this.prisma.$queryRawUnsafe('SELECT "id" FROM "MachineDispenseAttempt" WHERE "id" = $1 FOR UPDATE', id); return this.prisma.machineDispenseAttempt.findUnique({ where: { id } }); }
  findByFlow(organizationId, orderId, saleFlowId) { return this.prisma.machineDispenseAttempt.findUnique({ where: { organizationId_orderId_saleFlowId: { organizationId, orderId, saleFlowId } } }); }
  findByIdempotency(organizationId, idempotencyKey) { return this.prisma.machineDispenseAttempt.findUnique({ where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } } }); }
  unfinished(organizationId, limit = 100) { return this.prisma.machineDispenseAttempt.findMany({ where: { organizationId, status: { in: ['QUEUED','DISPATCHING','SENT','ACCEPTED','DISPENSING','TIMED_OUT','RECONCILIATION_REQUIRED'] } }, orderBy: { createdAt: 'asc' }, take: Math.min(limit, 500) }); }
  async claimRecoveryBatch({ workerId, now = new Date(), leaseMs = 60000, limit = 50 }) {
    if (!workerId) throw Object.assign(new Error('workerId обязателен.'), { code: 'MACHINE_RECOVERY_WORKER_ID_REQUIRED' });
    const expired = new Date(now.getTime() - leaseMs);
    return this.prisma.$queryRaw`
      WITH candidates AS (
        SELECT "id" FROM "MachineDispenseAttempt"
        WHERE "status" IN ('DISPATCHING','SENT','ACCEPTED','DISPENSING','TIMED_OUT','RECONCILIATION_REQUIRED')
          AND ("recoveryLockedAt" IS NULL OR "recoveryLockedAt" < ${expired})
        ORDER BY "updatedAt", "createdAt" FOR UPDATE SKIP LOCKED LIMIT ${Math.min(limit, 500)}
      )
      UPDATE "MachineDispenseAttempt" a
      SET "recoveryLockedAt"=${now}, "recoveryLockedBy"=${workerId}, "recoveryAttemptCount"="recoveryAttemptCount"+1, "updatedAt"=${now}
      FROM candidates WHERE a."id"=candidates."id" RETURNING a.*`;
  }
  releaseRecoveryClaim(id, workerId) { return this.prisma.machineDispenseAttempt.updateMany({ where: { id, recoveryLockedBy: workerId }, data: { recoveryLockedAt: null, recoveryLockedBy: null } }); }
  list(filters = {}, scope = {}) { const where = scope.platform ? {} : { organizationId: requiredScope(scope) }; for (const key of ['organizationId','machineId','status','operationType']) if (filters[key]) where[key] = filters[key]; if (filters.dateFrom || filters.dateTo) where.createdAt = { ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }), ...(filters.dateTo && { lte: new Date(filters.dateTo) }) }; return this.prisma.machineDispenseAttempt.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(Number(filters.limit) || 100, 500), include: { reconciliations: true, inboxEvents: { orderBy: { receivedAt: 'desc' }, take: 1 }, auditEntries: { orderBy: { occurredAt: 'desc' }, take: 10 } } }); }
  create(data) { return this.prisma.machineDispenseAttempt.create({ data }); }
  update(id, version, data) { return this.prisma.machineDispenseAttempt.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } }); }
  inbox(data) { return this.prisma.machineCallbackInbox.create({ data }); }
  findInbox(provider, providerEventId) { return this.prisma.machineCallbackInbox.findUnique({ where: { provider_providerEventId: { provider, providerEventId } } }); }
  updateInbox(id, data) { return this.prisma.machineCallbackInbox.update({ where: { id }, data }); }
  async lockClaimedInbox(id, workerId, leaseVersion) { await this.prisma.$queryRawUnsafe('SELECT "id" FROM "MachineCallbackInbox" WHERE "id" = $1 FOR UPDATE', id); return this.prisma.machineCallbackInbox.findFirst({ where: { id, status: 'PROCESSING', processingLockedBy: workerId, processingLeaseVersion: leaseVersion } }); }
  updateClaimedInbox(id, workerId, leaseVersion, data) { return this.prisma.machineCallbackInbox.updateMany({ where: { id, status: 'PROCESSING', processingLockedBy: workerId, processingLeaseVersion: leaseVersion }, data }); }
  failClaimedInbox(id, workerId, leaseVersion, lastFailureCode, now = new Date()) { return this.updateClaimedInbox(id, workerId, leaseVersion, { status: 'FAILED', failedAt: now, lastFailureCode, processingLockedAt: null, processingLockedBy: null }); }
  async claimInbox(id, { workerId, now = new Date(), leaseMs = 60000 } = {}) {
    if (!workerId) throw Object.assign(new Error('workerId callback обязателен.'), { code: 'MACHINE_CALLBACK_WORKER_ID_REQUIRED' });
    const expired = new Date(now.getTime() - leaseMs);
    const claimed = await this.prisma.machineCallbackInbox.updateMany({ where: { id, OR: [{ status: { in: ['RECEIVED','FAILED'] } }, { status: 'PROCESSING', processingLockedAt: { lt: expired } }] }, data: { status: 'PROCESSING', processingStartedAt: now, processingLockedAt: now, processingLockedBy: workerId, failedAt: null, attemptCount: { increment: 1 }, processingLeaseVersion: { increment: 1 } } });
    return claimed.count === 1 ? this.prisma.machineCallbackInbox.findUnique({ where: { id } }) : null;
  }
  async claimCallbackRecoveryBatch({ workerId, now = new Date(), leaseMs = 60000, limit = 50 }) {
    if (!workerId) throw Object.assign(new Error('workerId callback обязателен.'), { code: 'MACHINE_CALLBACK_WORKER_ID_REQUIRED' });
    const expired = new Date(now.getTime() - leaseMs);
    return this.prisma.$queryRaw`
      WITH candidates AS (
        SELECT "id" FROM "MachineCallbackInbox"
        WHERE "status" IN ('RECEIVED','FAILED') OR ("status"='PROCESSING' AND "processingLockedAt" < ${expired})
        ORDER BY "receivedAt" FOR UPDATE SKIP LOCKED LIMIT ${Math.min(limit, 500)}
      )
      UPDATE "MachineCallbackInbox" i SET "status"='PROCESSING', "processingStartedAt"=${now}, "processingLockedAt"=${now}, "processingLockedBy"=${workerId}, "failedAt"=NULL, "attemptCount"="attemptCount"+1, "processingLeaseVersion"="processingLeaseVersion"+1
      FROM candidates WHERE i."id"=candidates."id" RETURNING i.*`;
  }
  findAuthorizedTestActor(organizationId, memberId, roles) { return this.prisma.organizationMember.findFirst({ where: { id: memberId, organizationId, status: 'ACTIVE', archivedAt: null, roleAssignments: { some: { organizationId, role: { in: roles }, revokedAt: null } } } }); }
  audit(data) { return this.prisma.machineDispenseAuditEntry.create({ data }); }
  reconcile(data) { return this.prisma.machineReconciliation.create({ data }); }
  findReconciliation(organizationId, fingerprint) { return this.prisma.machineReconciliation.findUnique({ where: { organizationId_fingerprint: { organizationId, fingerprint } } }); }
  outbox(data) { return this.prisma.transactionalOutboxEvent.create({ data }); }
}
function requiredScope(scope) { if (!scope.organizationId) throw Object.assign(new Error('Tenant scope обязателен.'), { code: 'MACHINE_TENANT_SCOPE_REQUIRED', statusCode: 403 }); return scope.organizationId; }
module.exports = { MachineDispenseRepository };
