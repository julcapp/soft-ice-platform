'use strict';
const { randomUUID, createHash } = require('node:crypto');
const { assertCustomerAccess } = require('../customer/CustomerAccessPolicy');
const { isPickupPreorder, pickupExpiry } = require('../payment/PreorderFulfillmentPolicy');
const PROVIDER = 'TEST_CLUB_ACCOUNT';
const fail = (code, message, statusCode = 409) => Object.assign(new Error(message), { code, statusCode });

async function testBalanceCents(prisma, customerId) {
  const [row] = await prisma.$queryRawUnsafe(`SELECT
    COALESCE((SELECT SUM("amountCents") FROM "MiniAppClubTopupCheckout" WHERE "customerId"=$1 AND status='SUCCEEDED' AND test=TRUE),0)
    - COALESCE((SELECT SUM("amountCents") FROM "MiniAppTestClubDebit" WHERE "customerId"=$1 AND test=TRUE),0) AS cents`, customerId);
  const cents = Number(row?.cents || 0);
  if (!Number.isSafeInteger(cents) || cents < 0) throw fail('CLUB_TEST_BALANCE_INVALID', 'Тестовый остаток требует проверки сотрудником.');
  return cents;
}
function orderCents(order) {
  const amount = Number(order.amount), cents = Math.round(amount * 100);
  if (order.currency !== 'RUB' || !Number.isSafeInteger(cents) || cents <= 0 || cents > 2147483647 || Math.abs(amount * 100 - cents) > 0.00001) {
    throw fail('CLUB_TEST_AMOUNT_INVALID', 'Не удалось подтвердить сумму заказа.');
  }
  return cents;
}
class MiniAppTestClubPurchaseService {
  constructor({ prisma, clock = () => new Date() }) { Object.assign(this, { prisma, clock }); }
  async pay(customer, orderId) {
    assertCustomerAccess(customer, this.clock());
    try {
      return await this.prisma.$transaction(async tx => {
        // Serialize every debit of this wallet, including different simultaneous orders.
        await tx.$queryRawUnsafe('SELECT 1 FROM pg_advisory_xact_lock(hashtext($1))', 'test-club-wallet:' + customer.id);
        await tx.$queryRawUnsafe('SELECT id FROM "Order" WHERE id=$1 AND "customerId"=$2 FOR UPDATE', orderId, customer.id);
        const order = await tx.order.findFirst({ where: { id: orderId, customerId: customer.id } });
        const flow = order && await tx.saleFlow.findFirst({ where: { orderId, customerId: customer.id } });
        if (!order || !isPickupPreorder(flow)) throw fail('PREORDER_NOT_FOUND', 'Заказ не найден.', 404);
        if (order.machineId !== 'TEST-MACHINE-001' || flow.machineId !== order.machineId) throw fail('CLUB_TEST_MACHINE_REQUIRED', 'Оплата тестовым остатком доступна только на тестовом аппарате.');
        const existing = await tx.payment.findUnique({ where: { orderId } });
        if (existing) {
          const [debit] = await tx.$queryRawUnsafe('SELECT * FROM "MiniAppTestClubDebit" WHERE "orderId"=$1 AND "customerId"=$2', orderId, customer.id);
          if (existing.provider === PROVIDER && existing.status === 'SUCCEEDED' && existing.metadata?.test === true && debit?.paymentId === existing.id) {
            return { orderId, paymentId: existing.id, status: 'SUCCEEDED', test: true, duplicate: true, balanceRub: (await testBalanceCents(tx, customer.id)) / 100 };
          }
          throw fail('CLUB_PAYMENT_ALREADY_SELECTED', 'Для заказа уже выбран другой способ оплаты. Проверьте его статус; повторно платить не нужно.');
        }
        if (order.status !== 'PAYMENT_PENDING' || flow.currentState !== 'AWAITING_PAYMENT') throw fail('PREORDER_NOT_AWAITING_PAYMENT', 'Заказ уже не ожидает оплаты.');
        const cents = orderCents(order), balance = await testBalanceCents(tx, customer.id);
        if (balance < cents) throw fail('CLUB_TEST_INSUFFICIENT_FUNDS', 'На тестовом клубном счёте недостаточно средств. Можно оплатить тестовой картой.');
        const now = this.clock(), paymentId = randomUUID(), debitId = randomUUID();
        const fingerprint = createHash('sha256').update(JSON.stringify({ orderId, customerId: customer.id, cents, provider: PROVIDER })).digest('hex');
        await tx.payment.create({ data: {
          id: paymentId, organizationId: flow.organizationId, orderId, saleFlowId: flow.flowId, customerId: customer.id,
          provider: PROVIDER, idempotencyKey: 'test-club-purchase:' + orderId, requestFingerprint: fingerprint,
          status: 'SUCCEEDED', amount: cents / 100, currency: 'RUB', succeededAt: now,
          description: 'Покупка за тестовый клубный остаток', metadata: { test: true, fulfillmentMode: 'PICKUP', sourceChannel: 'MINIAPP', debitId },
        } });
        // A distinct internal settlement, never a fabricated bank payment/reference.
        await tx.$executeRawUnsafe('UPDATE "Payment" SET channel=\'MINIAPP\',"paymentMethodType"=\'test_club_account\' WHERE id=$1', paymentId);
        await tx.$executeRawUnsafe('INSERT INTO "MiniAppTestClubDebit" (id,"customerId","orderId","paymentId","amountCents","createdAt") VALUES ($1,$2,$3,$4,$5,$6)', debitId, customer.id, orderId, paymentId, cents, now);
        // The shared pickup deadline policy; keep settlement atomic and free of hardware calls.
        const expiresAt = pickupExpiry(flow, now);
        const changed = await tx.order.updateMany({ where: { id: orderId, status: 'PAYMENT_PENDING' }, data: { status: 'PAID', paymentStatus: 'paid', paymentMethod: 'test_club_account', amountPaidRub: cents / 100, paidAt: now, expiresAt } });
        if (changed.count !== 1) throw fail('CLUB_ORDER_CHANGED', 'Заказ изменён. Проверьте его статус.');
        await tx.saleFlow.update({ where: { flowId: flow.flowId }, data: { currentState: 'PAID', paymentReference: paymentId, version: { increment: 1 }, recoveryStatus: 'NONE', updatedAt: now, expiresAt } });
        await tx.paymentAuditEntry.create({ data: { organizationId: flow.organizationId, paymentId, action: 'TEST_CLUB_PURCHASE', actorType: 'CUSTOMER', actorId: customer.id, correlationId: flow.correlationId, details: { test: true, debitId, amountCents: cents, balanceCents: balance - cents } } });
        await tx.customerTimelineEvent.create({ data: { customerId: customer.id, occurredAt: now, eventType: 'CLUB_TEST_PURCHASE', category: 'PAYMENT', title: 'Покупка за тестовый клубный остаток', description: `${cents / 100} ₽. Остаток: ${(balance - cents) / 100} ₽. Реальные деньги и бонусы не изменены.`, sourceDomain: 'club_account', sourceEntityType: 'MiniAppTestClubDebit', sourceEntityId: debitId, correlationId: flow.correlationId, metadata: { orderId, paymentId, test: true } } });
        return { orderId, paymentId, status: 'SUCCEEDED', test: true, duplicate: false, balanceRub: (balance - cents) / 100 };
      });
    } catch (error) {
      // A competing card checkout may win the unique Payment.orderId insert. The entire debit rolls back.
      if (error.code === 'P2002') throw fail('CLUB_PAYMENT_ALREADY_SELECTED', 'Способ оплаты уже выбран. Проверьте статус заказа.');
      throw error;
    }
  }
}
module.exports = { MiniAppTestClubPurchaseService, testBalanceCents, orderCents, PROVIDER };
