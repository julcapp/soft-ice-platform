'use strict';

class PromotionChannelWebhookDispatcher {
  constructor({ url, token = null, fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
    if (!url) throw new Error('Promotion channel dispatcher URL is required.');
    if (typeof fetchImpl !== 'function') throw new Error('Fetch implementation is required.');
    this.url = url;
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async send({ campaign, channel, message, startsAt, endsAt }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      const response = await this.fetchImpl(this.url, {
        method: 'POST', headers, signal: controller.signal,
        body: JSON.stringify({
          event: 'promotion.pre_notification',
          channel,
          campaign_id: campaign.id,
          promotion_version_id: campaign.currentVersion.id,
          message,
          starts_at: startsAt,
          ends_at: endsAt,
          deep_link: process.env.PROMOTION_DEEP_LINK || 'https://app.utimoshi.ru/',
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
