'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaGiftTransferRepository } = require('../src/modules/gift_transfer');

function fixture() {
  const calls = [];
  const delegate = (name) => ({
    create: async (args) => (calls.push([name, 'create', args]), args.data),
    update: async (args) => (calls.push([name, 'update', args]), { id: args.where.id || args.where.giftTransferId, ...args.data }),
    upsert: async (args) => (calls.push([name, 'upsert', args]), args.create),
    findUnique: async (args) => (calls.push([name, 'findUnique', args]), null),
    findFirst: async (args) => (calls.push([name, 'findFirst', args]), null),
    findMany: async (args) => (calls.push([name, 'findMany', args]), []),
  });
  const prisma = {
    giftTransfer: delegate('giftTransfer'),
    giftInvitation: delegate('giftInvitation'),
    giftRecipientClaim: delegate('giftRecipientClaim'),
    giftRedemption: delegate('giftRedemption'),
    giftReferralLink: delegate('giftReferralLink'),
    notificationDeliveryAttempt: delegate('notificationDeliveryAttempt'),
  };
  prisma.$transaction = async (operation) => operation(prisma);
  return { repository: new PrismaGiftTransferRepository(prisma), calls };
}

test('Prisma gift repository creates transfer aggregate in one transaction contract', async () => {
  const { repository, calls } = fixture();
  const transfer = { id: 'gift_1', originalOrderId: 'order-1', senderCustomerId: 'sender', recipientCustomerId: 'recipient', recipientPhoneNormalized: '+79990000002', status: 'AVAILABLE', referralId: 'ref-1', invitationTokenHash: 'hash', expiresAt: new Date(), createdAt: new Date(), acceptedAt: null, redeemedAt: null, expiredAt: null, cancelledAt: null, transferredBy: 'sender', correlationId: 'corr', metadata: {} };
  const invitation = { id: 'invitation-1', giftTransferId: transfer.id, recipientPhoneNormalized: '+79990000002', tokenHash: 'hash', expiresAt: transfer.expiresAt, status: 'CREATED', createdAt: transfer.createdAt, acceptedAt: null, metadata: {} };
  const referral = { id: 'ref-1', giftTransferId: transfer.id, referralId: 'ref-1', referralSource: 'GIFT_TRANSFER', stage: 'INVITED', referrerCustomerId: 'sender', referredCustomerId: 'recipient', firstOwnPurchaseAt: null, createdAt: transfer.createdAt, metadata: {} };

  await repository.createGiftBundle({ transfer, invitation, referral });

  assert.deepEqual(calls.map(([name, operation]) => [name, operation]), [
    ['giftTransfer', 'create'],
    ['giftInvitation', 'create'],
    ['giftReferralLink', 'create'],
  ]);
  assert.equal(repository.persistenceMode, 'POSTGRESQL');
});

test('delivery attempts are idempotent by notification and channel', async () => {
  const { repository, calls } = fixture();
  await repository.saveDelivery({ id: 'delivery-1', notificationId: 'notification-1', channel: 'TELEGRAM', status: 'SENT', attemptedAt: new Date(), correlationId: 'corr', metadata: {} });
  const upsert = calls.find(([name, operation]) => name === 'notificationDeliveryAttempt' && operation === 'upsert')[2];
  assert.deepEqual(upsert.where, { notificationId_channel: { notificationId: 'notification-1', channel: 'TELEGRAM' } });
  assert.equal('id' in upsert.update, false);
});

test('active gift lookup excludes terminal states through an allow-list', async () => {
  const { repository, calls } = fixture();
  await repository.findActiveByOrderId('order-1');
  const query = calls.find(([name, operation]) => name === 'giftTransfer' && operation === 'findFirst')[2];
  assert.deepEqual(query.where.status.in, ['WAITING_FOR_REGISTRATION', 'AVAILABLE', 'ACCEPTED', 'REDEMPTION_READY']);
});
