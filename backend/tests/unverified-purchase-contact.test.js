const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { AesGcmValueCodec } = require('../src/platform/security/AesGcmValueCodec');
const {
  UnverifiedPurchaseContactService,
  PURCHASE_NOTIFICATION_STATUS,
  PURCHASE_NOTIFICATION_TYPE,
} = require('../src/modules/customer/UnverifiedPurchaseContactService');

class MemoryRepository {
  constructor() {
    this.contacts = new Map();
    this.notifications = [];
  }

  async findActive({ phoneFingerprint, machineId }) {
    return [...this.contacts.values()]
      .filter((item) => item.phoneFingerprint === phoneFingerprint
        && item.machineId === machineId
        && item.status === 'ACTIVE'
        && item.phoneStatus === 'UNVERIFIED')
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)[0] || null;
  }

  async create(data) {
    const row = { ...data, createdAt: data.createdAt || new Date(), updatedAt: data.updatedAt || new Date() };
    this.contacts.set(row.id, row);
    return row;
  }

  async update(id, data) {
    const current = this.contacts.get(id);
    const row = { ...current, ...data, updatedAt: new Date() };
    this.contacts.set(id, row);
    return row;
  }

  async findById(id) {
    return this.contacts.get(id) || null;
  }

  async findLatestByFingerprint(phoneFingerprint) {
    return [...this.contacts.values()]
      .filter((item) => item.phoneFingerprint === phoneFingerprint)
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)[0] || null;
  }

  async createNotification(data) {
    const row = { id: crypto.randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() };
    this.notifications.push(row);
    return row;
  }

  async updatePendingNotificationsForContact(contactId, data) {
    let count = 0;
    for (let i = 0; i < this.notifications.length; i += 1) {
      const current = this.notifications[i];
      if (current.contactId !== contactId) continue;
      if (!['PENDING_IDENTITY', 'PENDING_CONSENT', 'WAITING_RECEIPT'].includes(current.status)) continue;
      this.notifications[i] = { ...current, ...data, updatedAt: new Date() };
      count += 1;
    }
    return { count };
  }
}

function createService(repository = new MemoryRepository()) {
  const key = Buffer.alloc(32, 7).toString('base64');
  return {
    repository,
    service: new UnverifiedPurchaseContactService({
      repository,
      codec: new AesGcmValueCodec({ key }),
      fingerprintSecret: 'test-fingerprint-secret',
      clock: () => new Date('2026-10-06T05:00:00.000Z'),
      logger: { warn() {} },
    }),
  };
}

test('records an unverified terminal phone encrypted and masked', async () => {
  const { service } = createService();
  const row = await service.recordPhone({
    machineId: 'TEST-MACHINE-001',
    phone: '+79138207050',
  });

  assert.equal(row.phoneStatus, 'UNVERIFIED');
  assert.equal(row.status, 'ACTIVE');
  assert.equal(row.phoneMasked, '+7 913 ***-70-50');
  assert.notEqual(row.phoneCiphertext, '+79138207050');
  assert.equal(service.decryptPhone(row), '+79138207050');
  assert.match(row.phoneFingerprint, /^[a-f0-9]{64}$/);
});

test('reuses active unverified contact for repeated entry on the same machine', async () => {
  const { service, repository } = createService();
  const first = await service.recordPhone({
    machineId: 'TEST-MACHINE-001',
    phone: '8 (913) 820-70-50',
  });
  const second = await service.recordPhone({
    machineId: 'TEST-MACHINE-001',
    phone: '+7 913 820 70 50',
  });

  assert.equal(first.id, second.id);
  assert.equal(repository.contacts.size, 1);
});

test('creates three notification intents after completed purchase', async () => {
  const { service, repository } = createService();
  const contact = await service.recordPhone({
    machineId: 'TEST-MACHINE-001',
    phone: '+79138207050',
  });

  const result = await service.attachCompletedPurchase({
    contactId: contact.id,
    orderId: 'order-1',
    amountRub: 145,
    bonusAccrued: 25,
    bonusBalance: 25,
    receiptUrl: 'https://example.test/check/abc',
    correlationId: 'corr-1',
  });

  assert.equal(result.intents.length, 3);
  const byType = Object.fromEntries(result.intents.map((item) => [item.notificationType, item]));
  assert.equal(byType[PURCHASE_NOTIFICATION_TYPE.PURCHASE_COMPLETED].status, PURCHASE_NOTIFICATION_STATUS.PENDING_IDENTITY);
  assert.equal(byType[PURCHASE_NOTIFICATION_TYPE.FISCAL_RECEIPT_READY].status, PURCHASE_NOTIFICATION_STATUS.PENDING_IDENTITY);
  assert.equal(byType[PURCHASE_NOTIFICATION_TYPE.LOYALTY_ACCOUNT_INVITE].status, PURCHASE_NOTIFICATION_STATUS.PENDING_CONSENT);
  assert.equal(byType[PURCHASE_NOTIFICATION_TYPE.PURCHASE_COMPLETED].phoneMasked, '+7 913 ***-70-50');
});

test('linking verified phone attaches customer to prior contact and pending intents', async () => {
  const { service, repository } = createService();
  const contact = await service.recordPhone({
    machineId: 'TEST-MACHINE-001',
    phone: '+79138207050',
  });
  await service.attachCompletedPurchase({
    contactId: contact.id,
    orderId: 'order-2',
    amountRub: 95,
    bonusAccrued: 10,
    bonusBalance: 10,
  });

  const linked = await service.linkVerifiedPhone({
    phone: '+79138207050',
    customerId: 'customer-1',
  });

  assert.equal(linked.customerId, 'customer-1');
  assert.equal(linked.phoneStatus, 'VERIFIED');
  assert.equal(linked.status, 'LINKED');
  assert.ok(repository.notifications.every((item) => item.customerId === 'customer-1'));
  assert.ok(repository.notifications.every((item) => item.phoneStatus === 'VERIFIED'));
});
