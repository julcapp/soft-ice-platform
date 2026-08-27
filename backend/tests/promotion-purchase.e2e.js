'use strict';

const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { PricingEngineService } = require('../src/modules/promotion_engine/PricingEngineService');
const { PricingRepository } = require('../src/modules/promotion_engine/PricingRepository');
const { ActivePromotionResolver } = require('../src/modules/promotion_engine/ActivePromotionResolver');
const { PromotionRepository } = require('../src/modules/promotion_engine/PromotionRepository');
const { PromotionSafetyService } = require('../src/modules/promotion_engine/PromotionSafetyService');
const { FiftiethPurchaseGiftResolver } = require('../src/modules/promotion_engine/FiftiethPurchaseGiftResolver');
const { QuotedOrderService } = require('../src/modules/order/QuotedOrderService');
const { OrderRepository } = require('../src/modules/order/OrderRepository');
const { OrderService } = require('../src/modules/order/OrderService');
const { OrderRuntime } = require('../src/modules/order/OrderRuntime');
const { MachineRepository } = require('../src/modules/machine/MachineRepository');
const { MachineService } = require('../src/modules/machine/MachineService');
const { MachineRuntime } = require('../src/modules/machine/MachineRuntime');
const { PaymentRepository } = require('../src/modules/payment/PaymentRepository');
const { PaymentOrchestrator } = require('../src/modules/payment/PaymentOrchestrator');

const integrationTest = process.env.DATABASE_URL ? test : test.skip;

