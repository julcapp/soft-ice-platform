const { ApiError } = require('../errors/ApiError');
const { sha256 } = require('../security/hash');

class IdempotencyService {
  constructor(repository) {
    this.repository = repository;
  }

  async reserveOrValidate({
    scope,
    key,
    semanticPayload,
    actorContext,
    correlationId,
  }) {
    if (!key) {
      return null;
    }

    const semanticHash = sha256(JSON.stringify(sortObject(semanticPayload)));
    const existing = await this.repository.find(scope, key);

    if (existing) {
      if (existing.semanticHash !== semanticHash) {
        throw new ApiError({
          statusCode: 409,
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency key was already used with different request data.',
          source: 'platform_service',
        });
      }

      await this.repository.touch(existing.id);
      return existing;
    }

    return this.repository.create({
      scope,
      key,
      actorContext,
      semanticHash,
      status: 'processing',
      correlationId,
    });
  }

  async complete(record, resultReference) {
    if (!record) {
      return null;
    }

    return this.repository.complete(record.id, resultReference);
  }
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortObject(value[key]);
      return acc;
    }, {});
}

module.exports = {
  IdempotencyService,
};
