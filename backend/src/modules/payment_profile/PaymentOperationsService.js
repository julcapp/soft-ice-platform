const { randomUUID } = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');

class PaymentOperationsService {
  constructor({ prisma, paymentAdapter, customerProfileCommunicationService = null, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    if (!paymentAdapter) throw new Error('paymentAdapter is required');
    this.prisma = prisma;
    this.paymentAdapter = paymentAdapter;
    this.customerProfileCommunicationService = customerProfileCommunicationService;
    this.clock = clock;
  }

  async createRefund({ customerId, sourceType, sourcePaymentId, amountRub, reason, actorId = 'admin', idempotencyKey }) {
    const source = await this.#loadSource(customerId, sourceType, sourcePaymentId);
    const amount = Number(amountRub);
    if (!(amount > 0)) throw validation('PAYMENT_REFUND_AMOUNT_INVALID', 'Сумма возврата должна быть положительной.');

    const returnedRows = await this.prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM("amountRub"),0)::float8 AS total FROM "PaymentRefund" WHERE "customerId"=$1 AND "sourceType"=$2 AND "sourcePaymentId"=$3 AND "status" IN ('PENDING','SUCCEEDED')`,
      customerId, source.sourceType, source.sourcePaymentId,
    );
    const alreadyReturned = Number(returnedRows[0]?.total || 0);
    const remaining = Number((source.amountRub - alreadyReturned).toFixed(2));
    if (amount > remaining) throw validation('PAYMENT_REFUND_EXCEEDS_REMAINING', `Доступно к возврату ${remaining.toFixed(2)} RUB.`);

    const key = String(idempotencyKey || `refund:${source.sourceType}:${source.sourcePaymentId}:${amount.toFixed(2)}:${reason || ''}`);
    const existing = await this.prisma.$queryRawUnsafe('SELECT * FROM "PaymentRefund" WHERE "idempotencyKey"=$1 LIMIT 1', key);
    if (existing[0]) return { ...existing[0], idempotentReplay: true };

    const id = randomUUID();
    const now = this.clock();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "PaymentRefund" ("id","customerId","sourceType","sourcePaymentId","orderId","subscriptionId","provider","amountRub","currency","reason","status","idempotencyKey","requestedAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'RUB',$9,'PENDING',$10,$11,$11,$11)`,
      id, customerId, source.sourceType, source.sourcePaymentId, source.orderId, source.subscriptionId, source.provider, amount, String(reason || 'Возврат платежа').slice(0, 500), key, now,
    );