integrationTest('E2E: 50th purchase + Happy Hour + YooKassa webhook + dispense request', async () => {
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  const customerId = `e2e_customer_${suffix}`;
  const machineId = `e2e_machine_${suffix}`;
  const campaignId = `e2e_campaign_${suffix}`;
  const versionId = `e2e_version_${suffix}`;
  const now = new Date('2026-08-25T14:30:00.000Z'); // Tuesday 17:30 Europe/Moscow.

  try {
    await prisma.customer.create({ data: { id: customerId, name: 'E2E Customer' } });
    await prisma.machine.create({
      data: { id: machineId, machineCode: `E2E-${suffix}`, name: 'E2E Machine', status: 'ONLINE' },
    });
    await prisma.customerMachineRewardCounter.create({
      data: {
        id: `e2e_counter_${suffix}`,
        customerId,
        machineId,
        completedPurchases: 49,
      },
    });

    await prisma.promotionCampaign.create({
      data: {
        id: campaignId,
        code: `HAPPY_HOUR_E2E_${suffix}`,
        name: 'Час выгоды E2E',
        status: 'ACTIVE',
        createdBy: 'e2e',
      },
    });
    await prisma.promotionVersion.create({
      data: {
        id: versionId,
        campaignId,
        version: 1,
        status: 'ACTIVE',
        benefitType: 'PERCENT_DISCOUNT',
        benefitValue: 20,
        priority: 100,
        stackingMode: 'BEST_PRICE',
        priceLockSeconds: 300,
        startsAt: new Date('2026-08-01T00:00:00.000Z'),
        endsAt: new Date('2026-09-01T00:00:00.000Z'),
        timezone: 'Europe/Moscow',
        approvalPolicy: 'NONE',
        budgetAction: 'STOP',
        createdBy: 'e2e',
        schedules: {
          create: [{
            dayOfWeek: 2,
            startTime: new Date('1970-01-01T17:00:00.000Z'),
            endTime: new Date('1970-01-01T19:00:00.000Z'),
            isEnabled: true,
          }],
        },
        targets: { create: [{ targetType: 'ALL_MACHINES' }] },
        audiences: { create: [{ audienceType: 'ALL' }] },
        rules: {
          create: [
            { ruleType: 'PARTIAL_BONUS_PAYMENT', operator: 'EQ', value: 'FORBIDDEN' },
            { ruleType: 'TRANSFER_TO_THIRD_PARTY', operator: 'EQ', value: 'FORBIDDEN' },
            { ruleType: 'MONEY_DISCOUNT_STACKING', operator: 'EQ', value: 'FORBIDDEN' },
            { ruleType: 'GIFT_COMPATIBILITY', operator: 'EQ', value: 'PAID_ITEMS_ONLY' },
          ],
        },
        channels: { create: [{ channel: 'MINI_APP', enabled: true, countdownEnabled: true }] },
      },
    });
    await prisma.promotionCampaign.update({
      where: { id: campaignId },
      data: { currentVersionId: versionId, effectiveVersionId: versionId },
    });

    const giftResolver = new FiftiethPurchaseGiftResolver({ prisma, clock: () => now });
    const pricingService = new PricingEngineService({
      repository: new PricingRepository(prisma),
      promotionResolver: new ActivePromotionResolver({ prisma }),
      safetyService: new PromotionSafetyService({ repository: new PromotionRepository(prisma) }),
      giftResolver,
      clock: () => now,
    });

    const quote = await pricingService.createQuote({
      customerId,
      machineId,
      channel: 'MINI_APP',
      items: [
        { id: 'ice', sku: 'ICE-CREAM', name: 'Мороженое', serverProductType: 'ICE_CREAM', quantity: 1, unitPrice: 250 },
        { id: 'topping', sku: 'TOPPING', name: 'Топпинг', serverProductType: 'TOPPING', quantity: 1, unitPrice: 50 },
      ],
    });

    assert.equal(Number(quote.baseAmount), 300);
    assert.equal(Number(quote.giftAmount), 250);
    assert.equal(Number(quote.promotionDiscountAmount), 10);
    assert.equal(Number(quote.finalAmount), 40);
    assert.equal(quote.partialBonusPaymentAllowed, false);
    assert.equal(quote.transferAllowed, false);
    assert.equal(quote.paymentRequired, true);

    const machineRuntime = new MachineRuntime({
      machineService: new MachineService({
        machineRepository: new MachineRepository(prisma),
        clock: () => now,
      }),
    });
    const orderRuntime = new OrderRuntime({
      orderService: new OrderService({
        orderRepository: new OrderRepository(prisma),
        machineRuntime,
        clock: () => now,
      }),
    });
    const quotedOrderService = new QuotedOrderService({ orderRuntime, pricingEngineService: pricingService });
    const orderResult = await quotedOrderService.createOrder(customerId, { quoteId: quote.id }, {
      actorType: 'customer', actorId: customerId, sourceChannel: 'MINI_APP',
    });

    assert.equal(orderResult.order.status, 'PAYMENT_PENDING');
    assert.equal(Number(orderResult.order.amount), 40);
    const application = await prisma.promotionApplication.findFirst({ where: { orderId: orderResult.order.id } });
    assert.ok(application);
    assert.equal(Number(application.discountAmount), 10);

    let providerPayment;
    const adapter = {
      createPayment: async ({ orderId, amount, currency }) => {
        providerPayment = {
          id: `yoo_e2e_${suffix}`,
          status: 'pending',
          paid: false,
          amount: { value: Number(amount).toFixed(2), currency },
          metadata: { order_id: orderId },
          confirmation: { confirmation_url: 'https://example.invalid/e2e-payment' },
        };
        return providerPayment;
      },
      getPayment: async (id) => ({ ...providerPayment, id, status: 'succeeded', paid: true }),
    };
    const payments = new PaymentOrchestrator({
      repository: new PaymentRepository(prisma),
      adapter,
      orderRuntime,
      fiftiethPurchaseGiftResolver: giftResolver,
    });

    const attempt = await payments.startPayment({
      orderId: orderResult.order.id,
      customerId,
      method: 'sbp',
      idempotencyKey: `e2e-payment-${suffix}`,
    });
    assert.equal(Number(attempt.amount), 40);
    assert.equal(attempt.status, 'PENDING');

    const webhook = await payments.handleWebhook({
      type: 'notification',
      event: 'payment.succeeded',
      object: { id: providerPayment.id },
    });
    assert.equal(webhook.status, 'SUCCEEDED');
    assert.equal(webhook.order.status, 'PAID');

    const storedOrder = await prisma.order.findUnique({ where: { id: orderResult.order.id } });
    const counter = await prisma.customerMachineRewardCounter.findUnique({
      where: { customerId_machineId: { customerId, machineId } },
    });
    const reservation = await prisma.giftRewardReservation.findUnique({ where: { quoteId: quote.id } });
    const dispense = await prisma.dispenseRequest.findUnique({ where: { orderId: orderResult.order.id } });
    const succeededAttempt = await prisma.paymentAttempt.findUnique({ where: { id: attempt.id } });

    assert.equal(storedOrder.status, 'PAID');
    assert.equal(counter.completedPurchases, 50);
    assert.equal(counter.lastCompletedOrderId, storedOrder.id);
    assert.equal(reservation.status, 'CONSUMED');
    assert.ok(dispense);
    assert.equal(dispense.state, 'REQUESTED');
    assert.equal(dispense.machineId, machineId);
    assert.equal(succeededAttempt.status, 'SUCCEEDED');
  } finally {
    await prisma.$disconnect();
  }
});
