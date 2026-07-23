class IdempotencyRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async find(scope, key) {
    return this.prisma.idempotencyRecord.findUnique({
      where: {
        scope_key: {
          scope,
          key,
        },
      },
    });
  }

  async create(record) {
    return this.prisma.idempotencyRecord.create({
      data: {
        scope: record.scope,
        key: record.key,
        actorContext: record.actorContext,
        semanticHash: record.semanticHash,
        status: record.status,
        resultReference: record.resultReference || null,
        correlationId: record.correlationId,
        firstSeenAt: record.firstSeenAt || new Date(),
        lastSeenAt: record.lastSeenAt || new Date(),
        expiresAt: record.expiresAt || null,
      },
    });
  }

  async complete(recordId, resultReference) {
    return this.prisma.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        status: 'completed',
        resultReference,
        lastSeenAt: new Date(),
      },
    });
  }

  async touch(recordId) {
    return this.prisma.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        lastSeenAt: new Date(),
      },
    });
  }
}

class InMemoryIdempotencyRepository {
  constructor() {
    this.records = new Map();
  }

  async find(scope, key) {
    return this.records.get(`${scope}:${key}`) || null;
  }

  async create(record) {
    const created = {
      id: `idem_${this.records.size + 1}`,
      ...record,
      firstSeenAt: record.firstSeenAt || new Date(),
      lastSeenAt: record.lastSeenAt || new Date(),
    };

    this.records.set(`${record.scope}:${record.key}`, created);
    return created;
  }

  async complete(recordId, resultReference) {
    const record = [...this.records.values()].find(({ id }) => id === recordId);

    if (!record) {
      return null;
    }

    record.status = 'completed';
    record.resultReference = resultReference;
    record.lastSeenAt = new Date();
    return record;
  }

  async touch(recordId) {
    const record = [...this.records.values()].find(({ id }) => id === recordId);

    if (record) {
      record.lastSeenAt = new Date();
    }

    return record || null;
  }
}

module.exports = {
  IdempotencyRepository,
  InMemoryIdempotencyRepository,
};
