'use strict';

class PricingRepository {
  constructor(prisma) {
    if (!prisma) throw new Error('Prisma client is required.');
    this.prisma = prisma;
  }

  async saveQuote(quote) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.pricingQuote.create({
        data: {
          id: quote.id,
          customerId: quote.customerId,
          machineId: quote.machineId,
          channel: quote.channel,
          currency: quote.currency,
          baseAmount: quote.baseAmount,
          giftAmount: quote.giftAmount,
          promotionDiscountAmount: quote.promotionDiscountAmount,
          finalAmount: quote.finalAmount,
          bonusPaymentAllowed: quote.bonusPaymentAllowed,
          partialBonusPaymentAllowed: quote.partialBonusPaymentAllowed,
          transferAllowed: quote.transferAllowed,
          paymentRequired: quote.paymentRequired,
          campaignId: quote.campaignId,
          promotionVersionId: quote.promotionVersionId,
          createdAt: quote.createdAt,
          lockedUntil: quote.lockedUntil,
          metadata: { rules: quote.rules },
        },
      });

      const snapshot = await tx.pricingSnapshot.create({
        data: {
          quoteId: created.id,
          currency: quote.currency,
          baseAmount: quote.baseAmount,
          giftAmount: quote.giftAmount,
          promotionDiscountAmount: quote.promotionDiscountAmount,
          bonusAmount: 0,
          finalAmount: quote.finalAmount,
          pricingRuleVersion: 'pricing-v1',
          lockedUntil: quote.lockedUntil,
          rules: quote.rules,
          items: {
            create: quote.items.map((item) => ({
              itemId: item.itemId,
              sku: item.sku,
              name: item.name,
              quantity: item.quantity,
              baseAmount: item.baseAmount,
              giftAmount: item.giftAmount,
              promotionDiscountAmount: item.promotionDiscountAmount,
              finalAmount: item.finalAmount,
              giftApplied: item.giftApplied,
              campaignId: item.campaignId,
              promotionVersionId: item.promotionVersionId,
            })),
          },
        },
        include: { items: true },
      });

      return { ...created, items: snapshot.items, snapshotId: snapshot.id, rules: quote.rules };
    });
  }

  async getQuote(id) {
    const row = await this.prisma.pricingQuote.findUnique({
      where: { id },
      include: { snapshot: { include: { items: true } } },
    });
    if (!row) return null;
    return { ...row, items: row.snapshot?.items || [], snapshotId: row.snapshot?.id || null, rules: row.snapshot?.rules || row.metadata?.rules || {} };
  }

  async consumeQuote(id, consumedAt) {
    return this.prisma.pricingQuote.update({ where: { id }, data: { consumedAt } });
  }
}

module.exports = { PricingRepository };
