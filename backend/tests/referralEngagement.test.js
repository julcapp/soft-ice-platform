const test = require('node:test');
const assert = require('node:assert/strict');
const { ReferralEngagementService } = require('../src/modules/referral_engagement/ReferralEngagementService');

function fixture() {
  const events = [];
  const referrals = [];
  const prisma = {
    customer: { findUnique: async ({ where }) => where.id === 'c1' ? { id: 'c1' } : null },
    referral: {
      findFirst: async ({ where }) => referrals.find((item) => item.referrerCustomerId === where.referrerCustomerId && item.referredCustomerId === null && item.status === 'link_ready') || null,
      create: async ({ data }) => { const row = { id: `r${referrals.length + 1}`, createdAt: new Date('2026-08-22T16:00:00Z'), referredCustomerId: null, ...data }; referrals.push(row); return row; },
    },
    auditEvent: { create: async ({ data }) => { const row = { id: `e${events.length + 1}`, ...data }; events.push(row); return row; } },
  };
  return { events, referrals, service: new ReferralEngagementService({ prisma, clock: () => new Date('2026-08-22T16:00:00Z'), publicBaseUrl: 'https://app.utimoshi.ru' }) };
}

test('creates one durable personal link and records COPY SHARE SEND as immutable facts', async () => {
  const { service, events, referrals } = fixture();
  const link1 = await service.getOrCreateLink('c1');
  const link2 = await service.getOrCreateLink('c1');
  assert.equal(referrals.length, 1);
  assert.equal(link1.referralLink, link2.referralLink);
  assert.match(link1.referralLink, /^https:\/\/app\.utimoshi\.ru\/\?ref=/);

  await service.record('c1', { action: 'COPY', destination: 'CLIPBOARD' }, { correlationId: 'corr-1', sourceChannel: 'miniapp' });
  await service.record('c1', { action: 'SEND', destination: 'TELEGRAM' }, { correlationId: 'corr-2', sourceChannel: 'miniapp' });
  assert.equal(events.length, 2);
  assert.equal(events[0].eventType, 'Referral.LinkAction');
  assert.equal(events[0].metadata.action, 'COPY');
  assert.equal(events[0].metadata.destination, 'CLIPBOARD');
  assert.equal(events[0].metadata.referralCode, link1.referralCode);
  assert.equal(events[1].metadata.destination, 'TELEGRAM');
});

test('rejects unknown referral action instead of guessing', async () => {
  const { service } = fixture();
  await assert.rejects(() => service.record('c1', { action: 'OPEN' }), (error) => error.code === 'REFERRAL_ENGAGEMENT_ACTION_INVALID');
});
