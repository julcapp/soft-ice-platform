const test = require('node:test');
const assert = require('node:assert/strict');

const { ReferralRewardEngine, REFERRAL_STATUS } = require('../src/modules/referral');

test('reward engine credits both sides exactly through bonus ledger contract', async () => {
  const credits = [];
  const engine = new ReferralRewardEngine({
    bonusLedger: { credit: async (entry) => credits.push(entry) },
    referralRepository: {
      markRewardPaid: async (id, patch) => ({ id, referrerCustomerId: 'a', referredCustomerId: 'b', ...patch }),
    },
  });
  const referral = { id: 'r1', referrerCustomerId: 'a', referredCustomerId: 'b', status: REFERRAL_STATUS.QUALIFIED, referrerBonusPaid: false, referredBonusPaid: false };
  const result = await engine.rewardQualifiedReferral({ referral, referrerAmountBonus: 100, referredAmountBonus: 50 });
  assert.equal(credits.length, 2);
  assert.equal(credits[0].idempotencyKey, 'referral:r1:referrer');
  assert.equal(credits[1].idempotencyKey, 'referral:r1:referred');
  assert.equal(result.status, REFERRAL_STATUS.REWARDED);
});

test('reward engine ignores non-qualified referral', async () => {
  let called = false;
  const engine = new ReferralRewardEngine({ bonusLedger: { credit: async () => { called = true; } } });
  const referral = { id: 'r2', status: REFERRAL_STATUS.REGISTERED };
  const result = await engine.rewardQualifiedReferral({ referral, referrerAmountBonus: 100, referredAmountBonus: 50 });
  assert.equal(called, false);
  assert.equal(result, referral);
});
