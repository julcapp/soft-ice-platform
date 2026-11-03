const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CustomerProfileCommunicationService,
} = require('../src/modules/customer_profile/CustomerProfileCommunicationService');

test('requestEmailVerification does not write unverified email into Customer', async () => {
  const updates = [];
  const rawExec = [];
  const service = new CustomerProfileCommunicationService({
    prisma: {
      customer: {
        update: async (input) => {
          updates.push(input);
          return input.data;
        },
      },
      $executeRaw: async (...args) => {
        rawExec.push(args);
        return 1;
      },
      $queryRaw: async () => [],
    },
    clock: () => new Date('2026-11-03T08:00:00.000Z'),
  });

  const result = await service.requestEmailVerification('customer-1', 'Pending@Example.com');

  assert.equal(result.email, 'pending@example.com');
  assert.equal(updates.length, 0);
  assert.ok(rawExec.length >= 2);
});

test('updateProfile rejects direct email mutation', async () => {
  const service = new CustomerProfileCommunicationService({
    prisma: {
      customer: {
        update: async () => {
          throw new Error('must not update');
        },
      },
    },
  });

  await assert.rejects(
    () => service.updateProfile('customer-1', { email: 'new@example.com' }),
    (error) => error.code === 'CUSTOMER_EMAIL_REQUIRES_VERIFICATION',
  );
});

test('confirmEmailVerification writes email only after a valid pending token', async () => {
  const crypto = require('crypto');
  const token = 'verification-token';
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const now = new Date('2026-11-03T08:00:00.000Z');
  const customerUpdates = [];
  const service = new CustomerProfileCommunicationService({
    prisma: {
      $queryRaw: async (...args) => {
        const text = String(args[0]?.strings?.join('') || args[0] || '');
        if (text.includes('CustomerEmailVerification')) {
          return [{
            id: 'verification-1',
            customerId: 'customer-1',
            email: 'verified@example.com',
            tokenHash,
            status: 'PENDING',
            expiresAt: new Date('2026-11-04T08:00:00.000Z'),
          }];
        }
        return [];
      },
      $executeRaw: async () => 1,
      $transaction: async (callback) => callback({
        $executeRaw: async () => 1,
        customer: {
          update: async (input) => {
            customerUpdates.push(input);
            return input.data;
          },
        },
      }),
    },
    clock: () => now,
  });

  const result = await service.confirmEmailVerification(token);

  assert.equal(result.verified, true);
  assert.equal(result.email, 'verified@example.com');
  assert.equal(customerUpdates.length, 1);
  assert.deepEqual(customerUpdates[0].data, { email: 'verified@example.com' });
});
