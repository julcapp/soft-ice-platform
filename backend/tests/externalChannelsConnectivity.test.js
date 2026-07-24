const test = require('node:test');
const assert = require('node:assert/strict');
const { ExternalChannelRepository, ExternalChannelService, MockVkExternalChannelAdapter } = require('../src/modules/customer_360');
const { MachineConnectivityRepository, MachineConnectivityService, maskPhone, MockMobileCarrierAdapter } = require('../src/modules/machine_connectivity');
const admin = { roles: ['ADMIN'], actorId: 'admin_1', correlationId: 'corr_1' };
const customer = {
  id: 'customer_1', phoneVerifiedAt: new Date(), consents: [{ consentType: 'MARKETING', isGranted: true }],
  orders: [{ status: 'PAID' }], referralsMade: [{}], promotionParticipations: [{}], gameActivities: [{}],
};
function customerService(events = []) {
  return new ExternalChannelService({ repository: new ExternalChannelRepository(), customerRepository: { findCustomer: async (id) => id === customer.id ? customer : null }, eventPublisher: { publish: async (e) => events.push(e) }, clock: () => new Date('2026-07-24T12:00:00Z') });
}
test('VK: ручной профиль, подписка и согласие остаются разными фактами', async () => {
  const events = []; const service = customerService(events);
  const profile = await service.saveManualProfile(customer.id, { channelType: 'VK', externalUserId: 'vk-42', profileUrl: 'https://vk.com/id42', displayName: 'Иван', auditReason: 'Перенос обращения' }, admin);
  const subscription = await service.saveManualSubscription(customer.id, { channelType: 'VK', targetType: 'COMMUNITY', targetExternalId: 'club1', targetName: 'У Тимоши', isSubscribed: true, auditReason: 'Со слов клиента' }, admin);
  assert.equal(profile.source, 'MANUAL'); assert.equal(profile.isVerified, false); assert.equal(subscription.verificationStatus, 'NOT_VERIFIED');
  assert.equal(customer.consents[0].isGranted, true); assert.notEqual(profile.id, subscription.id);
  assert.deepEqual(events.map((x) => x.eventType), ['CUSTOMER_EXTERNAL_PROFILE_LINKED', 'CUSTOMER_CHANNEL_SUBSCRIPTION_CHANGED']);
});
test('VK adapter без credentials сообщает BLOCKED_EXTERNAL, mock детерминирован', async () => {
  const blocked = new (require('../src/modules/customer_360').VkExternalChannelAdapter)();
  await assert.rejects(() => blocked.getProfile(), /BLOCKED_EXTERNAL/);
  assert.equal((await new MockVkExternalChannelAdapter({ customer_1: { profile: { externalUserId: '1' } } }).getProfile('customer_1')).externalUserId, '1');
});
test('индекс вовлечённости детерминирован и объясним', async () => {
  const service = customerService();
  await service.saveManualProfile(customer.id, { channelType: 'VK', auditReason: 'Проверка' }, admin);
  const summary = await service.engagement(customer.id, admin);
  assert.equal(summary.modelVersion, 'deterministic-v1'); assert.ok(summary.score >= 44); assert.equal(summary.factors.length, 12);
  assert.ok(summary.factors.every((x) => typeof x.explanation === 'string' && Number.isInteger(x.contribution)));
  assert.ok(Object.isFrozen(summary));
});
test('ручные mutation запрещены оператору', async () => {
  await assert.rejects(() => customerService().saveManualProfile(customer.id, { channelType: 'VK', auditReason: 'x' }, { roles: ['OPERATOR'] }), (error) => error.statusCode === 403);
});
test('SIM, тариф, предупреждения, события и маскирование телефона', async () => {
  const events = []; const repository = new MachineConnectivityRepository();
  const service = new MachineConnectivityService({ repository, eventPublisher: { publish: async (e) => events.push(e) }, clock: () => new Date('2026-07-24T12:00:00Z') });
  await service.saveSim('machine_1', { phoneNumber: '+79991231234', carrierName: 'МТС', iccid: 'iccid', imsi: 'imsi', lastCheckedAt: '2026-07-01T00:00:00Z', auditReason: 'Регистрация SIM' }, admin);
  await service.savePlan('machine_1', { tariffName: 'Телематика', tariffStatus: 'SUSPENDED', currentBalance: 10, minimumBalanceThreshold: 100, trafficLimitMb: 10000, trafficRemainingMb: 100, currency: 'RUB', auditReason: 'Сверка тарифа' }, admin);
  const view = service.connectivity('machine_1', { roles: ['ADMIN'], actorId: 'admin' });
  assert.equal(view.simCard.phoneNumber, '+7 *** ***-12-34'); assert.equal(view.simCard.iccid, undefined);
  assert.ok(view.warnings.some((x) => x.code === 'LOW_BALANCE')); assert.ok(view.warnings.some((x) => x.code === 'LOW_TRAFFIC')); assert.ok(view.warnings.some((x) => x.code === 'STALE'));
  assert.ok(events.some((x) => x.eventType === 'MACHINE_MOBILE_PLAN_SUSPENDED'));
  assert.equal(maskPhone('+79991231234'), '+7 *** ***-12-34');
});
test('PLATFORM_OWNER видит технические идентификаторы, оператор не меняет тариф', async () => {
  const service = new MachineConnectivityService({ repository: new MachineConnectivityRepository() });
  await service.saveSim('m', { phoneNumber: '+79991231234', iccid: '1', imsi: '2', auditReason: 'x' }, { roles: ['PLATFORM_OWNER'], actorId: 'owner' });
  assert.equal(service.getSim('m', { roles: ['PLATFORM_OWNER'] }).iccid, '1');
  await assert.rejects(() => service.savePlan('m', { auditReason: 'x' }, { roles: ['OPERATOR'] }), (error) => error.statusCode === 403);
  assert.equal(await new MockMobileCarrierAdapter({ m: { currentBalance: 50 } }).getBalance('m'), 50);
});
