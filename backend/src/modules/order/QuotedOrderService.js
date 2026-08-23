'use strict';

const { ORDER_DOMAIN_EVENTS } = require('../../platform/events/domainEventContract');
const { ORDER_STATUS } = require('./OrderEntity');

class QuotedOrderService {
  constructor({ orderRuntime, pricingEngineService } = {}) {
    if (!orderRuntime) throw new Error('Order runtime is required.');
    if (!pricingEngineService) throw new Error('Pricing Engine service is required.');
    this.orderRuntime = orderRuntime;
    this.pricingEngineService = pricingEngineService;
  }

  async createOrder(customerId, { quoteId }, context = {}) {
    if (!quoteId) throw this._error('PRICING_QUOTE_REQUIRED', 'quoteId is required.', 400);
    const quote = await this.pricingEngineService.getValidQuote(quoteId);
    if (quote.customerId && quote.customerId !== customerId) {
      throw this._error('PRICING_QUOTE_CUSTOMER_MISMATCH', 'Pricing quote does not belong to this customer.', 403);
    }

    const result = await this._createOrderFromQuote(customerId, quote, context);

    try {
      await this.pricingEngineService.consumeQuote(quoteId, { orderId: result.order.id });
      if (!quote.paymentRequired) await this.pricingEngineService.completePaidOrder(result.order.id);
    } catch (error) {
      if (result.order.status === ORDER_STATUS.PAYMENT_PENDING) {
        await this.orderRuntime.cancelOrder(result.order.id, { ...context, customerId, reasonCode: 'pricing_quote_consume_failed' });
      }
      throw error;
    }

    return {
      ...result,
      pricing: {
        quoteId: quote.id,
        snapshotId: quote.snapshotId,
        baseAmount: Number(quote.baseAmount),
        giftAmount: Number(quote.giftAmount),
        promotionDiscountAmount: Number(quote.promotionDiscountAmount),
        finalAmount: Number(quote.finalAmount),
        paymentRequired: Boolean(quote.paymentRequired),
        transferAllowed: Boolean(quote.transferAllowed),
        partialBonusPaymentAllowed: Boolean(quote.partialBonusPaymentAllowed),
        lockedUntil: quote.lockedUntil,
      },
    };
  }

  async _createOrderFromQuote(customerId, quote, context) {
    const service = this.orderRuntime.orderService;
    const order = await service.orderRepository.create({
      customerId,
      status: ORDER_STATUS.PAYMENT_PENDING,
      amount: Number(quote.finalAmount),
      currency: quote.currency,
      machineId: quote.machineId,
      basePriceRub: Number(quote.baseAmount),
      promoDiscountRub: Number(quote.promotionDiscountAmount),
    });
    const event = await service.publishOrderEvent(ORDER_DOMAIN_EVENTS.ORDER_CREATED, order, {
      fromStatus: null,
      toStatus: order.status,
      stateReason: quote.paymentRequired ? 'pricing_quote_order_created' : 'zero_amount_pricing_quote_created',
      context: {
        ...context,
        sourceChannel: context.sourceChannel || quote.channel,
        pricingQuoteId: quote.id,
        pricingSnapshotId: quote.snapshotId,
      },
    });
    await service.recordAudit({
      eventType: ORDER_DOMAIN_EVENTS.ORDER_CREATED.name,
      customerId,
      order,
      action: 'create',
      decision: 'success',
      reasonCode: quote.paymentRequired ? 'pricing_quote_order_created' : 'zero_amount_pricing_quote_created',
      context,
    });

    if (quote.paymentRequired) return { order, event, created: true, paymentBypassed: false };

    const paid = await this.orderRuntime.confirmPayment(order.id, {
      ...context,
      customerId,
      causationId: event?.id || context.causationId,
      reasonCode: 'payment_not_required',
    });
    return { ...paid, created: true, paymentBypassed: true };
  }

  _error(code, message, statusCode) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    error.source = 'order_pricing';
    return error;
  }
}

module.exports = { QuotedOrderService };
