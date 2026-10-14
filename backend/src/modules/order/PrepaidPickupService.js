const crypto = require('node:crypto');
const QRCode = require('../../vendor/qrcode.bundle.js');

const PICKUP_TTL_MS = 48 * 60 * 60 * 1000;
const PICKUP_CODE_TTL_MS = 5 * 60 * 1000;

class PrepaidPickupService {
  constructor({ prisma, machineDispenseService, catalogService, inventory, clock = () => new Date() } = {}) {
    if (!prisma) throw new Error('prisma is required');
    if (!machineDispenseService) throw new Error('machineDispenseService is required');
    if (!catalogService) throw new Error('catalogService is required');
    if (!inventory) throw new Error('inventory is required');
    Object.assign(this, { prisma, machineDispenseService, catalogService, inventory, clock });
    this.redeemAttempts = new Map();
  }

  async issueCode(customerId, orderId) {
    const now = this.clock();
    const order = await this.prisma.order.findFirst({ where: { id: orderId, customerId } });
    if (!order) throw problem('PICKUP_ORDER_NOT_FOUND', 'Оплаченный заказ не найден.', 404);
    if (order.status !== 'PAID' || order.paymentStatus !== 'paid') throw problem('PICKUP_ORDER_NOT_PAID', 'Заказ ещё не подтверждён как оплаченный.');
    const payment = await this.prisma.payment.findFirst({ where: { orderId: order.id, customerId, status: 'SUCCEEDED', channel: { in: ['MINIAPP', 'WEB'] } } });
    if (!payment) throw problem('PICKUP_PAYMENT_NOT_SUCCEEDED', 'Оплата заказа не подтверждена сервером.');
    const flow = await this.prisma.saleFlow.findFirst({ where: { orderId: order.id } });
    if (!flow || flow.currentState !== 'PAID') throw problem('PICKUP_SALE_FLOW_NOT_READY', 'Заказ пока не готов к получению.', 409);
    const orderExpiresAt = order.expiresAt || new Date((order.paidAt || payment.succeededAt || now).getTime() + PICKUP_TTL_MS);
    if (orderExpiresAt <= now) throw problem('PICKUP_ORDER_EXPIRED', 'Срок получения оплаченного заказа истёк.', 410);
    const codeExpiresAt = new Date(Math.min(orderExpiresAt.getTime(), now.getTime() + PICKUP_CODE_TTL_MS));
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const codeHash = hashCode(code, codeExpiresAt);
    const qrPayload = 'UTP1:' + order.id + ':' + code;
    const qrSvg = await QRCode.toString(qrPayload, { type: 'svg', margin: 1, width: 320, errorCorrectionLevel: 'M' });
    const qrDataUrl = 'data:image/svg+xml;base64,' + Buffer.from(qrSvg, 'utf8').toString('base64');
    await this.prisma.order.update({ where: { id: order.id }, data: { activePickupCodeHash: codeHash, expiresAt: orderExpiresAt } });
    return { orderId: order.id, machineId: flow.machineId || order.machineId, code, qrPayload, qrDataUrl, expiresAt: codeExpiresAt, orderExpiresAt, amount: Number(order.amountPaidRub ?? order.amount), currency: order.currency || 'RUB' };
  }

