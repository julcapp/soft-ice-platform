const test = require('node:test');
const assert = require('node:assert/strict');
const { BonusRewardEngine } = require('../src/modules/bonus/BonusRewardEngine');

class FakePrisma {
  constructor() {
    this.idempotency = new Map();
    this.accounts = new Map();
    this.transactions = new Map();
  }

  async $transaction(callback) {
    return callback(this);
  }

  async $queryRaw(strings, ...values) {
    const sql = strings.join('?').replace(/\s+/g, ' ').trim();

    if (sql.startsWith('INSERT INTO "IdempotencyRecord"')) {
      const [id, key, actorContext, semanticHash, correlationId] = values;
      const compound = `PHOTO_REWARD:${key}`;
      if (this.idempotency.has(compound)) return [];
      this.idempotency.set(compound, { id, status: 'processing', resultReference: null, actorContext, semanticHash, correlationId });
      return [{ id }];
    }

    if (sql.startsWith('SELECT "status", "resultReference" FROM "IdempotencyRecord"')) {
      const [key] = values;
      const row = this.idempotency.get(`PHOTO_REWARD:${key}`);
      return row ? [{ status: row.status, resultReference: row.resultReference }] : [];
    }

    if (sql.startsWith('UPDATE "BonusAccount"')) {
      const [amountBonus, _updatedAt, customerId] = values;
      const next = (this.accounts.get(customerId) || 0) + Number(amountBonus);
      this.accounts.set(customerId, next);
      return [{ balanceBonus: next }];
    }

    if (sql.startsWith('SELECT "id", "amountBonus", "balanceAfterBonus" FROM "BonusTransaction"')) {
      const [transactionId] = values;
      const row = this.transactions.get(transactionId);
      return row ? [row] : [];
    }

    throw new Error(`Unexpected query: ${sql}`);
  }

  async $executeRaw(strings, ...values) {
    const sql = strings.join('?').replace(/\s+/g, ' ').trim();

    if (sql.startsWith('INSERT INTO "BonusAccount"')) {
      const [_id, customerId] = values;
      if (!this.accounts.has(customerId)) this.accounts.set(customerId, 0);
      return 1;
    }

    if (sql.startsWith('INSERT INTO "BonusTransaction"')) {
      const [id, customerId, amountBonus, photoChallengeId, balanceAfterBonus] = values;
      this.transactions.set(id, { id, customerId, amountBonus: Number(amountBonus), photoChallengeId, balanceAfterBonus: Number(balanceAfterBonus) });
      return 1;
    }

    if (sql.startsWith('UPDATE "IdempotencyRecord"')) {
      const [transactionId, _lastSeenAt, key] = values;
      const compound = `PHOTO_REWARD:${key}`;
      const row = this.idempotency.get(compound);
      row.status = 'completed';
      row.resultReference = transactionId;
      return 1;
    }

    throw new Error(`Unexpected execute: ${sql}`);
  }
}

test('photo reward stays blocked when bonus units are not configured', async () => {
  const prisma = new FakePrisma();
  const engine = new BonusRewardEngine({ prisma });
  const result = await engine.grant({ photoChallengeId: 'photo-1', customerId: 'customer-1', idempotencyKey: 'photo-reward:photo-1' });

  assert.equal(result.granted, false);
  assert.equal(result.reasonCode, 'PHOTO_REWARD_BONUS_UNITS_NOT_CONFIGURED');
  assert.equal(prisma.accounts.size, 0);
  assert.equal(prisma.transactions.size, 0);
});

test('photo reward is idempotent and increments bonus balance once', async () => {
  const prisma = new FakePrisma();
  const engine = new BonusRewardEngine({ prisma, resolveBonusUnits: async () => 50, clock: () => new Date('2026-08-22T12:00:00Z') });
  const input = { photoChallengeId: 'photo-1', customerId: 'customer-1', correlationId: 'corr-1', idempotencyKey: 'photo-reward:photo-1' };

  const first = await engine.grant(input);
  const second = await engine.grant(input);

  assert.equal(first.granted, true);
  assert.equal(first.idempotentReplay, false);
  assert.equal(first.amountBonus, 50);
  assert.equal(first.balanceAfterBonus, 50);
  assert.equal(second.granted, true);
  assert.equal(second.idempotentReplay, true);
  assert.equal(second.transactionId, first.transactionId);
  assert.equal(prisma.accounts.get('customer-1'), 50);
  assert.equal(prisma.transactions.size, 1);
});
