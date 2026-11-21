'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { GiftTransferRepository, NotificationOrchestrator, NotificationChannelAdapter, GiftNotificationOutboxPublisher } = require('../src/modules/gift_transfer');

class SequenceAdapter extends NotificationChannelAdapter {
  constructor(channel, results) { super(channel); this.results = [...results]; this.calls = 0; }
  async send() { const result = this.results[Math.min(this.calls, this.results.length - 1)]; this.calls += 1; return result; }
}

function fixture({ expiresAt = new Date('2026-09-10T00:00:00Z') } = {}) {
  const repository = new GiftTransferRepository();
  const gift = { id: 'gift-1', recipientCustomerId: 'recipient-1', status: 'AVAILABLE', expiresAt, correlationId: 'corr-1', metadata: { senderName: 'Александр' } };
  const invitation = { id: 'invitation-1', giftTransferId: gift.id, status: 'CREATED', expiresAt };
  repository.saveTransfer(gift);
  repository.saveInvitation(invitation);
  const envelope = { eventType: 'GIFT_INVITATION_DELIVERY_REQUESTED', aggregateId: gift.id, correlationId: 'corr-1', payload: { giftTransferId: gift.id, invitationId: invitation.id, notificationId: `notification_${gift.id}`, channels: ['TELEGRAM', 'MAX'] } };
  return { repository, gift, invitation, envelope };
}

test('outbox publisher marks invitation SENT without exposing an action token', async () => {
  const { repository, invitation, envelope } = fixture();
  let observed;
  const telegram = new SequenceAdapter('TELEGRAM', [{ status: 'SENT', providerMessageId: 'tg-1' }]);
  telegram.send = async (notification) => { observed = notification; telegram.calls += 1; return { status: 'SENT', providerMessageId: 'tg-1' }; };
  const max = new SequenceAdapter('MAX', [{ status: 'UNAVAILABLE', failureCode: 'MAX_GIFT_NOTIFICATIONS_DISABLED' }]);
  const publisher = new GiftNotificationOutboxPublisher({ repository, notificationOrchestrator: new NotificationOrchestrator({ repository, adapters: [telegram, max] }), clock: () => new Date('2026-09-08T00:00:00Z') });

  await publisher.publish(envelope);

  assert.equal(invitation.status, 'SENT');
  assert.equal('actionToken' in observed, false);
  assert.equal('recipientPhoneNormalized' in observed, false);
});

test('retry after partial failure does not resend a successful Telegram notification', async () => {
  const { repository, envelope } = fixture();
  const telegram = new SequenceAdapter('TELEGRAM', [{ status: 'SENT', providerMessageId: 'tg-1' }]);
  const max = new SequenceAdapter('MAX', [{ status: 'FAILED', failureCode: 'PROVIDER_HTTP_503' }, { status: 'SENT', providerMessageId: 'max-1' }]);
  const publisher = new GiftNotificationOutboxPublisher({ repository, notificationOrchestrator: new NotificationOrchestrator({ repository, adapters: [telegram, max] }), clock: () => new Date('2026-09-08T00:00:00Z') });

  await assert.rejects(publisher.publish(envelope), (error) => error.code === 'GIFT_NOTIFICATION_DELIVERY_RETRY');
  await publisher.publish(envelope);

  assert.equal(telegram.calls, 1);
  assert.equal(max.calls, 2);
});

test('expired invitation is skipped without provider calls', async () => {
  const { repository, envelope } = fixture({ expiresAt: new Date('2026-09-07T00:00:00Z') });
  const telegram = new SequenceAdapter('TELEGRAM', [{ status: 'SENT' }]);
  const publisher = new GiftNotificationOutboxPublisher({ repository, notificationOrchestrator: new NotificationOrchestrator({ repository, adapters: [telegram] }), clock: () => new Date('2026-09-08T00:00:00Z') });

  const result = await publisher.publish(envelope);

  assert.equal(result.skipped, true);
  assert.equal(telegram.calls, 0);
});

