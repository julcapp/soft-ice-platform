class OrderRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async create({ customerId, status, amount, currency }) {
    return this.prisma.order.create({
      data: {
        customerId,
        status,
        amount,
        currency,
        amountPaidRub: amount,
        paymentStatus: 'pending',
      },
    });
  }

  async findById(orderId) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
    });
  }

  async findByIdForCustomer(orderId, customerId) {
    return this.prisma.order.findFirst({
      where: {
        id: orderId,
        customerId,
      },
    });
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
}

module.exports = {
  OrderRepository,
};
