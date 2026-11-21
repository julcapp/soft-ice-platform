'use strict';

const crypto = require('node:crypto');
const { BotAdapter } = require('./BotAdapter');

class MaxAdapter extends BotAdapter {
  constructor(client = null) {
    super('max');
    this.client = client;
  }

  normalizeInbound(update = {}) {
    const sender = update.sender || update.user || update.message?.sender || {};
    const text = update.message?.body?.text || update.message?.text || update.text || '';
    const startMatch = String(text).match(/^\/start(?:\s+(.+))?$/);
    const contact = extractVerifiedContact(update, this.client?.token || null);

    return {
      channel: this.channel,
      externalUserId: sender.user_id || sender.id ? String(sender.user_id || sender.id) : null,
      payload: startMatch?.[1] || update.start_payload || update.payload || null,
      profile: {
        username: sender.username || null,
        firstName: sender.first_name || sender.firstName || null,
        lastName: sender.last_name || sender.lastName || null,
        languageCode: sender.language_code || null,
      },
      contact,
      metadata: {
        chatId: update.message?.recipient?.chat_id || update.chat_id || null,
        updateType: update.update_type || update.type || null,
      },
    };
  }
}

function extractVerifiedContact(update, token) {
  const attachments = update.message?.body?.attachments
    || update.message?.attachments
    || update.attachments
    || [];
  const attachment = Array.isArray(attachments)
    ? attachments.find((item) => item?.type === 'contact' && item?.payload?.vcf_info)
    : null;

  if (!attachment) return null;

  const payload = attachment.payload || {};
  const vcfInfo = normalizeVcf(payload.vcf_info);
  const phone = extractPhoneFromVcf(vcfInfo);

  return {
    phone,
    verified: Boolean(token && payload.hash && verifyMaxContactHash({ token, vcfInfo, hash: payload.hash })),
    hasVerificationHash: Boolean(payload.hash),
  };
}

function verifyMaxContactHash({ token, vcfInfo, hash } = {}) {
  if (!token || !vcfInfo || !hash) return false;
  const expected = crypto.createHmac('sha256', String(token)).update(normalizeVcf(vcfInfo), 'utf8').digest('hex');
  const actual = String(hash).trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(actual)) return false;
  return timingSafeTextEqual(expected, actual);
}

function extractPhoneFromVcf(vcfInfo) {
  const match = String(vcfInfo || '').match(/^TEL(?:;[^:]*)?:(.+)$/mi);
  if (!match) return null;
  const digits = match[1].replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith('7')) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

function normalizeVcf(value) {
  return String(value || '').replace(/\\r\\n/g, '\r\n');
}

function timingSafeTextEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  MaxAdapter,
  extractVerifiedContact,
  verifyMaxContactHash,
  extractPhoneFromVcf,
};
