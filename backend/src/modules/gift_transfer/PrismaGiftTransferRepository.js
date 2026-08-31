'use strict';

const ACTIVE_GIFT_STATUSES = ['WAITING_FOR_REGISTRATION', 'AVAILABLE', 'ACCEPTED', 'REDEMPTION_READY'];

class PrismaGiftTransferRepository {
  constructor(prisma) {
    if (!prisma) throw new Error('prisma is required.');
    this.prisma = prisma;
    this.persistenceMode = 'POSTGRESQL';
    this.implementationKind = 'PRODUCTION';
  }

  saveTransfer(value) {
    return this.prisma.giftTransfer.upsert({
      where: { id: value.id },
      create: transferData(value),
      update: withoutId(transferData(value)),
    });
  }

  saveInvitation(value) {
    return this.prisma.giftInvitation.upsert({
      where: { id: value.id },
      create: invitationData(value),
      update: withoutId(invitationData(value)),
    });
  }

  saveClaim(value) {
    return this.prisma.giftRecipientClaim.upsert({
      where: { giftTransferId: value.giftTransferId },
      create: claimData(value),
      update: withoutId(claimData(value)),
    });
  }

  saveRedemption(value) {
    return this.prisma.giftRedemption.upsert({
      where: { id: value.id },
      create: redemptionData(value),
      update: withoutId(redemptionData(value)),
    });
  }

  saveReferral(value) {
    return this.prisma.giftReferralLink.upsert({
      where: { giftTransferId: value.giftTransferId },
      create: referralData(value),
      update: withoutId(referralData(value)),
    });
  }

  saveDelivery(value) {
    return this.prisma.notificationDeliveryAttempt.upsert({
      where: { notificationId_channel: { notificationId: value.notificationId, channel: value.channel } },
      create: deliveryData(value),
      update: withoutId(deliveryData(value)),
    });
  }

  async createGiftBundle({ transfer, invitation, referral }) {
    return this.prisma.$transaction(async (tx) => {
      const createdTransfer = await tx.giftTransfer.create({ data: transferData(transfer) });
      const createdInvitation = await tx.giftInvitation.create({ data: invitationData(invitation) });
      const createdReferral = await tx.giftReferralLink.create({ data: referralData(referral) });
      return { transfer: createdTransfer, invitation: createdInvitation, referral: createdReferral };
    });
  }

