const test = require('node:test');
const assert = require('node:assert/strict');

const { CRMService } = require('../src/modules/crm/CRMService');

test('CRM email notification stores recipient and starts in PENDING state', async () => {
  let created = null;
  const repository = {
    createNotification: async (data) => {
      created = data;
      return { id: 'delivery-1', ...data };
    },
  };
  const service = new CRMService({
    repository,
    clubAccountRuntime: null,
    segmentationRuntime: null,
    auditRepository: null,
    eventPublisher: null,
  });
  service.getCustomerCard = async () => ({
    profile: {
      preferredChannel: 'MAX',
      communicationStatus: 'ALLOWED',
    },
  });

  const delivery = await service.queueNotification('customer-1', {
    channel: 'EMAIL',
    recipientAddress: 'pending@example.com',
    subject: 'Подтвердите email',
    body: 'Откройте ссылку',
  }, {
    actorId: 'customer-1',
    correlationId: 'corr-1',
    idempotencyKey: 'mail-1',
  });

  assert.equal(delivery.status, 'PENDING');
  assert.equal(created.recipientAddress, 'pending@example.com');
  assert.equal(created.channel, 'EMAIL');
});

test('CRM non-email notification keeps legacy QUEUED state', async () => {
  let created = null;
  const repository = {
    createNotification: async (data) => {
      created = data;
      return { id: 'delivery-2', ...data };
    },
  };
  const service = new CRMService({
    repository,
    clubAccountRuntime: null,
    segmentationRuntime: null,
    auditRepository: null,
    eventPublisher: null,
  });
  service.getCustomerCard = async () => ({
    profile: {
      preferredChannel: 'MAX',
      communicationStatus: 'ALLOWED',
    },
  });

  await service.queueNotification('customer-1', {
    channel: 'MAX',
    body: 'Сообщение',
  }, {
    actorId: 'customer-1',
    correlationId: 'corr-2',
  });

  assert.equal(created.status, 'QUEUED');
});
