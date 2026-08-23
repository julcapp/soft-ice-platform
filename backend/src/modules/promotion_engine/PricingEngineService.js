'use strict';

const crypto = require('crypto');

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw Object.assign(new Error('Invalid money value.'), { code: 'PRICING_INVALID_AMOUNT', statusCode: 400 });
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function ruleValue(version, type) {
  const row = (version?.rules || []).find((item) => item.ruleType === type);
  if (!row) return undefined;
  return row.value && typeof row.value === 'object' && Object.prototype.hasOwnProperty.call(row.value, 'value') ? row.value.value : row.value;
}

class PricingEngineService {
  constructor({ repository, promotionResolver, giftResolver, safetyService, clock = () => new Date() } = {}) {
    if (!repository) throw new Error('Pricing repository is required.');
    if (!promotionResolver) throw new Error('Promotion resolver is required.');
    this.repository = repository;
    this.promotionResolver = promotionResolver;
    this.giftResolver = giftResolver || { resolve: async () => ({ giftItemIds: [] }), consume: async () => null };
    this.safetyService = safetyService || null;
    this.clock = clock;
  }

  async createQuote({ customerId = null, machineId, channel, items = [] }) {
    if (!machineId) throw this._error('PRICING_MACHINE_REQUIRED', 'machineId is required.', 400);
    if (!channel) throw this._error('PRICING_CHANNEL_REQUIRED', 'channel is required.', 400);
    if (!Array.isArray(items) || items.length === 0) throw this._error('PRICING_ITEMS_REQUIRED', 'At least one item is required.', 400);

    const now = this.clock();
    const quoteId = `quote_${crypto.randomUUID()}`;
    const normalizedItems = items.map((item, index) => {
      const quantity = Number(item.quantity ?? 1);
      if (!Number.isInteger(quantity) || quantity <= 0) throw this._error('PRICING_INVALID_QUANTITY', `Invalid quantity at items[${index}].`, 400);
      return { ...item, quantity, unitPrice: money(item.unitPrice), baseAmount: money(item.unitPrice * quantity) };
    });

    const promotion = await this.promotionResolver.resolve({ customerId, machineId, channel, at: now, items: normalizedItems });
    const lockSeconds = Number(promotion?.currentVersion?.priceLockSeconds || 300);
    const lockedUntil = new Date(now.getTime() + lockSeconds * 1000);
    const gift = await this.giftResolver.resolve({ quoteId, customerId, machineId, items: normalizedItems, at: now, lockedUntil });
    const giftIds = new Set(gift?.giftItemIds || []);

    let baseAmount = 0;
    let giftAmount = 0;
    let promotionDiscountAmount = 0;

    const pricedItems = normalizedItems.map((item) => {
      baseAmount = money(baseAmount + item.baseAmount);
      const giftApplied = giftIds.has(item.id);
      const itemGift = giftApplied ? item.baseAmount : 0;
      giftAmount = money(giftAmount + itemGift);
      const paidBase = money(item.baseAmount - itemGift);
      let promoDiscount = 0;
      if (promotion && paidBase > 0 && promotion.currentVersion?.benefitType === 'PERCENT_DISCOUNT') {
        promoDiscount = money(paidBase * Number(promotion.currentVersion.benefitValue) / 100);
      }
      promotionDiscountAmount = money(promotionDiscountAmount + promoDiscount);
      return {
        itemId: item.id || null,
        sku: item.sku || null,
        name: item.name || null,
        quantity: item.quantity,
        baseAmount: item.baseAmount,
        giftAmount: itemGift,
        promotionDiscountAmount: promoDiscount,
        finalAmount: money(paidBase - promoDiscount),
        giftApplied,
        campaignId: promotion?.id || null,
        promotionVersionId: promotion?.currentVersion?.id || null,
      };
    });

    const finalAmount = money(baseAmount - giftAmount - promotionDiscountAmount);
    const bonusRule = promotion ? ruleValue(promotion.currentVersion, 'BONUS_PAYMENT') : undefined;
    const transferRule = promotion ? ruleValue(promotion.currentVersion, 'THIRD_PARTY_TRANSFER') : undefined;
    const partialBonusPaymentAllowed = bonusRule !== 'FORBIDDEN';
    const transferAllowed = transferRule !== 'FORBIDDEN';
    const paymentRequired = finalAmount > 0;

    if (promotion && this.safetyService) {
      const safety = this.safetyService.evaluate({
        version: promotion.currentVersion,
        baseAmount,
        discountAmount: promotionDiscountAmount,
        finalAmount,
        applicationsCount: promotion.metrics?.applicationsCount || 0,
        discountSpent: promotion.metrics?.discountSpent || 0,
      });
      if (safety?.blocking) throw this._error('PRICING_PROMOTION_SAFETY_BLOCK', 'Promotion pricing is blocked by safety policy.', 409, safety.issues || []);
    }

    const quote = {
      id: quoteId,
      customerId,
      machineId,
      channel,
      currency: 'RUB',
      baseAmount,
      giftAmount,
      promotionDiscountAmount,
      finalAmount,
      bonusPaymentAllowed: true,
      partialBonusPaymentAllowed,
      transferAllowed,
      paymentRequired,
      campaignId: promotion?.id || null,
      promotionVersionId: promotion?.currentVersion?.id || null,
      createdAt: now,
      lockedUntil,
      items: pricedItems,
      rules: {
        giftFirst: true,
        promotionOnPaidItemsOnly: true,
        moneyDiscountStacking: promotion ? ruleValue(promotion.currentVersion, 'MONEY_DISCOUNT_STACKING') : null,
        giftPurchaseOrdinal: gift?.purchaseOrdinal || null,
      },
    };
    return this.repository.saveQuote(quote);
  }

  async getValidQuote(quoteId) {
    const quote = await this.repository.getQuote(quoteId);
    if (!quote) throw this._error('PRICING_QUOTE_NOT_FOUND', 'Pricing quote not found.', 404);
    if (quote.consumedAt) throw this._error('PRICING_QUOTE_ALREADY_CONSUMED', 'Pricing quote has already been consumed.', 409);
    if (new Date(quote.lockedUntil) <= this.clock()) throw this._error('PRICING_QUOTE_EXPIRED', 'Pricing quote lock has expired.', 409);
    return quote;
  }

  async consumeQuote(quoteId, { orderId = null } = {}) {
    const quote = await this.getValidQuote(quoteId);
    const consumed = await this.repository.consumeQuote(quoteId, this.clock(), orderId);
    if (orderId && this.giftResolver?.consume) await this.giftResolver.consume({ quoteId, orderId });
    return { ...consumed, quote };
  }

  _error(code, message, statusCode, details = []) {
    const error = new Error(message); error.code = code; error.statusCode = statusCode; error.details = details; error.source = 'pricing_engine'; return error;
  }
}

module.exports = { PricingEngineService, money, ruleValue };
