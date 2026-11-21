'use strict';

const { sha256 } = require('../../platform/security/hash');

const SUPPORTED_CHANNELS = new Set(['telegram', 'max']);

class BotRecipientBindingService {
  constructor({ repository, customerRepository, codec, clock = () => new Date(), logger = console } = {}) {
    if (!repository || !customerRepository || !codec) throw new Error('repository, customerRepository and codec are required.');
    Object.assign(this, { repository, customerRepository, codec, clock, logger });
  }

  async observeInbound({ customerId, channel, externalUserId, metadata = {} }) {
    if (!customerId || !SUPPORTED_CHANNELS.has(channel)) return null;
    const subject = providerInteger(externalUserId);
    if (!subject) return null;

    const identity = await this.customerRepository.findByIdentity(channel, sha256(subject));
    if (!identity || identity.customer?.id !== customerId) throw bindingRejected('BOT_RECIPIENT_IDENTITY_MISMATCH');

    const recipient = recipientFromInbound(channel, subject, metadata);
    if (!recipient) return null;
    const now = this.clock();
    const associatedData = `${customerId}:${channel}`;
    return this.repository.upsert({
      customerId,
      channel,
      externalSubjectHash: sha256(subject),
      recipientCiphertext: this.codec.encrypt(recipient.value, associatedData),
      recipientType: recipient.type,
      keyVersion: this.codec.keyVersion,
      status: 'ACTIVE',
      source: 'TRUSTED_BOT_WEBHOOK',
      verifiedAt: now,
      lastSeenAt: now,
    });
  }

  async resolve(customerId, channel) {
    if (!customerId || !SUPPORTED_CHANNELS.has(channel)) return null;
    const row = await this.repository.findActive(customerId, channel);
    if (!row) return null;
    try {
      return {
        channel,
        recipientType: row.recipientType,
        recipientId: this.codec.decrypt(row.recipientCiphertext, `${customerId}:${channel}`),
        verifiedAt: row.verifiedAt,
      };
    } catch (error) {
      this.logger?.error?.('bot.recipient_binding.decrypt_failed', { customerId, channel, code: error.code });
      return null;
    }
  }
}

function recipientFromInbound(channel, subject, metadata) {
  if (channel === 'telegram') {
    const chatId = providerInteger(metadata.chatId);
    if (metadata.chatType !== 'private' || !chatId || chatId !== subject) return null;
    return { type: 'chat_id', value: chatId };
  }
  if (channel === 'max') return { type: 'user_id', value: subject };
  return null;
}

function providerInteger(value) {
  const normalized = String(value || '');
  return /^\d{1,20}$/.test(normalized) ? normalized : null;
}

function bindingRejected(code) {
  const error = new Error('Inbound bot identity does not match the authenticated customer.');
  error.code = code;
  error.statusCode = 403;
  return error;
}

module.exports = { BotRecipientBindingService, providerInteger, recipientFromInbound };
