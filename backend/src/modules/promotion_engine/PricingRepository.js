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
          items: { create: this._snapshotItems(quote.items) },
        },
        include: { items: true },
      });

      return { ...created, items: snapshot.items, snapshotId: snapshot.id, rules: quote.rules };
    });
  }

  async replaceQuotePricing(quoteId, quote) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.pricingQuote.findUnique({ where: { id: quoteId } });
      if (!existing || existing.consumedAt) {
        const error = new Error('Pricing quote cannot be repriced.');
        error.code = 'PRICING_QUOTE_REPRICE_CONFLICT';
        error.statusCode = 409;
        error.source = 'pricing_engine';
        throw error;
      }

      await tx.pricingQuote.update({
        where: { id: quoteId },
        data: {
          baseAmount: quote.baseAmount,
          giftAmount: quote.giftAmount,
          promotionDiscountAmount: quote.promotionDiscountAmount,
          finalAmount: quote.finalAmount,
          bonusPaymentAllowed: quote.bonusPaymentAllowed,
          partialBonusPaymentAllowed: quote.partialBonusPaymentAllowed,
          transferAllowed: quote.transferAllowed,
          paymentRequired: quote.paymentRequired,
          metadata: { rules: quote.rules },
        },
      });

      const snapshot = await tx.pricingSnapshot.findUnique({ where: { quoteId } });
      if (!snapshot) throw new Error('Pricing snapshot not found for quote.');
      await tx.pricingSnapshotItem.deleteMany({ where: { pricingSnapshotId: snapshot.id } });
      await tx.pricingSnapshot.update({
        where: { id: snapshot.id },
        data: {
          baseAmount: quote.baseAmount,
          giftAmount: quote.giftAmount,
          promotionDiscountAmount: quote.promotionDiscountAmount,
          finalAmount: quote.finalAmount,
          rules: quote.rules,
        },
      });
      if (quote.items.length) {
        await tx.pricingSnapshotItem.createMany({
          data: this._snapshotItems(quote.items).map((item) => ({ ...item, pricingSnapshotId: snapshot.id })),
        });
      }
      return this.getQuote(quoteId, tx);
    });
  }

  async getQuote(id, client = this.prisma) {
    const row = await client.pricingQuote.findUnique({
      where: { id },
      include: { snapshot: { include: { items: true } } },
    });
    if (!row) return null;
    return { ...row, items: row.snapshot?.items || [], snapshotId: row.snapshot?.id || null, rules: row.snapshot?.rules || row.metadata?.rules || {} };
  }

  async getQuoteByOrderId(orderId) {
    if (!orderId) return null;
    const row = await this.prisma.pricingQuote.findUnique({
      where: { orderId },
      include: { snapshot: { include: { items: true } } },
    });
    if (!row) return null;
    return { ...row, items: row.snapshot?.items || [], snapshotId: row.snapshot?.id || null, rules: row.snapshot?.rules || row.metadata?.rules || {} };
  }

  async consumeQuote(id, consumedAt, orderId = null) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.pricingQuote.updateMany({
        where: { id, consumedAt: null, lockedUntil: { gt: consumedAt } },
        data: { consumedAt, orderId },
      });
      if (result.count !== 1) {
        const error = new Error('Pricing quote cannot be consumed.');
        error.code = 'PRICING_QUOTE_CONSUME_CONFLICT';
        error.statusCode = 409;
        error.source = 'pricing_engine';
        throw error;
      }
      if (orderId) {
        await tx.pricingSnapshot.update({ where: { quoteId: id }, data: { orderId } });
        const quote = await tx.pricingQuote.findUnique({ where: { id } });
        const snapshot = await tx.pricingSnapshot.findUnique({ where: { quoteId: id }, include: { items: true } });
        if (quote?.campaignId && quote?.promotionVersionId && quote?.customerId) {
          await tx.promotionApplication.create({
            data: {
              orderId,
              customerId: quote.customerId,
              machineId: quote.machineId,
              campaignId: quote.campaignId,
              promotionVersionId: quote.promotionVersionId,
              baseAmount: quote.baseAmount,
              discountAmount: quote.promotionDiscountAmount,
              finalAmount: quote.finalAmount,
              pricingSnapshotId: snapshot?.id || null,
              appliedItems: snapshot?.items || undefined,
              reason: 'PRICING_QUOTE_CONSUMED',
            },
          });
        }
      }
      return tx.pricingQuote.findUnique({ where: { id } });
    });
  }

  _snapshotItems(items) {
    return (items || []).map((item) => ({
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
    }));
  }
}

module.exports = { PricingRepository };
