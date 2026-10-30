class AuditRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async record(event) {
    return this.prisma.auditEvent.create({
      data: {
        eventType: event.eventType,
        subjectType: event.subjectType || null,
        subjectId: event.subjectId || null,
        targetType: event.targetType || null,
        targetId: event.targetId || null,
        action: event.action,
        decision: event.decision,
        reasonCode: event.reasonCode || null,
        authMethod: event.authMethod || null,
        sourceChannel: event.sourceChannel || null,
        correlationId: event.correlationId,
        metadata: event.metadata || undefined,
        occurredAt: event.occurredAt || new Date(),
        organizationId: event.organizationId || event.metadata?.organizationId || null,
        sessionId: event.sessionId || null,
        idempotencyKey: event.idempotencyKey || null,
      },
    });
  }
}

class NoopAuditRepository {
  async record() {
    return null;
  }
}

module.exports = {
  AuditRepository,
  NoopAuditRepository,
};
