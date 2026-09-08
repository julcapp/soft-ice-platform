'use strict';

const EVENT_TYPE = 'GIFT_INVITATION_DELIVERY_REQUESTED';
const TERMINAL_GIFT_STATUSES = new Set(['ACCEPTED', 'REDEMPTION_READY', 'CANCELLED', 'EXPIRED', 'RETURNED_TO_SENDER', 'REDEEMED']);
const TERMINAL_INVITATION_STATUSES = new Set(['CLAIMED', 'CANCELLED', 'EXPIRED']);
const RETRYABLE_UNAVAILABLE_CODES = new Set([
  'TELEGRAM_RECIPIENT_NOT_BOUND',
  'MAX_RECIPIENT_NOT_BOUND',
  'TELEGRAM_ADAPTER_NOT_CONFIGURED',
  'MAX_ADAPTER_NOT_CONFIGURED',
  'CHANNEL_NOT_CONFIGURED',
]);

class GiftNotificationOutboxPublisher {
  constructor({ repository, notificationOrchestrator, eventPublisher = null, clock = () => new Date(), logger = console } = {}) {
    if (!repository || !notificationOrchestrator) throw new Error('repository and notificationOrchestrator are required.');
    Object.assign(this, { repository, notificationOrchestrator, eventPublisher, clock, logger });
  }

  async publish(envelope) {
    if (envelope.eventType !== EVENT_TYPE) throw permanent('GIFT_NOTIFICATION_EVENT_UNSUPPORTED');
    const payload = envelope.payload || {};
    const gift = await this.repository.findById(payload.giftTransferId || envelope.aggregateId);
    const invitation = await this.repository.findInvitationByGiftTransferId(payload.giftTransferId || envelope.aggregateId);
    if (!gift || !invitation) throw permanent('GIFT_NOTIFICATION_AGGREGATE_NOT_FOUND');
    if (!payload.notificationId
      || payload.giftTransferId !== envelope.aggregateId
      || payload.invitationId !== invitation.id
      || payload.notificationId !== `notification_${gift.id}`
      || !gift.recipientCustomerId
      || !validChannels(payload.channels)) {
      throw permanent('GIFT_NOTIFICATION_EVENT_INVALID');
    }

    if (TERMINAL_GIFT_STATUSES.has(gift.status)
      || TERMINAL_INVITATION_STATUSES.has(invitation.status)
      || new Date(invitation.expiresAt) <= this.clock()) {
      return { skipped: true, reason: 'GIFT_INVITATION_NOT_DELIVERABLE', attempts: [] };
    }

    const notification = {
      id: payload.notificationId,
      giftTransferId: gift.id,
      recipientCustomerId: gift.recipientCustomerId,
      channels: payload.channels || ['TELEGRAM', 'MAX'],
      template: 'GIFT_INVITATION',
      title: 'Вам подарили мороженое 🎁',
      senderName: gift.metadata?.senderName || null,
      correlationId: envelope.correlationId || gift.correlationId,
    };
    const attempts = await this.notificationOrchestrator.send(notification);
    const sent = attempts.some((row) => ['SENT', 'DELIVERED'].includes(row.status));
    if (sent && invitation.status !== 'SENT') {
      invitation.status = 'SENT';
      await this.repository.saveInvitation(invitation);
      await this.emitSent(gift, invitation, notification);
    }

    const retryable = attempts.filter((row) => row.status === 'FAILED'
      || (row.status === 'UNAVAILABLE' && RETRYABLE_UNAVAILABLE_CODES.has(row.failureCode)));
    if (retryable.length) {
      const error = new Error('Gift invitation delivery requires retry.');
      error.code = 'GIFT_NOTIFICATION_DELIVERY_RETRY';
      error.channels = retryable.map((row) => row.channel);
      throw error;
    }
    return { skipped: false, attempts };
  }

  async emitSent(gift, invitation, notification) {
    if (!this.eventPublisher?.publish) return;
    try {
      await this.eventPublisher.publish({
        type: 'GIFT_INVITATION_SENT',
        name: 'GIFT_INVITATION_SENT',
        eventType: 'GIFT_INVITATION_SENT',
        eventVersion: 1,
        aggregateType: 'GIFT_TRANSFER',
        aggregateId: gift.id,
        actorType: 'SYSTEM',
        actorId: 'gift_notification_outbox',
        sourceChannel: 'TRANSACTIONAL_OUTBOX',
        correlationId: notification.correlationId,
        idempotencyKey: `GIFT_INVITATION_SENT:${gift.id}`,
        payload: { invitationId: invitation.id, notificationId: notification.id },
        metadata: { eventCenter: true, sourceDomain: 'gift_transfer' },
      });
    } catch (error) {
      this.logger?.warn?.('gift.notification.sent_event_failed', { giftTransferId: gift.id, code: error.code || 'EVENT_PUBLISH_FAILED' });
    }
  }
}

function validChannels(channels) {
  return Array.isArray(channels)
    && channels.length > 0
    && channels.every((channel) => ['TELEGRAM', 'MAX'].includes(channel))
    && new Set(channels).size === channels.length;
}

function permanent(code) {
  const error = new Error(code);
  error.code = code;
  error.permanent = true;
  return error;
}

module.exports = { GiftNotificationOutboxPublisher, EVENT_TYPE, RETRYABLE_UNAVAILABLE_CODES };
