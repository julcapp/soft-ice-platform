const { ApiError } = require('../../platform/errors/ApiError');

class TelegramPrivateChannelAccessAdapter {
  constructor({ botToken = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.PRIVATE_TELEGRAM_CHAT_ID, apiBase = 'https://api.telegram.org' } = {}) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.apiBase = String(apiBase).replace(/\/$/, '');
  }

  isConfigured() { return Boolean(this.botToken && this.chatId); }

  async createAccess({ customerId, validUntil }) {
    this.#assertConfigured();
    const expireDate = Math.floor(new Date(validUntil).getTime() / 1000);
    const result = await this.#call('createChatInviteLink', {
      chat_id: this.chatId,
      name: `cust-${String(customerId).slice(0, 20)}`,
      expire_date: expireDate,
      member_limit: 1,
    });
    return { inviteLink: result.invite_link, providerChatRef: String(this.chatId), expireDate };
  }

  async revokeAccess(inviteLink) {
    this.#assertConfigured();
    if (!inviteLink) return { revoked: false };
    await this.#call('revokeChatInviteLink', { chat_id: this.chatId, invite_link: inviteLink });
    return { revoked: true };
  }

  async #call(method, payload) {
    const response = await fetch(`${this.apiBase}/bot${this.botToken}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok !== true) {
      throw new ApiError({ statusCode: 502, code: 'TELEGRAM_PRIVATE_CHANNEL_ACCESS_FAILED', message: body.description || 'Telegram access request failed.', source: 'telegram_provider' });
    }
    return body.result;
  }

  #assertConfigured() {
    if (!this.isConfigured()) throw new ApiError({ statusCode: 503, code: 'PRIVATE_TELEGRAM_ACCESS_NOT_CONFIGURED', message: 'Private Telegram channel access is not configured.', source: 'telegram_provider' });
  }
}

module.exports = { TelegramPrivateChannelAccessAdapter };
