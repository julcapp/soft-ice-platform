'use strict';

const FUNNEL_CHANNELS = ['TELEGRAM', 'MAX', 'VK'];

class PromotionAnalyticsService {
  constructor({ prisma, clock = () => new Date() } = {}) {
    if (!prisma) throw new Error('Prisma client is required.');
    this.prisma = prisma;
    this.clock = clock;
  }

  async ingestDeliveryReceipt({ campaignId, promotionVersionId, channel, deliveryId = null, deliveredCount = 1, sourceEvent = null }) {
    const normalizedChannel = String(channel || '').toUpperCase();
    if (!FUNNEL_CHANNELS.includes(normalizedChannel) || !campaignId || !promotionVersionId) {
      const error = new Error('Invalid promotion delivery receipt.');
      error.code = 'PROMOTION_DELIVERY_RECEIPT_INVALID';
      error.statusCode = 400;
      throw error;
    }
    const count = Math.max(0, Number(deliveredCount || 0));
    return this.prisma.promotionEvent.create({
      data: {
        campaignId,
        promotionVersionId,
        eventType: 'CHANNEL_DELIVERED',
        actorType: 'CHANNEL_GATEWAY',
        actorId: normalizedChannel,
        newValue: { channel: normalizedChannel, deliveryId, deliveredCount: count, sourceEvent },
        metadata: { funnelEvent: 'DELIVERED', channel: normalizedChannel },
        occurredAt: this.clock(),
      },
    });
  }

  async getFunnel({ campaignId, promotionVersionId = null }) {
    const rows = await this.prisma.promotionEvent.findMany({
      where: {
        campaignId,
        ...(promotionVersionId ? { promotionVersionId } : {}),
        eventType: { in: ['CHANNEL_DELIVERED', 'CHANNEL_OPENED', 'CHANNEL_CLICKED', 'CHANNEL_PURCHASE', 'PRE_NOTIFICATION_SENT', 'START_NOTIFICATION_SENT', 'END_NOTIFICATION_SENT'] },
      },
      select: { eventType: true, newValue: true, metadata: true },
    });
    const result = Object.fromEntries(FUNNEL_CHANNELS.map((channel) => [channel, { dispatchAccepted: 0, delivered: 0, opened: 0, clicked: 0, purchase: 0 }]));
    for (const row of rows) {
      const channel = String(row.newValue?.channel || row.metadata?.channel || '').toUpperCase();
      if (!result[channel]) continue;
      if (['PRE_NOTIFICATION_SENT', 'START_NOTIFICATION_SENT', 'END_NOTIFICATION_SENT'].includes(row.eventType)) result[channel].dispatchAccepted += 1;
      if (row.eventType === 'CHANNEL_DELIVERED') result[channel].delivered += Number(row.newValue?.deliveredCount || 1);
      if (row.eventType === 'CHANNEL_OPENED') result[channel].opened += 1;
      if (row.eventType === 'CHANNEL_CLICKED') result[channel].clicked += 1;
      if (row.eventType === 'CHANNEL_PURCHASE') result[channel].purchase += 1;
    }
    for (const metrics of Object.values(result)) {
      metrics.openRate = metrics.delivered ? metrics.opened / metrics.delivered : 0;
      metrics.ctr = metrics.delivered ? metrics.clicked / metrics.delivered : 0;
      metrics.purchaseConversion = metrics.delivered ? metrics.purchase / metrics.delivered : 0;
      metrics.clickToPurchase = metrics.clicked ? metrics.purchase / metrics.clicked : 0;
    }
    return { campaignId, promotionVersionId, channels: result };
  }
}

module.exports = { PromotionAnalyticsService, FUNNEL_CHANNELS };
