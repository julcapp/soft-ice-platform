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

function ruleValueWithLegacyAlias(version, canonicalType, legacyType) {
  const canonical = ruleValue(version, canonicalType);
  return canonical === undefined && legacyType ? ruleValue(version, legacyType) : canonical;
}

class PricingEngineService {
  constructor({ repository, promotionResolver, giftResolver, safetyService, clock = () => new Date() } = {}) {
    if (!repository) throw new Error('Pricing repository is required.');
    if (!promotionResolver) throw new Error('Promotion resolver is required.');
    this.repository = repository;
    this.promotionResolver = promotionResolver;
    this.giftResolver = giftResolver || {
      resolve: async () => ({ giftItemIds: [] }),
      reserve: async () => ({ reserved: false }),
      consume: async () => null,
      completePurchase: async () => null,
    };
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
    const giftPreview = await this.giftResolver.resolve({ customerId, machineId, items: normalizedItems, at: now });

    let quote = this._buildQuote({
      quoteId,
      customerId,
      machineId,
      channel,
      now,
      lockedUntil,
      normalizedItems,
      promotion,
      gift: giftPreview,
    });

    await this._assertPromotionSafety(promotion, quote);
    let saved = await this.repository.saveQuote(quote);

    if (giftPreview?.eligible && giftPreview.itemId && typeof this.giftResolver.reserve === 'function') {
      const reservation = await this.giftResolver.reserve({
        quoteId,
        customerId,
        machineId,
        itemId: giftPreview.itemId,
        purchaseOrdinal: giftPreview.purchaseOrdinal,
        lockedUntil,
      });

      if (!reservation?.reserved) {
        quote = this._buildQuote({
          quoteId,
          customerId,
          machineId,
          channel,
          now,
          lockedUntil,
          normalizedItems,
          promotion,
          gift: { giftItemIds: [], eligible: false, purchaseOrdinal: null },
        });
        await this._assertPromotionSafety(promotion, quote);
        saved = await this.repository.replaceQuotePricing(quoteId, quote);
      }
    }

    return saved;
  }

  _buildQuote({ quoteId, customerId, machineId, channel, now, lockedUntil, normalizedItems, promotion, gift }) {
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
    const partialBonusRule = promotion
      ? ruleValueWithLegacyAlias(promotion.currentVersion, 'PARTIAL_BONUS_PAYMENT', 'BONUS_PAYMENT')
      : undefined;
    const transferRule = promotion
      ? ruleValueWithLegacyAlias(promotion.currentVersion, 'TRANSFER_TO_THIRD_PARTY', 'THIRD_PARTY_TRANSFER')
      : undefined;

    return {
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
      partialBonusPaymentAllowed: partialBonusRule !== 'FORBIDDEN',
      transferAllowed: transferRule !== 'FORBIDDEN',
      paymentRequired: finalAmount > 0,
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
  }

  async _assertPromotionSafety(promotion, quote) {
    if (!promotion || !this.safetyService) return;
    const paidBase = money(quote.baseAmount - quote.giftAmount);
    const observedDiscountPercent = paidBase > 0
      ? Number(((quote.promotionDiscountAmount / paidBase) * 100).toFixed(4))
      : 0;
    const safety = await this.safetyService.evaluate({
      campaign: promotion,
      // A milestone gift may legitimately make the total zero; minimum price protects monetary discounts.
      observedFinalPrice: quote.giftAmount > 0 ? null : quote.finalAmount,
      observedDiscountPercent,
    });
    if (!safety.safe) {
      throw this._error('PRICING_PROMOTION_SAFETY_BLOCK', 'Promotion pricing is blocked by safety policy.', 409, safety.issues || []);
    }
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

  async completePaidOrder(orderId) {
    const quote = await this.repository.getQuoteByOrderId(orderId);
    if (!quote || !quote.customerId || !quote.machineId) return null;
    if (!this.giftResolver?.completePurchase) return null;
    return this.giftResolver.completePurchase({ customerId: quote.customerId, machineId: quote.machineId, orderId });
  }

  _error(code, message, statusCode, details = []) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    error.details = details;
    error.source = 'pricing_engine';
    return error;
  }
}

module.exports = { PricingEngineService, money, ruleValue, ruleValueWithLegacyAlias };
