const test = require('node:test');
const assert = require('node:assert/strict');
const { ReferralEngagementService } = require('../src/modules/referral_engagement/ReferralEngagementService');

function fixture() {
  const events = [];
  const prisma = {
    customer: { findUnique: async ({ where }) => where.id === 'c1' ? { id: 'c1' } : null },
    auditEvent: { create: async ({ data }) => { const row = { id: `e${events.length + 1}`, ...data }; events.push(row); return row; } },
  };
  return { events, service: new ReferralEngagementService({ prisma, clock: () => new Date('2026-08-22T16:00:00Z') }) };
}

test('records COPY SHARE SEND as immutable referral link facts', async () => {
  const { service, events } = fixture();
  await service.record('c1', { action: 'COPY', destination: 'CLIPBOARD' }, { correlationId: 'corr-1', sourceChannel: 'miniapp' });
  await service.record('c1', { action: 'SEND', destination: 'TELEGRAM' }, { correlationId: 'corr-2', sourceChannel: 'miniapp' });
  assert.equal(events.length, 2);
  assert.equal(events[0].eventType, 'Referral.LinkAction');
  assert.deepEqual(events[0].metadata, { action: 'COPY', destination: 'CLIPBOARD', surface: 'REFERRAL_SECTION' });
  assert.equal(events[1].metadata.destination, 'TELEGRAM');
});

test('rejects unknown referral action instead of guessing', async () => {
  const { service } = fixture();
  await assert.rejects(() => service.record('c1', { action: 'OPEN' }), (error) => error.code === 'REFERRAL_ENGAGEMENT_ACTION_INVALID');
});
