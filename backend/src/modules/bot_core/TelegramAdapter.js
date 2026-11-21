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
    const contact = update.message?.contact;

    return {
      channel: this.channel,
      externalUserId: from.id ? String(from.id) : null,
      payload: startMatch?.[1] || null,
      contact: contact ? { phone: contact.phone_number,
        ownerUserId: contact.user_id == null ? null : String(contact.user_id),
        verified: message.chat?.type === 'private' && from.id != null && contact.user_id != null && String(contact.user_id) === String(from.id),
      } : null,
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
