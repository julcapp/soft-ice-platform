'use strict';

const crypto = require('crypto');

class FiftiethPurchaseGiftResolver {
  constructor({ prisma, itemSelector } = {}) {
    if (!prisma) throw new Error('Prisma client is required.');
    this.prisma = prisma;
    this.itemSelector = itemSelector || ((items) => items.find((item) => item.serverProductType === 'ICE_CREAM'));
  }

  async resolve({ quoteId, customerId, machineId, items, lockedUntil }) {
    if (!customerId || !machineId || !quoteId) return { giftItemIds: [], eligible: false };
    const giftItem = this.itemSelector(items || []);
    if (!giftItem?.id) return { giftItemIds: [], eligible: false, reason: 'NO_SERVER_VERIFIED_ICE_CREAM_ITEM' };

    return this.prisma.$transaction(async (tx) => {
      const counter = await tx.customerMachineRewardCounter.upsert({
        where: { customerId_machineId: { customerId, machineId } },
        create: { id: `cmrc_${crypto.randomUUID()}`, customerId, machineId, completedPurchases: 0 },
        update: {},
      });
      const ordinal = counter.completedPurchases + 1;
      if (ordinal % 50 !== 0) return { giftItemIds: [], eligible: false, purchaseOrdinal: ordinal };

      const activeReservation = await tx.giftRewardReservation.findFirst({
        where: { customerId, machineId, status: 'RESERVED', expiresAt: { gt: new Date() } },
        orderBy: { reservedAt: 'desc' },
      });
      if (activeReservation && activeReservation.quoteId !== quoteId) {
        return { giftItemIds: [], eligible: false, purchaseOrdinal: ordinal, reason: 'GIFT_ALREADY_RESERVED' };
      }

      if (!activeReservation) {
        await tx.giftRewardReservation.create({
          data: {
            id: `giftres_${crypto.randomUUID()}`,
            quoteId,
            customerId,
            machineId,
            purchaseOrdinal: ordinal,
            itemId: giftItem.id,
            status: 'RESERVED',
            expiresAt: lockedUntil,
            metadata: { source: 'FIFTIETH_PURCHASE_PER_MACHINE' },
          },
        });
      }
      return { giftItemIds: [giftItem.id], eligible: true, purchaseOrdinal: ordinal };
    });
  }

  async consume({ quoteId, orderId }) {
    const reservation = await this.prisma.giftRewardReservation.findUnique({ where: { quoteId } });
    if (!reservation || reservation.status !== 'RESERVED') return null;
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      if (reservation.expiresAt <= now) {
        await tx.giftRewardReservation.update({ where: { quoteId }, data: { status: 'RELEASED' } });
        return null;
      }
      await tx.giftRewardReservation.update({ where: { quoteId }, data: { status: 'CONSUMED', consumedAt: now, orderId } });
      return reservation;
    });
  }

  async completePurchase({ customerId, machineId, orderId }) {
    if (!customerId || !machineId || !orderId) return null;
    return this.prisma.customerMachineRewardCounter.upsert({
      where: { customerId_machineId: { customerId, machineId } },
      create: { id: `cmrc_${crypto.randomUUID()}`, customerId, machineId, completedPurchases: 1, lastCompletedOrderId: orderId },
      update: { completedPurchases: { increment: 1 }, lastCompletedOrderId: orderId },
    });
  }
}

module.exports = { FiftiethPurchaseGiftResolver };
