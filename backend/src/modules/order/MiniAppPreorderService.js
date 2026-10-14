'use strict';
const crypto = require('node:crypto');
const { assertCustomerAccess } = require('../customer/CustomerAccessPolicy');

const fail = (code, message, statusCode = 409) => Object.assign(new Error(message), { code, statusCode });

class MiniAppPreorderService {
  constructor({ prisma, catalogService, pricingService, organizationContext, paymentCheckoutService, clock = () => new Date() }) {
    Object.assign(this, { prisma, catalogService, pricingService, organizationContext, paymentCheckoutService, clock });
  }

  async quote(customer, { machineId, productId, toppingId, sprinkleId }) {
    assertCustomerAccess(customer, this.clock());
    const catalog = await this.catalogService.getMachineCatalog(machineId);
    const chosen = [catalog.currentFlavor,
      catalog.toppings.find(x => x.id === toppingId),
      catalog.sprinkles.find(x => x.id === sprinkleId)];
    if (chosen[0]?.id !== productId || chosen.some(x => !x || x.available !== true)) {
      throw fail('PREORDER_COMPOSITION_UNAVAILABLE', 'Выбранный состав недоступен. Обновите меню.');
    }
    const items = await this.catalogService.resolvePricedItems(machineId, chosen.map(x => ({ productId: x.sku, quantity: 1 })));
    return this.pricingService.createQuote({ customerId: customer.id, machineId, channel: 'MINI_APP', items });
  }

