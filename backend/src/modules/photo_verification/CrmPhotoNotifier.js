const crypto = require('node:crypto');

class CrmPhotoNotifier {
  constructor({ crmRuntime, defaultChannel = null, logger = null } = {}) {
    this.crmRuntime = crmRuntime;
    this.defaultChannel = defaultChannel;
    this.logger = logger;
  }

  async notify({ customerId, photoChallengeId, correlationId, status, message, channel, publicationUrl }) {
    if (!this.crmRuntime?.queueNotification || !customerId || !message) {
      return { queued: false, reason: 'CRM_NOTIFICATION_RUNTIME_UNAVAILABLE' };
    }

    const notificationChannel = channel === 'VK' || channel === 'TELEGRAM' || channel === 'MAX'
      ? undefined
      : this.defaultChannel || undefined;
    const stableCorrelationId = correlationId || `photo_${photoChallengeId || crypto.randomUUID()}`;
    const idempotencyKey = `photo:${photoChallengeId || customerId}:${status || 'updated'}:${channel || 'customer'}`;
    const body = publicationUrl ? `${message}\n${publicationUrl}` : message;

    try {
      const delivery = await this.crmRuntime.queueNotification(customerId, {
        channel: notificationChannel,
        subject: 'Клуб Тимоши — статус фотографии',
        body,
      }, {
        actorId: 'photo-verification',
        authMethod: 'SYSTEM',
        correlationId: stableCorrelationId,
        idempotencyKey,
      });
      return { queued: true, deliveryId: delivery?.id || null };
    } catch (error) {
      this.logger?.warn?.('photo.notification.queue_failed', {
        customer_id: customerId,
        photo_challenge_id: photoChallengeId,
        status,
        code: error.code || 'PHOTO_NOTIFICATION_QUEUE_FAILED',
      });
      return { queued: false, reason: error.code || 'PHOTO_NOTIFICATION_QUEUE_FAILED' };
    }
  }
}

module.exports = { CrmPhotoNotifier };
