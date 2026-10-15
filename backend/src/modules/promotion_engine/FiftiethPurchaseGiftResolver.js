'use strict';

const crypto = require('crypto');

class FiftiethPurchaseGiftResolver {
  constructor({ prisma, itemSelector, clock = () => new Date() } = {}) {
    if (!prisma) throw new Error('Prisma client is required.');
    if (typeof clock !== 'function') throw new Error('Clock must be a function.');
    this.prisma = prisma;
    this.clock = clock;
    this.itemSelector = itemSelector || ((items) => items.find((item) => item.serverProductType === 'ICE_CREAM'));
  }

  async resolve({ customerId, machineId, items }) {
    if (!customerId || !machineId) return { giftItemIds: [], eligible: false };
    const giftItem = this.itemSelector(items || []);
    if (!giftItem?.id) return { giftItemIds: [], eligible: false, reason: 'NO_SERVER_VERIFIED_ICE_CREAM_ITEM' };

    const counter = await this.prisma.customerMachineRewardCounter.findUnique({
      where: { customerId_machineId: { customerId, machineId } },
    });
    const ordinal = Number(counter?.completedPurchases || 0) + 1;
    if (ordinal % 50 !== 0) return { giftItemIds: [], eligible: false, purchaseOrdinal: ordinal };

    const activeReservation = await this.prisma.giftRewardReservation.findFirst({
      where: { customerId, machineId, status: 'RESERVED', expiresAt: { gt: this.clock() } },
      orderBy: { reservedAt: 'desc' },
    });
    if (activeReservation) {
      return { giftItemIds: [], eligible: false, purchaseOrdinal: ordinal, reason: 'GIFT_ALREADY_RESERVED' };
    }

    return {
      giftItemIds: [giftItem.id],
      eligible: true,
      purchaseOrdinal: ordinal,
      itemId: giftItem.id,
    };
  }

  async reserve({ quoteId, customerId, machineId, itemId, purchaseOrdinal, lockedUntil }) {
    if (!quoteId || !customerId || !machineId || !itemId || !purchaseOrdinal || !lockedUntil) return { reserved: false };
    try {
      return await this.prisma.$transaction(async (tx) => {
        const now = this.clock();
        await tx.giftRewardReservation.updateMany({
          where: { customerId, machineId, status: 'RESERVED', expiresAt: { lte: now } },
          data: { status: 'RELEASED' },
        });

        const counter = await tx.customerMachineRewardCounter.upsert({
          where: { customerId_machineId: { customerId, machineId } },
          create: { id: `cmrc_${crypto.randomUUID()}`, customerId, machineId, completedPurchases: 0 },
          update: {},
        });
        const currentOrdinal = counter.completedPurchases + 1;
        if (currentOrdinal !== purchaseOrdinal || currentOrdinal % 50 !== 0) {
          return { reserved: false, reason: 'GIFT_ORDINAL_CHANGED', purchaseOrdinal: currentOrdinal };
        }

        const activeReservation = await tx.giftRewardReservation.findFirst({
          where: { customerId, machineId, status: 'RESERVED', expiresAt: { gt: now } },
        });
        if (activeReservation) return { reserved: false, reason: 'GIFT_ALREADY_RESERVED' };

        const reservation = await tx.giftRewardReservation.create({
          data: {
            id: `giftres_${crypto.randomUUID()}`,
            quoteId,
            customerId,
            machineId,
            purchaseOrdinal,
            itemId,
            status: 'RESERVED',
            expiresAt: lockedUntil,
            metadata: { source: 'FIFTIETH_PURCHASE_PER_MACHINE' },
          },
        });
        return { reserved: true, reservation };
      });
    } catch (error) {
      if (error?.code === 'P2002') return { reserved: false, reason: 'GIFT_RESERVATION_CONFLICT' };
      throw error;
    }
  }

  async consume({ quoteId, orderId }) {
    const reservation = await this.prisma.giftRewardReservation.findUnique({ where: { quoteId } });
    if (!reservation || reservation.status !== 'RESERVED') return null;
    return this.prisma.$transaction(async (tx) => {
      const now = this.clock();
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
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.customerMachineRewardCounter.findUnique({ where: { customerId_machineId: { customerId, machineId } } });
      if (current?.lastCompletedOrderId === orderId) return current;
      if (!current) {
        return tx.customerMachineRewardCounter.create({
          data: { id: `cmrc_${crypto.randomUUID()}`, customerId, machineId, completedPurchases: 1, lastCompletedOrderId: orderId },
        });
      }
      return tx.customerMachineRewardCounter.update({
        where: { customerId_machineId: { customerId, machineId } },
        data: { completedPurchases: { increment: 1 }, lastCompletedOrderId: orderId },
      });
    });
  }
}

module.exports = { FiftiethPurchaseGiftResolver };
