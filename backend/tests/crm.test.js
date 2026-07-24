const assert = require('node:assert/strict');
const { test } = require('node:test');
const { CRMService } = require('../src/modules/crm');

function fixture() {
  const customer = {
    id: 'customer-1', name: 'Анна', phone: '+79990000000', email: null, status: 'active',
    birthday: null, createdAt: new Date('2026-01-01'), crmProfile: null,
    clubAccount: { id: 'club-1', status: 'active', currency: 'RUB', availableBalanceRub: 500, transactions: [] },
    bonusAccount: { balanceBonus: 40 }, bonusTransactions: [], orders: [],
    referralsMade: [], referredBy: [], segmentAssignments: [], notificationDeliveries: [],
  };
  const notifications = [];
  const repository = {
    findCustomer: async (id) => id === customer.id ? customer : null,
    listCustomers: async () => [customer],
    dashboard: async () => ({ customers: 1, activeCustomers: 1, campaigns: 0, queuedNotifications: 0, purchases: 0, revenueRub: 0, bonusLiability: 40 }),
    listCampaigns: async () => [],
    listNotifications: async () => notifications,
    createNotification: async (data) => { notifications.push(data); return data; },
    createCampaign: async (data) => data,
    upsertProfile: async (customerId, data) => ({ id: 'profile-1', customerId, ...data }),
  };
  return { customer, notifications, service: new CRMService({ repository, clubAccountRuntime: {}, segmentationRuntime: {}, clock: () => new Date('2026-07-24T00:00:00Z') }) };
}

test('CRM формирует сводку и карточку клиента из доменных проекций', async () => {
  const { service } = fixture();
  const dashboard = await service.getDashboard();
  const card = await service.getCustomerCard('customer-1');
  assert.equal(dashboard.summary.customers, 1);
  assert.equal(card.loyalty.clubAccount.availableBalanceRub, 500);
  assert.equal(card.loyalty.bonusAccount.balanceBonus, 40);
});

test('CRM ставит русскоязычное уведомление в очередь', async () => {
  const { service, notifications } = fixture();
  await service.queueNotification('customer-1', { channel: 'TELEGRAM', body: 'Вам начислены бонусы' }, {
    actorId: 'admin-1', authMethod: 'test', correlationId: 'corr-1', idempotencyKey: 'notify-1',
  });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].status, 'QUEUED');
  assert.equal(notifications[0].body, 'Вам начислены бонусы');
});

test('CRM не раскрывает отсутствующего клиента', async () => {
  const { service } = fixture();
  await assert.rejects(() => service.getCustomerCard('missing'), (error) => error.code === 'RESOURCE_NOT_FOUND');
});