  async create(customer, { quoteId, idempotencyKey }) {
    assertCustomerAccess(customer, this.clock());
    if (!quoteId || typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw fail('PREORDER_REQUEST_INVALID', 'Обновите расчёт и повторите оформление.', 400);
    }
    const quote = await this.prisma.pricingQuote.findUnique({ where: { id: quoteId } });
    if (!quote || quote.customerId !== customer.id || quote.channel !== 'MINI_APP' || quote.machineId !== 'TEST-MACHINE-001') {
      throw fail('PREORDER_QUOTE_NOT_FOUND', 'Расчёт заказа не найден.', 404);
    }
    const organization = await this.organizationContext.resolveByMachine(quote.machineId);
    if (!organization?.organizationId || !organization.locationId) {
      throw fail('PREORDER_MACHINE_CONTEXT_MISSING', 'Для аппарата не настроена точка получения.');
    }
    return this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext($1))', `miniapp-preorder:${customer.id}:${idempotencyKey}`);
      const replay = await tx.saleFlow.findFirst({ where: { customerId: customer.id,
        metadata: { path: ['preorderKey'], equals: idempotencyKey } } });
      if (replay) {
        if (replay.metadata?.quoteId !== quoteId || replay.metadata.fulfillmentMode !== 'PICKUP') {
          throw fail('PREORDER_IDEMPOTENCY_CONFLICT', 'Повторный запрос содержит другой состав заказа.');
        }
        return tx.order.findUnique({ where: { id: replay.orderId } });
      }
      await tx.$queryRawUnsafe('SELECT id FROM "PricingQuote" WHERE id=$1 FOR UPDATE', quoteId);
      const locked = await tx.pricingQuote.findUnique({ where: { id: quoteId }, include: { snapshot: { include: { items: true } } } });
      if (!locked || locked.customerId !== customer.id || locked.channel !== 'MINI_APP' || locked.machineId !== 'TEST-MACHINE-001') {
        throw fail('PREORDER_QUOTE_NOT_FOUND', 'Расчёт заказа не найден.', 404);
      }
      if (locked.orderId) {
        const existing = await tx.saleFlow.findFirst({ where: { orderId: locked.orderId, customerId: customer.id } });
        if (existing?.metadata?.preorderKey !== idempotencyKey || existing.metadata.fulfillmentMode !== 'PICKUP') {
          throw fail('PREORDER_QUOTE_ALREADY_USED', 'Этот расчёт уже использован для заказа.');
        }
        return tx.order.findUnique({ where: { id: locked.orderId } });
      }
      if (locked.consumedAt || new Date(locked.lockedUntil) <= this.clock() || !locked.snapshot || !(Number(locked.finalAmount) > 0)) {
        throw fail('PREORDER_QUOTE_EXPIRED', 'Пересчитайте цену перед оформлением заказа.');
      }
      if (Number(locked.giftAmount) > 0 || Number(locked.promotionDiscountAmount) > 0) {
        throw fail('PREORDER_PROMOTION_NOT_READY', 'Предзаказ с подарком или акцией пока недоступен в этом тесте.');
      }
      // No ingredient reservation or dispense command during advance purchase.
      const order = await tx.order.create({ data: { customerId: customer.id, machineId: locked.machineId,
        status: 'PAYMENT_PENDING', amount: Number(locked.finalAmount), currency: locked.currency,
        basePriceRub: Number(locked.baseAmount), promoDiscountRub: Number(locked.promotionDiscountAmount),
        amountPaidRub: 0, paymentStatus: 'pending' } });
      await tx.pricingQuote.update({ where: { id: quoteId }, data: { orderId: order.id, consumedAt: this.clock() } });
      await tx.pricingSnapshot.update({ where: { quoteId }, data: { orderId: order.id } });
      const flowId = `sale_flow_${crypto.randomUUID()}`;
      await tx.saleFlow.create({ data: { flowId, orderId: order.id, customerId: customer.id,
        machineId: locked.machineId, organizationId: organization.organizationId, locationId: organization.locationId,
        correlationId: `miniapp_${crypto.randomUUID()}`, currentState: 'AWAITING_PAYMENT',
        metadata: { sourceChannel: 'MINIAPP', fulfillmentMode: 'PICKUP', preorderKey: idempotencyKey,
          quoteId, pricingSnapshotId: locked.snapshot.id } } });
      await tx.transactionalOutboxEvent.create({ data: { eventId: `event_${crypto.randomUUID()}`,
        eventType: 'MiniAppPreorderCreated', eventVersion: 1, aggregateType: 'ORDER', aggregateId: order.id,
        organizationId: organization.organizationId, saleFlowId: flowId, payload: { orderId: order.id, quoteId },
        status: 'PENDING', occurredAt: this.clock(), correlationId: flowId, idempotencyKey: `preorder-created:${order.id}` } });
      return order;
    });
  }

  async recent(customer) {
    assertCustomerAccess(customer, this.clock());
    const paid = await this.prisma.order.findFirst({ where: { customerId: customer.id, machineId: 'TEST-MACHINE-001', status: 'PAID', paymentStatus: 'paid', expiresAt: { gt: this.clock() } }, orderBy: { paidAt: 'desc' } });
    if (paid) return { orderId: paid.id, status: paid.status, paymentStatus: paid.paymentStatus, expiresAt: paid.expiresAt };
    const pending = await this.prisma.order.findFirst({ where: { customerId: customer.id, machineId: 'TEST-MACHINE-001', status: 'PAYMENT_PENDING' }, orderBy: { createdAt: 'desc' } });
    return pending ? { orderId: pending.id, status: pending.status, paymentStatus: pending.paymentStatus, expiresAt: pending.expiresAt } : null;
  }

  async own(customer, orderId) {
    assertCustomerAccess(customer, this.clock());
    const order = await this.prisma.order.findFirst({ where: { id: orderId, customerId: customer.id } });
    const flow = order && await this.prisma.saleFlow.findFirst({ where: { orderId, customerId: customer.id } });
    if (!order || flow?.metadata?.fulfillmentMode !== 'PICKUP' || flow.metadata.sourceChannel !== 'MINIAPP') {
      throw fail('PREORDER_NOT_FOUND', 'Заказ не найден.', 404);
    }
    return { order, flow };
  }

  async pay(customer, orderId) {
    const { order, flow } = await this.own(customer, orderId);
    if (order.status !== 'PAYMENT_PENDING') throw fail('PREORDER_NOT_AWAITING_PAYMENT', 'Заказ уже не ожидает оплаты.');
    // Test boundary is checked again server-side, independently of the UI.
    if (order.machineId !== 'TEST-MACHINE-001') throw fail('PREORDER_TEST_MACHINE_REQUIRED', 'Тестовая покупка доступна только на тестовом аппарате.');
    const provider = this.paymentCheckoutService.providers?.YOOKASSA;
    if (!provider?.isConfigured?.()) throw fail('PREORDER_TEST_SHOP_REQUIRED', 'Тестовый магазин ЮKassa не настроен.', 503);
    let account;
    try { account = await provider.request('/me', { method: 'GET' }); }
    catch { throw fail('PREORDER_TEST_SHOP_REQUIRED', 'Не удалось подтвердить тестовый магазин ЮKassa.', 503); }
    if (!account?.test || account?.status !== 'enabled' || String(account.account_id) !== String(provider.shopId)) {
      throw fail('PREORDER_TEST_SHOP_REQUIRED', 'Подключённый магазин ЮKassa не подтверждён как активный тестовый.', 503);
    }
    const result = await this.paymentCheckoutService.initiate({ organizationId: flow.organizationId,
      orderId, saleFlowId: flow.flowId, provider: 'YOOKASSA', channel: 'MINIAPP', method: 'bank_card',
      idempotencyKey: `miniapp-payment:${orderId}`, returnUrl: 'https://miniapp.utimoshi.ru/preorder-return.html',
      description: 'Предзаказ «У Тимоши»', metadata: { fulfillmentMode: 'PICKUP' } });
    return { orderId, paymentId: result.payment.id, confirmationUrl: result.confirmationUrl, status: result.status };
  }

  async status(customer, orderId) {
    const { order, flow } = await this.own(customer, orderId);
    const payment = await this.prisma.payment.findFirst({ where: { orderId, organizationId: flow.organizationId } });
    if (payment && ['CREATED', 'PENDING', 'AUTHORIZED'].includes(payment.status) && payment.providerPaymentId) {
      await this.paymentCheckoutService.refreshPayment({ organizationId: flow.organizationId, paymentId: payment.id });
    }
    const current = await this.prisma.order.findUnique({ where: { id: order.id } });
    const verified = await this.prisma.payment.findFirst({ where: { orderId, organizationId: flow.organizationId } });
    return { orderId, status: current.status, paymentStatus: verified?.status || 'NOT_STARTED',
      amount: Number(current.amount), currency: current.currency, machineId: current.machineId,
      expiresAt: current.expiresAt, pickupExpired: current.expiresAt && new Date(current.expiresAt) <= this.clock(),
      waitingPickup: current.status === 'PAID' && verified?.status === 'SUCCEEDED' && current.expiresAt && new Date(current.expiresAt) > this.clock() };
  }
}
module.exports = { MiniAppPreorderService };
