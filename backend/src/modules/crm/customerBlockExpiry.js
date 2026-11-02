'use strict';

/**
 * This entrypoint requires a repository that updates expired blocks and creates
 * AuditEvent rows in the SAME database transaction. Never audit after commit.
 */
async function releaseExpiredBlocks({ repository, clock = () => new Date(), batchSize = 100 }) {
  if (!repository || typeof repository.releaseExpiredBlocks !== 'function') {
    throw new TypeError('Transactional block expiry repository required');
  }
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new RangeError('INVALID_EXPIRY_BATCH_SIZE');
  }
  const now = clock();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new TypeError('Invalid expiry clock');
  }
  const released = await repository.releaseExpiredBlocks(now, batchSize);
  if (!Array.isArray(released)) throw new TypeError('Repository must return released customer IDs');
  return released.length;
}

module.exports = { releaseExpiredBlocks };
