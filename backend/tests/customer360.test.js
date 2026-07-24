const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Customer360Service } = require('../src/modules/customer_360');

function fixture() {
  const customer = {
    id: 'customer-1', name: 'Анна', phone: '+79990000000', phoneVerifiedAt: new Date(),
    email: 'anna@example.test', telegramUsername: 'anna', birthday: null, status: 'active',
    identities: [{ id: 'identity-1', provider: 'telegram', linkedAt: new Date('2026-01-01') }],
    consents: [], clubAccount: { id: 'club-1', availableBalanceRub: 500, transactions: [] },
    bonusAccount: { balanceBonus: 40 }, bonusTransactions: [],
    orders: [{ id: 'order-1', status: 'COMPLETED', amount: 250, amountPaidRub: 230, createdAt: new Date('2026-07-20'), paidAt: new Date('2026-07-20') }],
    referralsMade: [], referredBy: [], photoChallenges: [], birthdayRewards: [],
    segmentAssignments: [], notificationDeliveries: [], customerPreferences: [],
    promotionParticipations: [], gameActivities: [], aiProfile: null, timelineEvents: [],
  };
  const storedEvents = [];
  const repository = {
    findCustomer: async (id) => id === customer.id ? customer : null,
    upsertPreference: async (customerId, input, actorId) => ({ id: 'preference-1', customerId, ...input, updatedBy: actorId }),
    createTimelineEvent: async (data) => { const event = { id: 'event-1', ...data }; storedEvents.push(event); return event; },
  };
  return { customer, storedEvents, service: new Customer360Service({ repository, clock: () => new Date('2026-07-24T00:00:00Z') }) };
}

test('Customer 360 агрегирует профиль без переноса владения данными', async () => {
  const { service } = fixture();
  const profile = await service.getProfile('customer-1');
  assert.equal(profile.identification.name, 'Анна');
  assert.equal(profile.loyalty.clubAccount.availableBalanceRub, 500);
  assert.equal(profile.purchaseSummary.spentRub, 230);
  assert.equal(profile.aiProfile.status, 'FOUNDATION_ONLY');
  assert.equal(profile.capabilities.miniApp, true);
});

test('Customer Timeline объединяет доменные события по убыванию времени', async () => {
  const { service } = fixture();
  const timeline = await service.getTimeline('customer-1');
  assert.deepEqual(timeline.map((event) => event.category), ['ORDER', 'IDENTITY']);
  assert.equal(timeline[0].title, 'Покупка');
});

test('явное предпочтение создаёт запись единого журнала', async () => {
  const { service, storedEvents } = fixture();
  const preference = await service.setPreference('customer-1', {
    category: 'flavor', key: 'favorite', value: 'vanilla',
  }, { actorId: 'customer-1', correlationId: 'corr-1' });
  assert.equal(preference.source, 'EXPLICIT');
  assert.equal(storedEvents[0].eventType, 'Customer360.PreferenceUpdated');
  assert.equal(storedEvents[0].title, 'Предпочтение обновлено');
});

test('Customer 360 отклоняет недостоверное значение confidence', async () => {
  const { service } = fixture();
  await assert.rejects(
    () => service.setPreference('customer-1', { category: 'flavor', key: 'favorite', value: 'vanilla', confidence: 2 }),
    (error) => error.code === 'CUSTOMER_360_INVALID_CONFIDENCE',
  );
});
