class TelegramBotApiClient {
  constructor({ token, apiBaseUrl = 'https://api.telegram.org', fetchImpl = globalThis.fetch, features = {} } = {}) {
    if (!token) throw new Error('Telegram bot token is required.');
    if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required.');
    this.token = token;
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, '');
    this.fetch = fetchImpl;
    this.sendMessageContract = 'telegram_bot_api';
    this.features = Object.freeze({
      richMessages: features.richMessages === true,
      ephemeralMessages: features.ephemeralMessages === true,
      disabledButtons: features.disabledButtons === true,
    });
  }

  async call(method, payload = {}) {
    const response = await this.fetch(`${this.apiBaseUrl}/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let body;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok || !body?.ok) {
      const description = body?.description || `HTTP ${response.status}`;
      const error = new Error(`Telegram Bot API ${method} failed: ${description}`);
      error.status = response.status;
      error.telegramResponse = body;
      throw error;
    }

    return body.result;
  }

  sendMessage(chatId, text, options = {}) {
    return this.call('sendMessage', { chat_id: chatId, text, ...options });
  }

  sendRichMessage(chatId, richMessage, options = {}) {
    if (!richMessage || typeof richMessage !== 'object' || Array.isArray(richMessage)) {
      throw new Error('Telegram richMessage object is required.');
    }
    const contentFields = ['html', 'markdown', 'blocks'].filter((field) => richMessage[field] !== undefined);
    if (contentFields.length !== 1) {
      throw new Error('Telegram richMessage requires exactly one of html, markdown or blocks.');
    }
    return this.call('sendRichMessage', { chat_id: chatId, rich_message: richMessage, ...options });
  }

  answerCallbackQuery(callbackQueryId, options = {}) {
    return this.call('answerCallbackQuery', { callback_query_id: callbackQueryId, ...options });
  }

  getMe() {
    return this.call('getMe');
  }

  getWebhookInfo() {
    return this.call('getWebhookInfo');
  }

  setWebhook({ url, secretToken, allowedUpdates = ['message', 'callback_query'], dropPendingUpdates = false } = {}) {
    if (!url) throw new Error('Telegram webhook URL is required.');
    const payload = {
      url,
      allowed_updates: allowedUpdates,
      drop_pending_updates: dropPendingUpdates,
    };
    if (secretToken) payload.secret_token = secretToken;
    return this.call('setWebhook', payload);
  }

  deleteWebhook({ dropPendingUpdates = false } = {}) {
    return this.call('deleteWebhook', { drop_pending_updates: dropPendingUpdates });
  }
}

module.exports = { TelegramBotApiClient };