  async redeem({ machineId, code, qrPayload }, context = {}) {
    this.assertRedeemRate(machineId, context.rateKey || 'anonymous');
    let expectedOrderId = null;
    let normalizedCode = String(code || '').replace(/\D/g, '');
    if (qrPayload) {
      const parsed = parseQrPayload(qrPayload);
      expectedOrderId = parsed.orderId;
      normalizedCode = parsed.code;
    }
    if (!machineId) throw problem('PICKUP_MACHINE_REQUIRED', 'Не указан аппарат.', 400);
    if (!/^\d{6}$/.test(normalizedCode)) throw problem('PICKUP_CODE_INVALID', 'Введите 6 цифр кода.', 400);
    const now = this.clock();
    const candidates = await this.prisma.order.findMany({ where: { ...(expectedOrderId ? { id: expectedOrderId } : {}), machineId, status: 'PAID', paymentStatus: 'paid', activePickupCodeHash: { not: null }, expiresAt: { gt: now } }, take: 100 });
    const matches = candidates.filter((row) => verifyCode(normalizedCode, row.activePickupCodeHash, now));
    if (matches.length === 0) throw problem('PICKUP_CODE_NOT_FOUND', 'Код не найден, истёк или уже использован.', 404);
    if (matches.length > 1) throw problem('PICKUP_CODE_AMBIGUOUS', 'Код требует перевыпуска в Mini App.', 409);
    const matched = matches[0];
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: matched.id } });
      if (!order || order.status !== 'PAID' || order.paymentStatus !== 'paid' || order.machineId !== machineId) throw problem('PICKUP_ORDER_NOT_AVAILABLE', 'Заказ недоступен для получения.', 409);
      if (!order.activePickupCodeHash || !verifyCode(normalizedCode, order.activePickupCodeHash, now)) throw problem('PICKUP_CODE_ALREADY_USED', 'Код уже использован, истёк или был перевыпущен.', 409);
      if (!order.expiresAt || new Date(order.expiresAt) <= now) throw problem('PICKUP_ORDER_EXPIRED', 'Срок получения оплаченного заказа истёк.', 410);
      const payment = await tx.payment.findFirst({ where: { orderId: order.id, status: 'SUCCEEDED', channel: { in: ['MINIAPP', 'WEB'] } } });
      if (!payment) throw problem('PICKUP_PAYMENT_NOT_SUCCEEDED', 'Оплата заказа не подтверждена сервером.', 409);
      let flow = await tx.saleFlow.findFirst({ where: { orderId: order.id, machineId, currentState: 'PAID' } });
      if (!flow) throw problem('PICKUP_SALE_FLOW_NOT_READY', 'Заказ не готов к выдаче на этом аппарате.', 409);
      const snapshot = await tx.pricingSnapshot.findFirst({ where: { orderId: order.id }, include: { items: true } });
      const skus = (snapshot?.items || []).map((item) => item.sku).filter(Boolean);
      if (!snapshot || skus.length === 0) throw problem('PICKUP_COMPOSITION_NOT_FOUND', 'Не удалось восстановить состав оплаченного заказа.', 409);
      const inventoryItems = await this.catalogService.resolveInventoryRecipe(skus);
      const reservationResult = await this.inventory.checkAndReserve({ saleFlowId: flow.flowId, orderId: order.id, organizationId: flow.organizationId, locationId: flow.locationId, machineId, items: inventoryItems, quantity: 1, correlationId: flow.correlationId, idempotencyKey: 'pickup-reserve:' + order.id }, { transactionClient: tx });
      if (!reservationResult.available) throw problem('PICKUP_INVENTORY_UNAVAILABLE', 'Сейчас не хватает ингредиентов для оплаченного заказа. Повторная оплата не требуется.', 409);
      flow = await tx.saleFlow.update({ where: { flowId: flow.flowId }, data: { inventoryReservationReference: reservationResult.reservationId, updatedAt: now, version: { increment: 1 } } });
      const consumed = await tx.order.updateMany({ where: { id: order.id, activePickupCodeHash: order.activePickupCodeHash, status: 'PAID' }, data: { activePickupCodeHash: null } });
      if (consumed.count !== 1) throw problem('PICKUP_CODE_ALREADY_USED', 'Код уже использован.', 409);
      const result = await this.machineDispenseService.createAuthorizedFromPaidFlow(tx, flow, payment, { actorType: 'CUSTOMER', actorId: order.customerId, correlationId: context.correlationId || flow.correlationId, causationId: 'pickup:' + order.id });
      return { orderId: order.id, machineId, amount: Number(order.amountPaidRub ?? order.amount), currency: order.currency || 'RUB', dispenseAttemptId: result.attempt.dispenseAttemptId, dispenseStatus: result.attempt.status, duplicate: Boolean(result.duplicate) };
    });
  }

  async status({ machineId, dispenseAttemptId }) {
    if (!machineId || !dispenseAttemptId) throw problem('PICKUP_STATUS_SCOPE_REQUIRED', 'Не указан аппарат или операция выдачи.', 400);
    const attempt = await this.prisma.machineDispenseAttempt.findFirst({ where: { machineId, dispenseAttemptId, operationType: 'CUSTOMER_SALE' } });
    if (!attempt) throw problem('PICKUP_DISPENSE_NOT_FOUND', 'Операция выдачи не найдена.', 404);
    return { dispenseAttemptId, status: attempt.status, failureCode: attempt.failureCode || null, finishedAt: attempt.completedAt || attempt.failedAt || attempt.timedOutAt || null };
  }

  assertRedeemRate(machineId, rateKey) {
    const key = String(machineId || 'unknown') + ':' + String(rateKey || 'anonymous');
    const now = Date.now();
    const current = this.redeemAttempts.get(key);
    if (!current || now - current.windowStartedAt >= 60000) {
      this.redeemAttempts.set(key, { windowStartedAt: now, count: 1 });
      return;
    }
    if (current.count >= 6) throw problem('PICKUP_RATE_LIMITED', 'Слишком много попыток. Повторите через минуту.', 429);
    current.count += 1;
  }
}

function hashCode(code, expiresAt = new Date(Date.now() + PICKUP_CODE_TTL_MS)) {
  const salt = crypto.randomBytes(16);
  const digest = crypto.scryptSync(code, salt, 32);
  return 'scrypt$' + new Date(expiresAt).getTime() + '$' + salt.toString('hex') + '$' + digest.toString('hex');
}

function verifyCode(code, encoded, now = new Date()) {
  try {
    const [kind, expiresMs, saltHex, digestHex] = String(encoded || '').split('$');
    if (kind !== 'scrypt' || !expiresMs || !saltHex || !digestHex || Number(expiresMs) <= new Date(now).getTime()) return false;
    const expected = Buffer.from(digestHex, 'hex');
    const actual = crypto.scryptSync(code, Buffer.from(saltHex, 'hex'), expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch { return false; }
}

function parseQrPayload(payload) {
  const match = /^UTP1:([0-9a-f-]{36}):(\d{6})$/i.exec(String(payload || '').trim());
  if (!match) throw problem('PICKUP_QR_INVALID', 'QR-код заказа недействителен.', 400);
  return { orderId: match[1].toLowerCase(), code: match[2] };
}

function problem(code, message, statusCode = 409) { return Object.assign(new Error(message), { code, statusCode, source: 'prepaid_pickup' }); }

module.exports = { PrepaidPickupService, PICKUP_TTL_MS, hashCode, verifyCode, parseQrPayload };
