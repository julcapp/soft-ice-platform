const test = require('node:test');
const assert = require('node:assert/strict');
const { BusinessDashboardService, resolveRange } = require('../src/modules/admin_dashboard/BusinessDashboardService');

const admin = { roles: ['ADMIN'], userId: 'admin-1' };
const clock = () => new Date('2026-08-22T15:00:00Z');

function prismaMock() {
  return {
    customer: {
      count: async (args) => args?.where ? 2 : 10,
      findUnique: async () => ({ id: 'referrer-1', name: 'Тимофей', telegramUsername: 'timosha' }),
    },
    clubAccount: { count: async (args) => args?.where?.activatedAt ? 1 : 5 },
    clubTopup: { findMany: async () => [{ amountRub: 500, paidAt: new Date('2026-08-10T10:00:00Z'), customerId: 'c1' }] },
    order: { findMany: async () => [
      { id: 'o1', customerId: 'c1', status: 'COMPLETED', amount: 200, amountPaidRub: 180, paidAt: new Date('2026-08-10T12:00:00Z'), activePickupCodeHash: null },
      { id: 'o2', customerId: 'c2', status: 'PAID', amount: 250, amountPaidRub: 250, paidAt: new Date('2026-08-11T12:00:00Z'), activePickupCodeHash: 'hash' },
    ] },
    referral: { findMany: async () => [
      { referrerCustomerId: 'referrer-1', referredCustomerId: 'c2', status: 'registered', firstPurchaseAt: new Date('2026-08-11T12:00:00Z'), referralCode: 'ABC' },
      { referrerCustomerId: 'referrer-1', referredCustomerId: 'c3', status: 'registered', firstPurchaseAt: null, referralCode: 'ABC' },
    ] },
    customerChannelSubscription: { findMany: async () => [
      { channelType: 'VK', targetType: 'PUBLIC_CHANNEL', customerId: 'c1' },
      { channelType: 'TELEGRAM', targetType: 'PUBLIC_CHANNEL', customerId: 'c1' },
      { channelType: 'MAX', targetType: 'PUBLIC_CHANNEL', customerId: 'c2' },
      { channelType: 'TELEGRAM', targetType: 'PRIVATE_PAID_CHANNEL', customerId: 'c3' },
    ] },
  };
}

test('business dashboard aggregates live users, club, referrals, channels, sales and pickup backlog', async () => {
  const service = new BusinessDashboardService({ prisma: prismaMock(), clock });
  const data = await service.getDashboard(admin, { from: '2026-08-01', to: '2026-08-22' });
  assert.equal(data.users.total, 10);
  assert.equal(data.club.membersTotal, 5);
  assert.equal(data.club.topupAmountRubInPeriod, 500);
  assert.equal(data.sales.paidOrdersInPeriod, 2);
  assert.equal(data.sales.completedOrdersInPeriod, 1);
  assert.equal(data.sales.awaitingPickupCount, 1);
  assert.equal(data.sales.awaitingPickupAmountRub, 250);
  assert.equal(data.sales.revenueRubInPeriod, 430);
  assert.equal(data.referrals.acceptedTotal, 2);
  assert.equal(data.referrals.activeTotal, 1);
  assert.equal(data.referrals.topReferrer.displayName, 'Тимофей');
  assert.equal(data.channels.VK.subscribed, 1);
  assert.equal(data.channels.TELEGRAM.subscribed, 1);
  assert.equal(data.channels.MAX.subscribed, 1);
  assert.equal(data.referrals.linksDistributedStatus, 'BLOCKED');
  assert.equal(data.privateChannel.status, 'BLOCKED');
});

test('business dashboard period defaults to 30 calendar days and limits arbitrary ranges', () => {
  const range = resolveRange({}, clock());
  assert.equal(range.days, 30);
  assert.equal(range.from.toISOString().slice(0, 10), '2026-07-24');
  assert.equal(range.toInclusive.toISOString().slice(0, 10), '2026-08-22');
  assert.throws(() => resolveRange({ from: '2025-01-01', to: '2026-08-22' }, clock), /Maximum reporting period/);
});

test('business dashboard requires administrative role', async () => {
  const service = new BusinessDashboardService({ prisma: prismaMock(), clock });
  await assert.rejects(() => service.getDashboard({ roles: ['OPERATOR'] }), (error) => error.code === 'ADMIN_PERMISSION_DENIED');
});
