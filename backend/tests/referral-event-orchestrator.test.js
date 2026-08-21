const test = require('node:test');
const assert = require('node:assert/strict');
const { ReferralEventOrchestrator, QUALIFYING_ACTION } = require('../src/modules/referral');

test('paid order qualifies referral and rewards both sides', async () => {
  const calls = [];
  const referral = { id: 'r1', referrerCustomerId: 'a', referredCustomerId: 'b', status: 'registered' };
  const orchestrator = new ReferralEventOrchestrator({
    referralRepository: { findByReferredCustomerId: async () => referral },
    referralService: { qualify: async (input) => { calls.push(input); return { ...referral, status: 'qualified', qualified: true }; } },
    rewardEngine: { rewardQualifiedReferral: async (input) => { calls.push(input); return { ...input.referral, status: 'rewarded' }; } },
    welcomeBonusService: { qualify: async (input) => calls.push(input) },
  });
  const result = await orchestrator.onOrderPaid({ customerId: 'b', orderId: 'o1', reward: { referrerAmountBonus: 100, referredAmountBonus: 50 } });
  assert.equal(result.applied, true);
  assert.equal(result.action, QUALIFYING_ACTION.FIRST_PURCHASE);
  assert.equal(calls[0].eventId, 'o1');
});

test('club topup below configured threshold does not qualify referral', async () => {
  let called = false;
  const orchestrator = new ReferralEventOrchestrator({
    qualifiedTopupThresholdRub: 500,
    referralRepository: { findByReferredCustomerId: async () => ({ id: 'r1' }) },
    referralService: { qualify: async () => { called = true; } },
    rewardEngine: { rewardQualifiedReferral: async () => null },
  });
  const result = await orchestrator.onClubTopupCredited({ customerId: 'b', transactionId: 't1', amountRub: 300, balanceAfterRub: 300 });
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'below_threshold');
  assert.equal(called, false);
});

test('qualified topup can preserve welcome bonus and qualify referral', async () => {
  const actions = [];
  const referral = { id: 'r2', referrerCustomerId: 'a', referredCustomerId: 'b', status: 'registered' };
  const orchestrator = new ReferralEventOrchestrator({
    qualifiedTopupThresholdRub: 500,
    referralRepository: { findByReferredCustomerId: async () => referral },
    referralService: { qualify: async (input) => ({ ...referral, status: 'qualified', qualified: true, qualifyingAction: input.action }) },
    rewardEngine: { rewardQualifiedReferral: async ({ referral: value }) => ({ ...value, status: 'rewarded' }) },
    welcomeBonusService: { qualify: async (input) => actions.push(input) },
  });
  const result = await orchestrator.onClubTopupCredited({ customerId: 'b', transactionId: 't2', amountRub: 500, balanceAfterRub: 700 });
  assert.equal(result.applied, true);
  assert.equal(result.action, QUALIFYING_ACTION.QUALIFIED_CLUB_TOPUP);
  assert.equal(actions[0].action, 'repeat_club_topup');
});
