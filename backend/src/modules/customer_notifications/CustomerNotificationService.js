'use strict';

const crypto = require('crypto');

const EVENT_TYPE = 'CUSTOMER_NOTIFICATION_DELIVERY_REQUESTED';
const KIND = Object.freeze({
  RECOGNITION_WELCOME: 'RECOGNITION_WELCOME',
  PURCHASE_COMPLETED: 'PURCHASE_COMPLETED',
  SMS_FALLBACK: 'SMS_FALLBACK',
});

class CustomerNotificationService {
  constructor({ outboxRepository, clock = () => new Date(), smsFallbackDelayMs = 3 * 60 * 60 * 1000 } = {}) {
    if (!outboxRepository) throw new Error('outboxRepository is required');
    Object.assign(this, { outboxRepository, clock, smsFallbackDelayMs });
  }

  recognitionWelcome(customerId, { machineId = null, correlationId = null } = {}) {
    return this.enqueue({
      customerId,
      kind: KIND.RECOGNITION_WELCOME,
      machineId,
      correlationId,
      availableAt: this.clock(),
      idempotencyKey: `customer-notification:recognition:${customerId}:${correlationId || machineId || 'terminal'}`,
    });
  }

  purchaseCompleted(orderId, customerId, { machineId = null, correlationId = null, transactionClient = null } = {}) {
    return this.enqueue({
      customerId,
      orderId,
      kind: KIND.PURCHASE_COMPLETED,
      machineId,
      correlationId,
      availableAt: this.clock(),
      idempotencyKey: `customer-notification:purchase:${orderId}`,
      transactionClient,
    });
  }

  scheduleSmsFallback(customerId, sourceEventId, { machineId = null, orderId = null, correlationId = null } = {}) {
    return this.enqueue({
      customerId,
      orderId,
      kind: KIND.SMS_FALLBACK,
      machineId,
      correlationId,
      availableAt: new Date(this.clock().getTime() + this.smsFallbackDelayMs),
      idempotencyKey: `customer-notification:sms-fallback:${sourceEventId}`,
      sourceEventId,
    });
  }

  async enqueue({ customerId, orderId = null, kind, machineId = null, correlationId = null, availableAt, idempotencyKey, transactionClient = null, sourceEventId = null }) {
    if (!customerId) throw new Error('customerId is required');
    const event = {
      eventId: `event_${crypto.randomUUID()}`,
      eventType: EVENT_TYPE,
      eventVersion: 1,
      aggregateType: 'CUSTOMER',
      aggregateId: customerId,
      organizationId: null,
      machineId,
      saleFlowId: null,
      payload: {
        customerId,
        kind,
        ...(orderId ? { orderId } : {}),
        ...(sourceEventId ? { sourceEventId } : {}),
      },
      status: 'PENDING',
      attemptCount: 0,
      maxAttempts: 5,
      availableAt,
      occurredAt: this.clock(),
      correlationId,
      causationId: sourceEventId,
      idempotencyKey,
    };
    try {
      if (transactionClient) return transactionClient.transactionalOutboxEvent.create({ data: event });
      return await this.outboxRepository.createEvent(event);
    } catch (error) {
      if (error?.code === 'P2002') return null;
      throw error;
    }
  }
}

module.exports = { CustomerNotificationService, EVENT_TYPE, KIND };
