class OrderRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async create({ customerId, status, amount, currency, machineId = null, basePriceRub = null, promoDiscountRub = 0 }) {
    return this.prisma.order.create({
      data: {
        customerId,
        status,
        amount,
        currency,
        machineId,
        basePriceRub,
        promoDiscountRub,
        amountPaidRub: amount,
        paymentStatus: status === 'PAID' ? 'paid' : 'pending',
      },
    });
  }

  async findById(orderId) {
    return this.prisma.order.findUnique({ where: { id: orderId } });
  }

  async findByIdForCustomer(orderId, customerId) {
    return this.prisma.order.findFirst({ where: { id: orderId, customerId } });
  }

  async findByCustomerId(customerId, { limit = 50 } = {}) {
    return this.prisma.order.findMany({
      where: { customerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }

  async updateStatus(orderId, status, updates = {}) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        paymentStatus: status === 'PAID' ? 'paid' : undefined,
        paidAt: updates.paidAt || undefined,
      },
    });
  }

  async cancelPrepaidToBalance(orderId, cancelledAt = new Date()) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED_BY_CUSTOMER', activePickupCodeHash: null, cancelledToBalanceAt: cancelledAt, bonusEarned: 0 },
    });
  }

  async reserveForGift(orderId) {
    return this.prisma.order.updateMany({
      where: { id: orderId, status: 'PAID', paymentStatus: 'paid', cancelledToBalanceAt: null },
      data: { status: 'GIFT_TRANSFERRED', activePickupCodeHash: null, bonusEarned: 0 },
    }).then(async ({ count }) => {
      if (count !== 1) return null;
      return this.findById(orderId);
    });
  }

  async releaseGift(orderId) {
    return this.prisma.order.updateMany({
      where: { id: orderId, status: 'GIFT_TRANSFERRED', cancelledToBalanceAt: null },
      data: { status: 'PAID', activePickupCodeHash: null, bonusEarned: 0 },
    }).then(async () => this.findById(orderId));
  }

  async completeGift(orderId) {
    return this.prisma.order.updateMany({
      where: { id: orderId, status: 'GIFT_TRANSFERRED', cancelledToBalanceAt: null },
      data: { status: 'COMPLETED', activePickupCodeHash: null },
    }).then(async ({ count }) => count === 1 ? this.findById(orderId) : null);
  }
}

module.exports = { OrderRepository };
