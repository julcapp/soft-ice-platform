'use strict';

class ActivePromotionResolver {
  constructor({ prisma } = {}) {
    if (!prisma) throw new Error('Prisma client is required.');
    this.prisma = prisma;
  }

  async resolve({ customerId = null, machineId, channel, at = new Date() }) {
    const campaigns = await this.prisma.promotionCampaign.findMany({
      where: {
        status: 'ACTIVE',
        currentVersion: {
          startsAt: { lte: at },
          OR: [{ endsAt: null }, { endsAt: { gt: at } }],
          channels: { some: { channel, enabled: true } },
        },
      },
      include: {
        currentVersion: {
          include: { targets: true, audiences: true, rules: true, channels: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const applicable = campaigns.filter((campaign) => {
      const version = campaign.currentVersion;
      if (!version) return false;
      const targetOk = version.targets.some((target) => target.targetType === 'ALL_MACHINES' || (target.targetType === 'MACHINE' && target.targetId === machineId));
      if (!targetOk) return false;
      const audienceOk = version.audiences.some((audience) => audience.audienceType === 'ALL' || (customerId && ['CLUB_MEMBER','RETURNING_CUSTOMER','SEGMENT','PERSONAL'].includes(audience.audienceType)));
      return audienceOk;
    });

    if (applicable.length === 0) return null;
    applicable.sort((a, b) => (b.currentVersion.priority || 0) - (a.currentVersion.priority || 0));
    return applicable[0];
  }
}

module.exports = { ActivePromotionResolver };
