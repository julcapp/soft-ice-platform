'use strict';

const crypto = require('node:crypto');

class PaymentRepository {
  constructor(prisma) {
    if (!prisma) throw new Error('Prisma client is required.');
    this.prisma = prisma;
  }

  async createAttempt({ orderId, method, amount, currency, idempotencyKey, metadata = undefined }) {
    return this.prisma.paymentAttempt.create({
      data: {
        id: `payatt_${crypto.randomUUID()}`,
        orderId,
        provider: 'YOOKASSA',
        paymentMethod: method,
        status: 'CREATED',
        amount,
        currency,
        idempotencyKey,
        metadata,
      },
    });
  }

  async attachProviderPayment(id, payment) {
    return this.prisma.paymentAttempt.update({
      where: { id },
      data: {
        providerPaymentId: payment.id,
        status: String(payment.status || 'pending').toUpperCase(),
        confirmationUrl: payment.confirmation?.confirmation_url || null,
        metadata: { provider: payment },
      },
    });
  }

  async findByProviderPaymentId(providerPaymentId) {
    return this.prisma.paymentAttempt.findUnique({ where: { providerPaymentId } });
  }

  async findByOrderId(orderId) {
    return this.prisma.paymentAttempt.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  }

  async markSucceeded(id, providerPayment) {
    return this.prisma.paymentAttempt.update({
      where: { id },
      data: { status: 'SUCCEEDED', succeededAt: new Date(), metadata: { provider: providerPayment } },
    });
  }

  async markCancelled(id, providerPayment) {
    return this.prisma.paymentAttempt.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), metadata: { provider: providerPayment } },
    });
  }
}

module.exports = { PaymentRepository };
