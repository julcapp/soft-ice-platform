const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ReferralService,
  createReferralCode,
  REFERRAL_STATUS,
  QUALIFYING_ACTION,
  assertReferralParticipants,
  buildReferralSection,
} = require('../src/modules/referral');

test('referral code is stable for one customer and differs for another', () => {
  assert.equal(createReferralCode('customer-1'), createReferralCode('customer-1'));
  assert.notEqual(createReferralCode('customer-1'), createReferralCode('customer-2'));
});

test('self referral is rejected', () => {
  assert.throws(
    () => assertReferralParticipants({ referrerCustomerId: 'c1', referredCustomerId: 'c1' }),
    (error) => error.code === 'SELF_REFERRAL'
  );
});

test('first purchase qualifies registered referral once', async () => {
  const events = [];
  const service = new ReferralService({ eventCenter: { publish: async (event) => events.push(event) } });
  const referral = { id: 'r1', referrerCustomerId: 'c1', referredCustomerId: 'c2', status: REFERRAL_STATUS.REGISTERED };
  const result = await service.qualify({ referral, action: QUALIFYING_ACTION.FIRST_PURCHASE, eventId: 'order-1' });
  assert.equal(result.status, REFERRAL_STATUS.QUALIFIED);
  assert.equal(result.qualified, true);
  assert.equal(events[0].type, 'REFERRAL_QUALIFIED');
});

test('qualified club topup is an alternative target action', async () => {
  const service = new ReferralService();
  const referral = { id: 'r2', referrerCustomerId: 'c1', referredCustomerId: 'c3', status: REFERRAL_STATUS.REGISTERED };
  const result = await service.qualify({ referral, action: QUALIFYING_ACTION.QUALIFIED_CLUB_TOPUP, eventId: 'topup-1' });
  assert.equal(result.qualifyingAction, QUALIFYING_ACTION.QUALIFIED_CLUB_TOPUP);
});

test('referral section exposes agreed funnel counters', () => {
  const view = buildReferralSection({ referralCode: 'ABC123', inviteUrl: 'https://example.test/start?ref=ABC123', stats: { invited: 5, registered: 4, firstPurchase: 2, qualifiedTopup: 1 } });
  assert.equal(view.stats.invited, 5);
  assert.equal(view.stats.firstPurchase, 2);
  assert.equal(view.stats.qualifiedTopup, 1);
  assert.equal(view.actions.length, 4);
});
