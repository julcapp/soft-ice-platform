const test = require('node:test');
const assert = require('node:assert/strict');
const { AdminOperationsEscalationDeliveryService } = require('../src/modules/admin_dashboard/AdminOperationsEscalationDeliveryService');

test('queues L1 escalation to verified active Telegram channel idempotently', async () => {
  const executed = [];
  const prisma = {
    $queryRawUnsafe: async (sql) => {
      const text = String(sql);
      if (text.includes('FROM "AdminOperationsEscalation"')) return [{ id: 'e1', workItemId: 'w1', level: 1, recipientSubject: 'user-1', title: 'Ошибка автомата', message: 'Нет связи', reason: 'SLA принятия просрочен', deepLink: '#machine-runtime/m1' }];
      if (text.includes('CustomerChannelSubscription')) return [{ channelType: 'TELEGRAM' }];
      if (text.includes('CustomerExternalProfile')) return [{ channelType: 'TELEGRAM', externalUserId: 'tg-1', isVerified: true, status: 'ACTIVE' }];
      if (text.includes('FROM "Customer"')) return [{ telegramId: 'tg-1' }];
      if (text.includes('CrmNotificationDelivery')) return [];
      return [];
    },
    $executeRawUnsafe: async (...args) => { executed.push(args); return 1; },
  };
  const service = new AdminOperationsEscalationDeliveryService({ prisma, specialistDirectory: { getBySubject: async () => null } });
  const result = await service.run();
  assert.equal(result.queued, 1);
  assert.equal(result.blocked, 0);
  assert.ok(executed.some((call) => String(call[0]).includes('CrmNotificationDelivery')));
  assert.ok(executed.some((call) => String(call[0]).includes('AdminOperationsEscalationDelivery')));
});

test('blocks L2 delivery when platform owner user id is not configured', async () => {
  const executed = [];
  const prisma = {
    $queryRawUnsafe: async (sql) => String(sql).includes('FROM "AdminOperationsEscalation"') ? [{ id: 'e2', level: 2, recipientSubject: 'role:PLATFORM_OWNER', title: 'Критическая эскалация' }] : [],
    $executeRawUnsafe: async (...args) => { executed.push(args); return 1; },
  };
  const service = new AdminOperationsEscalationDeliveryService({ prisma, specialistDirectory: { getBySubject: async () => null }, ownerUserId: null });
  const result = await service.run();
  assert.equal(result.blocked, 1);
  assert.match(String(executed[0][0]), /AdminOperationsEscalationDelivery/);
});
