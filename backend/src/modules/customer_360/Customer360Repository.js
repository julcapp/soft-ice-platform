class Customer360Repository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findCustomer(customerId) {
    return this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        identities: { orderBy: { linkedAt: 'desc' } },
        consents: { include: { document: true }, orderBy: { consentedAt: 'desc' } },
        clubAccount: { include: { transactions: { orderBy: { postedAt: 'desc' }, take: 100 } } },
        bonusAccount: true,
        bonusTransactions: { orderBy: { postedAt: 'desc' }, take: 100 },
        orders: { orderBy: { createdAt: 'desc' }, take: 100 },
        referralsMade: { orderBy: { createdAt: 'desc' }, take: 100 },
        referredBy: { orderBy: { createdAt: 'desc' }, take: 1 },
        photoChallenges: { orderBy: { createdAt: 'desc' }, take: 100 },
        birthdayRewards: { orderBy: { issuedAt: 'desc' }, take: 100 },
        segmentAssignments: { where: { unassignedAt: null }, include: { segment: true } },
        notificationDeliveries: { orderBy: { createdAt: 'desc' }, take: 100 },
        customerPreferences: { orderBy: [{ category: 'asc' }, { key: 'asc' }] },
        promotionParticipations: { orderBy: { joinedAt: 'desc' }, take: 100 },
        gameActivities: { orderBy: { occurredAt: 'desc' }, take: 100 },
        aiProfile: true,
        timelineEvents: { orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 200 },
      },
    });
  }

  upsertPreference(customerId, input, actorId) {
    const key = { customerId_category_key: { customerId, category: input.category, key: input.key } };
    const data = { value: input.value, source: input.source, confidence: input.confidence, updatedBy: actorId };
    return this.prisma.customerPreference.upsert({
      where: key,
      create: { customerId, category: input.category, key: input.key, ...data },
      update: data,
    });
  }

  createTimelineEvent(data) {
    return this.prisma.customerTimelineEvent.create({ data });
  }
}

module.exports = { Customer360Repository };
