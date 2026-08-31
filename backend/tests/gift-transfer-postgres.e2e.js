'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaGiftTransferRepository } = require('../src/modules/gift_transfer');

test('Gift Transfer aggregate and delivery attempts survive repository recreation', async () => {
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  const giftId = `gift_${suffix}`;
  const notificationId = `notification_${suffix}`;
  const correlationId = `corr_${suffix}`;
  const now = new Date('2026-08-31T07:00:00Z');
  const repository = new PrismaGiftTransferRepository(prisma);
  const transfer = {
    id: giftId, originalOrderId: `order_${suffix}`, senderCustomerId: `sender_${suffix}`,
    recipientCustomerId: `recipient_${suffix}`, recipientPhoneNormalized: '+79990000002',
    status: 'AVAILABLE', referralId: `referral_${suffix}`, invitationTokenHash: `hash_${suffix}`,
    expiresAt: new Date('2026-09-01T07:00:00Z'), createdAt: now, acceptedAt: null,
    redeemedAt: null, expiredAt: null, cancelledAt: null, transferredBy: `sender_${suffix}`,
    correlationId, metadata: { senderName: 'Тест' },
  };
  const invitation = {
    id: `invitation_${suffix}`, giftTransferId: giftId, recipientPhoneNormalized: '+79990000002',
    tokenHash: `token_${suffix}`, expiresAt: transfer.expiresAt, status: 'CREATED',
    createdAt: now, acceptedAt: null, metadata: {},
  };
  const referral = {
    id: `referral_${suffix}`, giftTransferId: giftId, referralId: `referral_${suffix}`,
    referralSource: 'GIFT_TRANSFER', stage: 'INVITED', referrerCustomerId: `sender_${suffix}`,
    referredCustomerId: `recipient_${suffix}`, firstOwnPurchaseAt: null, createdAt: now, metadata: {},
  };

  try {
    await repository.createGiftBundle({ transfer, invitation, referral });

    const restartedRepository = new PrismaGiftTransferRepository(prisma);
    const restored = await restartedRepository.findById(giftId);
    assert.equal(restored.status, 'AVAILABLE');
    assert.equal(restored.recipientCustomerId, transfer.recipientCustomerId);

    restored.status = 'ACCEPTED';
    restored.acceptedAt = new Date('2026-08-31T07:01:00Z');
    referral.stage = 'GIFT_ACCEPTED';
    await restartedRepository.persistAcceptance({ transfer: restored, referral });
    assert.equal((await repository.findById(giftId)).status, 'ACCEPTED');
    assert.equal((await repository.findReferralByGiftTransferId(giftId)).stage, 'GIFT_ACCEPTED');

    await repository.saveDelivery({ id: `delivery_1_${suffix}`, notificationId, recipientCustomerId: transfer.recipientCustomerId, channel: 'TELEGRAM', status: 'SENT', attemptedAt: now, correlationId, metadata: {} });
    await restartedRepository.saveDelivery({ id: `delivery_2_${suffix}`, notificationId, recipientCustomerId: transfer.recipientCustomerId, channel: 'TELEGRAM', status: 'DELIVERED', attemptedAt: now, deliveredAt: now, correlationId, metadata: {} });
    const deliveries = await repository.listDeliveries(notificationId);
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].status, 'DELIVERED');
  } finally {
    await prisma.notificationDeliveryAttempt.deleteMany({ where: { notificationId } });
    await prisma.giftRecipientClaim.deleteMany({ where: { giftTransferId: giftId } });
    await prisma.giftRedemption.deleteMany({ where: { giftTransferId: giftId } });
    await prisma.giftReferralLink.deleteMany({ where: { giftTransferId: giftId } });
    await prisma.giftInvitation.deleteMany({ where: { giftTransferId: giftId } });
    await prisma.giftTransfer.deleteMany({ where: { id: giftId } });
    await prisma.$disconnect();
  }
});
