const { BotAdapter } = require('./BotAdapter');

class TelegramAdapter extends BotAdapter {
  constructor(client = null) {
    super('telegram');
    this.client = client;
  }

  normalizeInbound(update = {}) {
    const message = update.message || update.callback_query?.message || {};
    const from = update.message?.from || update.callback_query?.from || {};
    const text = update.message?.text || '';
    const startMatch = text.match(/^\/start(?:\s+(.+))?$/);

    return {
      channel: this.channel,
      externalUserId: from.id ? String(from.id) : null,
      payload: startMatch?.[1] || null,
      profile: {
        username: from.username || null,
        firstName: from.first_name || null,
        lastName: from.last_name || null,
        languageCode: from.language_code || null,
      },
      metadata: {
        chatId: message.chat?.id ? String(message.chat.id) : null,
        chatType: message.chat?.type || null,
        updateId: update.update_id || null,
      },
    };
  }
}

module.exports = {
  TelegramAdapter,
};