    try {
      const providerRefund = await this.paymentAdapter.createRefund({
        providerPaymentId: source.providerPaymentId,
        amountRub: amount,
        description: String(reason || 'Возврат платежа').slice(0, 128),
        idempotencyKey: key,
      });
      const status = normalizeRefundStatus(providerRefund.status);
      const completedAt = status === 'SUCCEEDED' ? now : null;
      await this.prisma.$executeRawUnsafe(
        `UPDATE "PaymentRefund" SET "providerRefundId"=$2,"status"=$3,"completedAt"=$4,"updatedAt"=$5 WHERE "id"=$1`,
        id, providerRefund.id || null, status, completedAt, now,
      );
      if (providerRefund.receipt_registration) {
        await this.recordReceipt({ customerId, sourceType: source.sourceType, sourcePaymentId: source.sourcePaymentId, orderId: source.orderId, subscriptionId: source.subscriptionId, provider: source.provider, providerReceiptId: null, receiptType: 'REFUND', amountRub: amount, status: String(providerRefund.receipt_registration).toUpperCase(), issuedAt: completedAt });
      }
      await this.#notify(customerId, status === 'SUCCEEDED'
        ? { type: 'PAYMENT_REFUND_SUCCEEDED', title: 'Возврат выполнен', body: `Возврат ${amount.toFixed(2)} ₽ выполнен.`, significant: true }
        : { type: 'PAYMENT_REFUND_PENDING', title: 'Возврат обрабатывается', body: `Возврат ${amount.toFixed(2)} ₽ принят в обработку.`, significant: true });
      return { id, customerId, sourceType: source.sourceType, sourcePaymentId: source.sourcePaymentId, amountRub: amount, status, providerRefundId: providerRefund.id || null, remainingAfterRub: Number((remaining - amount).toFixed(2)), requestedAt: now, completedAt };
    } catch (error) {
      await this.prisma.$executeRawUnsafe(`UPDATE "PaymentRefund" SET "status"='FAILED',"failureReason"=$2,"updatedAt"=$3 WHERE "id"=$1`, id, String(error.code || error.message || 'UNKNOWN').slice(0, 500), now);
      await this.#notify(customerId, { type: 'PAYMENT_REFUND_FAILED', title: 'Возврат не выполнен', body: 'Не удалось выполнить возврат автоматически. Мы сохранили обращение для проверки.', significant: true });
      throw error;
    }
  }

  async recordReceipt(input) {
    const existing = input.providerReceiptId
      ? await this.prisma.$queryRawUnsafe('SELECT * FROM "PaymentReceipt" WHERE "provider"=$1 AND "providerReceiptId"=$2 LIMIT 1', input.provider || 'YOOKASSA', input.providerReceiptId)
      : [];
    if (existing[0]) return { ...existing[0], idempotentReplay: true };
    const id = randomUUID();
    const now = this.clock();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "PaymentReceipt" ("id","customerId","sourceType","sourcePaymentId","orderId","subscriptionId","provider","providerReceiptId","receiptType","amountRub","currency","status","receiptUrl","fiscalDocumentNumber","fiscalDriveNumber","fiscalSign","issuedAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'RUB',$11,$12,$13,$14,$15,$16,$17,$17)`,
      id, input.customerId, input.sourceType, input.sourcePaymentId, input.orderId || null, input.subscriptionId || null, input.provider || 'YOOKASSA', input.providerReceiptId || null, input.receiptType || 'PAYMENT', Number(input.amountRub || 0), String(input.status || 'PENDING').toUpperCase(), input.receiptUrl || null, input.fiscalDocumentNumber || null, input.fiscalDriveNumber || null, input.fiscalSign || null, input.issuedAt || null, now,
    );
    if (input.receiptUrl || String(input.status || '').toUpperCase() === 'SUCCEEDED') {
      await this.#notify(input.customerId, { type: input.receiptType === 'REFUND' ? 'REFUND_RECEIPT_READY' : 'PAYMENT_RECEIPT_READY', title: input.receiptType === 'REFUND' ? 'Чек возврата готов' : 'Электронный чек готов', body: input.receiptUrl ? `Чек доступен: ${input.receiptUrl}` : 'Чек зарегистрирован платёжным провайдером.', significant: true });
    }
    return { id, status: String(input.status || 'PENDING').toUpperCase() };
  }

  async stats({ from, toExclusive }) {
    const [refunds, receipts] = await Promise.all([
      this.prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count, COALESCE(SUM("amountRub"),0)::float8 AS amount FROM "PaymentRefund" WHERE "status"='SUCCEEDED' AND "completedAt">=$1 AND "completedAt"<$2`, from, toExclusive),
      this.prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "PaymentReceipt" WHERE "createdAt">=$1 AND "createdAt"<$2`, from, toExclusive),
    ]);
    return { refundsSucceeded: Number(refunds[0]?.count || 0), refundedAmountRub: Number(refunds[0]?.amount || 0), receiptsCreated: Number(receipts[0]?.count || 0) };
  }

  async #loadSource(customerId, sourceType, sourcePaymentId) {
    const type = String(sourceType || '').toUpperCase();
    if (type === 'PAYMENT') {
      const rows = await this.prisma.$queryRawUnsafe(`SELECT p."id",p."customerId",p."amountRub",p."provider",p."providerPaymentId",o."id" AS "orderId" FROM "Payment" p LEFT JOIN "Order" o ON o."paymentId"=p."id" WHERE p."id"=$1 AND p."customerId"=$2 LIMIT 1`, sourcePaymentId, customerId);
      const row = rows[0];
      if (!row || !row.providerPaymentId) throw notFound();
      return { sourceType: 'PAYMENT', sourcePaymentId: row.id, amountRub: Number(row.amountRub || 0), provider: String(row.provider || 'YOOKASSA').toUpperCase(), providerPaymentId: row.providerPaymentId, orderId: row.orderId || null, subscriptionId: null };
    }
    if (type === 'PRIVATE_CHANNEL') {
      const rows = await this.prisma.$queryRawUnsafe(`SELECT pp."id",pp."customerId",pp."amountRub",pp."provider",pp."providerPaymentId",pp."subscriptionId" FROM "PrivateChannelPayment" pp WHERE pp."id"=$1 AND pp."customerId"=$2 AND pp."status"='PAID' LIMIT 1`, sourcePaymentId, customerId);
      const row = rows[0];
      if (!row || !row.providerPaymentId) throw notFound();
      return { sourceType: 'PRIVATE_CHANNEL', sourcePaymentId: row.id, amountRub: Number(row.amountRub || 0), provider: String(row.provider || 'YOOKASSA').toUpperCase(), providerPaymentId: row.providerPaymentId, orderId: null, subscriptionId: row.subscriptionId };
    }
    throw validation('PAYMENT_REFUND_SOURCE_INVALID', 'Неизвестный источник платежа.');
  }

  async #notify(customerId, notification) {
    if (!this.customerProfileCommunicationService?.createSystemNotification) return;
    await this.customerProfileCommunicationService.createSystemNotification(customerId, notification);
  }
}

function normalizeRefundStatus(value) { const status = String(value || '').toLowerCase(); return status === 'succeeded' ? 'SUCCEEDED' : status === 'canceled' ? 'FAILED' : 'PENDING'; }
function validation(code, message) { return new ApiError({ statusCode: 400, code, message, source: 'payment_operations' }); }
function notFound() { return new ApiError({ statusCode: 404, code: 'PAYMENT_REFUND_SOURCE_NOT_FOUND', message: 'Платёж не найден или недоступен для возврата.', source: 'payment_operations' }); }
module.exports = { PaymentOperationsService, normalizeRefundStatus };
