'use strict';
const { defaultMessageJournal } = require('../message_center/MessageJournal');

class PromotionChannelWebhookDispatcher {
  constructor({ url, token = null, fetchImpl = globalThis.fetch, timeoutMs = 5000, messageJournal = null } = {}) {
    if (!url) throw new Error('Promotion channel dispatcher URL is required.');
    if (typeof fetchImpl !== 'function') throw new Error('Fetch implementation is required.');
    this.messageJournal = messageJournal;
    this.url = url;
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async send(input) {
    const journal = this.messageJournal || defaultMessageJournal();
    return journal ? journal.track({ source: 'PROMOTION', channel: input.channel, recipientType: 'CHANNEL', recipientName: `Аудитория ${input.channel}`, subject: input.campaign?.name || 'Уведомление об акции', body: input.message, correlationId: input.campaign?.id }, () => this.sendUntracked(input), (result) => ({ status: 'ACCEPTED', providerMessageId: result.deliveryId })) : this.sendUntracked(input);
  }

  async sendUntracked({ campaign, channel, message, startsAt, endsAt, event = 'promotion.pre_notification', deepLink = null }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      const response = await this.fetchImpl(this.url, {
        method: 'POST', headers, signal: controller.signal,
        body: JSON.stringify({
          event,
          channel,
          campaign_id: campaign.id,
          promotion_version_id: campaign.currentVersion.id,
          message,
          starts_at: startsAt,
          ends_at: endsAt,
          deep_link: deepLink || process.env.PROMOTION_DEEP_LINK || 'https://app.utimoshi.ru/',
        }),
      });
      if (!response.ok) {
        const error = new Error(`Promotion channel dispatcher returned HTTP ${response.status}.`);
        error.code = 'PROMOTION_CHANNEL_DISPATCH_FAILED';
        error.statusCode = 502;
        throw error;
      }
      const payload = await response.json().catch(() => ({}));
      return { accepted: true, status: response.status, deliveryId: payload.delivery_id || payload.id || null };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function createPromotionDispatchersFromEnv(env = process.env) {
  const result = {};
  for (const channel of ['TELEGRAM', 'MAX', 'VK']) {
    const url = env[`PROMOTION_${channel}_DISPATCH_URL`];
    if (!url) continue;
    result[channel] = new PromotionChannelWebhookDispatcher({ url, token: env[`PROMOTION_${channel}_DISPATCH_TOKEN`] || null });
  }
  return result;
}

module.exports = { PromotionChannelWebhookDispatcher, createPromotionDispatchersFromEnv };