test('invalid aggregate references are permanent and never reach a provider', async () => {
  const { repository, envelope } = fixture();
  const telegram = new SequenceAdapter('TELEGRAM', [{ status: 'SENT' }]);
  const publisher = new GiftNotificationOutboxPublisher({ repository, notificationOrchestrator: new NotificationOrchestrator({ repository, adapters: [telegram] }) });
  envelope.payload.invitationId = 'another-invitation';

  await assert.rejects(publisher.publish(envelope), (error) => error.code === 'GIFT_NOTIFICATION_EVENT_INVALID' && error.permanent === true);
  assert.equal(telegram.calls, 0);
});

test('missing recipient binding defers delivery without consuming provider retry budget', async () => {
  const { repository, envelope, invitation } = fixture();
  const telegram = new SequenceAdapter('TELEGRAM', [{ status: 'UNAVAILABLE', failureCode: 'TELEGRAM_RECIPIENT_NOT_BOUND' }]);
  const publisher = new GiftNotificationOutboxPublisher({
    repository,
    notificationOrchestrator: new NotificationOrchestrator({ repository, adapters: [telegram] }),
    clock: () => new Date('2026-09-08T00:00:00Z'),
    bindingRetryDelayMs: 60000,
  });

  await assert.rejects(publisher.publish({ ...envelope, payload: { ...envelope.payload, channels: ['TELEGRAM'] } }), (error) => {
    assert.equal(error.code, 'GIFT_NOTIFICATION_BINDING_PENDING');
    assert.equal(error.deferWithoutAttempt, true);
    assert.equal(error.availableAt.toISOString(), '2026-09-08T00:01:00.000Z');
    return true;
  });
  assert.equal(invitation.status, 'CREATED');
});

test('delivery resumes after recipient binding becomes available', async () => {
  const { repository, envelope, invitation } = fixture();
  const telegram = new SequenceAdapter('TELEGRAM', [
    { status: 'UNAVAILABLE', failureCode: 'TELEGRAM_RECIPIENT_NOT_BOUND' },
    { status: 'SENT', providerMessageId: 'tg-after-binding' },
  ]);
  const publisher = new GiftNotificationOutboxPublisher({
    repository,
    notificationOrchestrator: new NotificationOrchestrator({ repository, adapters: [telegram] }),
    clock: () => new Date('2026-09-08T00:00:00Z'),
  });
  const telegramEnvelope = { ...envelope, payload: { ...envelope.payload, channels: ['TELEGRAM'] } };

  await assert.rejects(publisher.publish(telegramEnvelope), (error) => error.deferWithoutAttempt === true);
  await publisher.publish(telegramEnvelope);

  assert.equal(invitation.status, 'SENT');
  assert.equal(telegram.calls, 2);
});

test('provider success cannot overwrite a concurrent gift cancellation', async () => {
  const { repository, envelope, gift, invitation } = fixture();
  const emitted = [];
  const telegram = new SequenceAdapter('TELEGRAM', [{ status: 'SENT', providerMessageId: 'tg-late' }]);
  telegram.send = async () => {
    gift.status = 'CANCELLED';
    invitation.status = 'CANCELLED';
    return { status: 'SENT', providerMessageId: 'tg-late' };
  };
  const publisher = new GiftNotificationOutboxPublisher({
    repository,
    notificationOrchestrator: new NotificationOrchestrator({ repository, adapters: [telegram] }),
    eventPublisher: { async publish(event) { emitted.push(event); } },
    clock: () => new Date('2026-09-08T00:00:00Z'),
  });

  const result = await publisher.publish({ ...envelope, payload: { ...envelope.payload, channels: ['TELEGRAM'] } });

  assert.equal(result.reason, 'GIFT_INVITATION_STATE_CHANGED');
  assert.equal(invitation.status, 'CANCELLED');
  assert.equal(emitted.length, 0);
});
