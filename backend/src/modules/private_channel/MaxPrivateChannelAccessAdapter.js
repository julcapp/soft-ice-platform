const { ApiError } = require('../../platform/errors/ApiError');

class MaxPrivateChannelAccessAdapter {
  constructor({
    accessToken = process.env.MAX_BOT_TOKEN,
    chatId = process.env.PRIVATE_MAX_CHAT_ID,
    inviteLink = process.env.PRIVATE_MAX_INVITE_LINK,
    apiBase = 'https://platform-api2.max.ru',
  } = {}) {
    this.accessToken = accessToken;
    this.chatId = chatId;
    this.inviteLink = inviteLink;
    this.apiBase = String(apiBase).replace(/\/$/, '');
  }

  isConfigured() { return Boolean(this.accessToken && this.chatId && this.inviteLink); }

  async createAccess({ customerId, validUntil }) {
    this.#assertConfigured();
    // MAX private channels currently expose a channel invite link, but Bot API does not
    // allow a bot to add channel subscribers directly. Billing therefore gates delivery
    // of the configured private invite link; membership is verified separately.
    return {
      inviteLink: this.inviteLink,
      providerChatRef: String(this.chatId),
      validUntil,
      deliveryMode: 'PRIVATE_CHANNEL_INVITE_LINK',
      customerId,
    };
  }

  async verifyMembership(providerUserId) {
    this.#assertConfigured();
    if (!providerUserId) return { member: false, reason: 'PROVIDER_USER_ID_REQUIRED' };
    const response = await this.#request(`/chats/${encodeURIComponent(this.chatId)}/members`);
    const members = Array.isArray(response?.members) ? response.members : Array.isArray(response) ? response : [];
    return { member: members.some((item) => String(item.user_id) === String(providerUserId)) };
  }

  async revokeAccess({ providerUserId, block = true } = {}) {
    this.#assertConfigured();
    if (!providerUserId) return { revoked: false, reason: 'PROVIDER_USER_ID_REQUIRED' };
    const params = new URLSearchParams({ user_id: String(providerUserId), block: String(Boolean(block)) });
    const result = await this.#request(`/chats/${encodeURIComponent(this.chatId)}/members?${params}`, { method: 'DELETE' });
    return { revoked: result?.success !== false };
  }

  async #request(path, { method = 'GET' } = {}) {
    const response = await fetch(`${this.apiBase}${path}`, {
      method,
      headers: { Authorization: this.accessToken, Accept: 'application/json' },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.success === false) {
      throw new ApiError({
        statusCode: response.status === 403 ? 503 : 502,
        code: response.status === 403 ? 'MAX_PRIVATE_CHANNEL_MEMBER_CONTROL_UNAVAILABLE' : 'MAX_PRIVATE_CHANNEL_ACCESS_FAILED',
        message: body?.message || 'MAX private channel access request failed.',
        source: 'max_provider',
      });
    }
    return body;
  }

  #assertConfigured() {
    if (!this.isConfigured()) {
      throw new ApiError({
        statusCode: 503,
        code: 'PRIVATE_MAX_ACCESS_NOT_CONFIGURED',
        message: 'Private MAX channel access is not configured.',
        source: 'max_provider',
      });
    }
  }
}

module.exports = { MaxPrivateChannelAccessAdapter };
