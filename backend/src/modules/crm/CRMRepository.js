class CRMRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async listCustomers({ query = '', limit = 50 } = {}) {
    const where = query ? {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    } : {};
    return this.prisma.customer.findMany({
      where,
      take: Math.min(Number(limit) || 50, 100),
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      include: {
        clubAccount: true,
        bonusAccount: true,
        segmentAssignments: { where: { unassignedAt: null }, include: { segment: true } },
        orders: { orderBy: { createdAt: 'desc' }, take: 1 },
        channelSubscriptions: { where: { isSubscribed: true }, orderBy: { updatedAt: 'desc' } },
        _count: { select: { orders: true, referralsMade: true } },
      },
    });
  }

  findCustomer(customerId) {
    return this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        clubAccount: { include: { transactions: { orderBy: { postedAt: 'desc' }, take: 50 } } },
        bonusAccount: true,
        bonusTransactions: { orderBy: { postedAt: 'desc' }, take: 50 },
        orders: { orderBy: { createdAt: 'desc' }, take: 50 },
        referralsMade: { orderBy: { createdAt: 'desc' }, take: 50 },
        referredBy: { orderBy: { createdAt: 'desc' }, take: 1 },
        channelSubscriptions: { orderBy: { updatedAt: 'desc' } },
        externalProfiles: { orderBy: { updatedAt: 'desc' } },
        identities: { orderBy: { linkedAt: 'desc' } },
        segmentAssignments: {
          where: { unassignedAt: null },
          include: { segment: true },
          orderBy: { assignedAt: 'desc' },
        },
        crmProfile: true,
        notificationDeliveries: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
  }

  async findCustomersByIds(customerIds = []) {
    const ids = [...new Set(customerIds.filter(Boolean))];
    if (!ids.length) return [];
    return this.prisma.customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, phone: true, email: true, status: true },
    });
  }

  async findActiveSubscription(customerId, channelType) {
    return this.prisma.customerChannelSubscription.findFirst({
      where: {
        customerId,
        channelType: String(channelType || '').toUpperCase(),
        isSubscribed: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  upsertProfile(customerId, data) {
    return this.prisma.crmCustomerProfile.upsert({
      where: { customerId },
      create: { customerId, ...data },
      update: data,
    });
  }

  listCampaigns() {
    return this.prisma.crmCampaign.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
  }

  createCampaign(data) {
    return this.prisma.crmCampaign.create({ data });
  }

  createNotification(data) {
    return this.prisma.crmNotificationDelivery.create({ data });
  }

  listNotifications({ limit = 50 } = {}) {
    return this.prisma.crmNotificationDelivery.findMany({
      take: Math.min(Number(limit) || 50, 100),
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: { campaign: true },
    });
  }

  async dashboard() {
    const [customers, activeCustomers, campaigns, queuedNotifications, orders, bonus] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customer.count({ where: { status: 'active' } }),
      this.prisma.crmCampaign.count({ where: { status: 'ACTIVE' } }),
      this.prisma.crmNotificationDelivery.count({ where: { status: 'QUEUED' } }),
      this.prisma.order.aggregate({ _count: true, _sum: { amountPaidRub: true } }),
      this.prisma.bonusAccount.aggregate({ _sum: { balanceBonus: true } }),
    ]);
    return {
      customers,
      activeCustomers,
      campaigns,
      queuedNotifications,
      purchases: orders._count,
      revenueRub: Number(orders._sum.amountPaidRub || 0),
      bonusLiability: Number(bonus._sum.balanceBonus || 0),
    };
  }
}

module.exports = { CRMRepository };