  async persistClaim({ transfer, invitation, referral, claim }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.giftTransfer.update({ where: { id: transfer.id }, data: withoutId(transferData(transfer)) });
      await tx.giftInvitation.update({ where: { id: invitation.id }, data: withoutId(invitationData(invitation)) });
      if (referral) await tx.giftReferralLink.update({ where: { giftTransferId: transfer.id }, data: withoutId(referralData(referral)) });
      await tx.giftRecipientClaim.upsert({ where: { giftTransferId: transfer.id }, create: claimData(claim), update: withoutId(claimData(claim)) });
      return transfer;
    });
  }

  async persistAcceptance({ transfer, referral }) {
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.giftTransfer.update({ where: { id: transfer.id }, data: withoutId(transferData(transfer)) });
      if (referral) await tx.giftReferralLink.update({ where: { giftTransferId: transfer.id }, data: withoutId(referralData(referral)) });
      return saved;
    });
  }

  async persistRedemption({ transfer, redemption, referral = null }) {
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.giftTransfer.update({ where: { id: transfer.id }, data: withoutId(transferData(transfer)) });
      await tx.giftRedemption.upsert({ where: { id: redemption.id }, create: redemptionData(redemption), update: withoutId(redemptionData(redemption)) });
      if (referral) await tx.giftReferralLink.update({ where: { giftTransferId: transfer.id }, data: withoutId(referralData(referral)) });
      return saved;
    });
  }

  async persistCancellation({ transfer, invitation = null }) {
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.giftTransfer.update({ where: { id: transfer.id }, data: withoutId(transferData(transfer)) });
      if (invitation) await tx.giftInvitation.update({ where: { id: invitation.id }, data: withoutId(invitationData(invitation)) });
      return saved;
    });
  }

  findById(id) { return this.prisma.giftTransfer.findUnique({ where: { id } }); }
  findByOrderId(originalOrderId) { return this.prisma.giftTransfer.findUnique({ where: { originalOrderId } }); }
  findActiveByOrderId(originalOrderId) { return this.prisma.giftTransfer.findFirst({ where: { originalOrderId, status: { in: ACTIVE_GIFT_STATUSES } } }); }
  findInvitationByTokenHash(tokenHash) { return this.prisma.giftInvitation.findUnique({ where: { tokenHash } }); }
  findInvitationByGiftTransferId(giftTransferId) { return this.prisma.giftInvitation.findFirst({ where: { giftTransferId } }); }
  findPendingInvitationByPhone(recipientPhoneNormalized) { return this.prisma.giftInvitation.findFirst({ where: { recipientPhoneNormalized, status: { in: ['CREATED', 'SENT', 'OPENED'] } }, orderBy: { createdAt: 'desc' } }); }
  findReferralByGiftTransferId(giftTransferId) { return this.prisma.giftReferralLink.findUnique({ where: { giftTransferId } }); }
  findRedemptionByGiftTransferId(giftTransferId) { return this.prisma.giftRedemption.findFirst({ where: { giftTransferId }, orderBy: { issuedAt: 'desc' } }); }
  findRedemptionByAuthorizationHash(authorizationHash) { return this.prisma.giftRedemption.findUnique({ where: { authorizationHash } }); }
  listForCustomer(customerId) { return this.prisma.giftTransfer.findMany({ where: { OR: [{ senderCustomerId: customerId }, { recipientCustomerId: customerId }] }, orderBy: { createdAt: 'desc' } }); }
  list() { return this.prisma.giftTransfer.findMany({ orderBy: { createdAt: 'desc' } }); }
  listDeliveries(notificationId) { return this.prisma.notificationDeliveryAttempt.findMany({ where: { notificationId }, orderBy: { attemptedAt: 'asc' } }); }
  listDeliveriesByCorrelationId(correlationId) { return this.prisma.notificationDeliveryAttempt.findMany({ where: { correlationId }, orderBy: { attemptedAt: 'asc' } }); }
}

function transferData(value) {
  return pick(value, ['id', 'originalOrderId', 'senderCustomerId', 'recipientCustomerId', 'recipientPhoneNormalized', 'status', 'referralId', 'invitationTokenHash', 'expiresAt', 'createdAt', 'acceptedAt', 'redeemedAt', 'expiredAt', 'cancelledAt', 'transferredBy', 'correlationId', 'metadata']);
}
function invitationData(value) { return pick(value, ['id', 'giftTransferId', 'recipientPhoneNormalized', 'tokenHash', 'expiresAt', 'status', 'createdAt', 'acceptedAt', 'metadata']); }
function claimData(value) { return pick(value, ['id', 'giftTransferId', 'recipientCustomerId', 'verifiedPhoneNormalized', 'claimedAt', 'correlationId', 'metadata']); }
function redemptionData(value) { return pick(value, ['id', 'giftTransferId', 'recipientCustomerId', 'authorizationHash', 'status', 'issuedAt', 'expiresAt', 'usedAt', 'correlationId', 'metadata']); }
function referralData(value) { return pick(value, ['id', 'giftTransferId', 'referralId', 'referralSource', 'stage', 'referrerCustomerId', 'referredCustomerId', 'firstOwnPurchaseAt', 'createdAt', 'metadata']); }
function deliveryData(value) { return pick(value, ['id', 'notificationId', 'recipientCustomerId', 'channel', 'providerMessageId', 'status', 'attemptedAt', 'deliveredAt', 'openedAt', 'failedAt', 'failureCode', 'correlationId', 'metadata']); }
function pick(value, keys) { return Object.fromEntries(keys.filter((key) => value[key] !== undefined).map((key) => [key, value[key]])); }
function withoutId(value) { const { id, ...rest } = value; return rest; }

module.exports = { PrismaGiftTransferRepository, ACTIVE_GIFT_STATUSES };
