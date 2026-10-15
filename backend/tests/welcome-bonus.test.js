const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WelcomeBonusService,
  WELCOME_BONUS_STATUS,
  WELCOME_BONUS_QUALIFYING_ACTION,
  addDays,
} = require('../src/modules/welcome_bonus');

test('welcome bonus expires exactly 30 days after issue by default', async () => {
  const issuedAt = new Date('2026-08-20T00:00:00.000Z');
  const records = [];
  const repository = {
    findActiveByCustomerId: async () => null,
    create: async (record) => { records.push(record); return record; },
  };
  const service = new WelcomeBonusService({ repository, clock: () => issuedAt });
  const grant = await service.issue({ customerId: 'c1', amountBonus: 100 });
  assert.equal(grant.status, WELCOME_BONUS_STATUS.ACTIVE);
  assert.equal(grant.expiresAt.toISOString(), addDays(issuedAt, 30).toISOString());
});

test('qualified referral preserves welcome bonus before expiry', async () => {
  const active = { id: 'g1', customerId: 'c1', status: WELCOME_BONUS_STATUS.ACTIVE };
  const repository = {
    findActiveByCustomerId: async () => active,
    qualify: async (id, patch) => ({ ...active, id, ...patch, status: WELCOME_BONUS_STATUS.QUALIFIED }),
  };
  const service = new WelcomeBonusService({ repository, clock: () => new Date('2026-08-25T00:00:00.000Z') });
  const grant = await service.qualify({ customerId: 'c1', action: WELCOME_BONUS_QUALIFYING_ACTION.REFERRAL_QUALIFIED, eventId: 'r1' });
  assert.equal(grant.status, WELCOME_BONUS_STATUS.QUALIFIED);
  assert.equal(grant.qualifyingAction, WELCOME_BONUS_QUALIFYING_ACTION.REFERRAL_QUALIFIED);
});

test('repeat club topup is a welcome bonus qualifying action', async () => {
  const active = { id: 'g2', customerId: 'c2', status: WELCOME_BONUS_STATUS.ACTIVE };
  const repository = {
    findActiveByCustomerId: async () => active,
    qualify: async (id, patch) => ({ ...active, id, ...patch, status: WELCOME_BONUS_STATUS.QUALIFIED }),
  };
  const service = new WelcomeBonusService({ repository });
  const grant = await service.qualify({ customerId: 'c2', action: WELCOME_BONUS_QUALIFYING_ACTION.REPEAT_CLUB_TOPUP, eventId: 'topup-2' });
  assert.equal(grant.status, WELCOME_BONUS_STATUS.QUALIFIED);
});
