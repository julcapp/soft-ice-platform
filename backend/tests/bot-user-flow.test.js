const test = require('node:test');
const assert = require('node:assert/strict');
const { BotUserFlowService, buildReferralRewardNotification } = require('../src/modules/bot_core');

test('club view combines balances, welcome bonus and referral stats', async () => {
  const service = new BotUserFlowService({
    customerRepository: { findById: async () => ({ id: 'c1', name: 'Александр' }) },
    clubAccountRepository: { findByCustomerId: async () => ({ availableBalanceRub: 700 }) },
    bonusRepository: { findByCustomerId: async () => ({ balanceBonus: 120 }) },
    welcomeBonusRepository: { findActiveByCustomerId: async () => ({ status: 'active', amountRemaining: 50, expiresAt: '2026-09-19T00:00:00.000Z' }) },
    referralRepository: { getStatsForReferrer: async () => ({ invited: 4, firstPurchase: 2, qualifiedTopup: 1 }) },
    miniAppUrl: 'https://app.utimoshi.ru',
  });
  const view = await service.getClub('c1');
  assert.match(view.text, /Александр/);
  assert.match(view.text, /700\.00 ₽/);
  assert.match(view.text, /Приветственный бонус: 50/);
  assert.match(view.text, /Выполнили условие: 3/);
});

test('referral view creates invite URL through channel-aware builder', async () => {
  const service = new BotUserFlowService({
    referralService: { getInviteProfile: () => ({ referralCode: 'ABC123', startPayload: 'ref_ABC123' }) },
    referralRepository: { getStatsForReferrer: async () => ({ invited: 3, registered: 2 }) },
    inviteLinkBuilder: (payload, channel) => `https://go.utimoshi.ru/${channel}/${payload}`,
  });
  const view = await service.getReferral('c1', 'max');
  assert.equal(view.referralCode, 'ABC123');
  assert.equal(view.inviteUrl, 'https://go.utimoshi.ru/max/ref_ABC123');
  assert.equal(view.stats.invited, 3);
});

test('reward notification links back to referral section', () => {
  const notice = buildReferralRewardNotification({ amountBonus: 100, miniAppUrl: 'https://app.utimoshi.ru/club' });
  assert.match(notice.text, /100 бонусов/);
  assert.equal(notice.actions[0].action, 'referral');
});
