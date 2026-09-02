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
      metadata: {
        chatId: update.message?.recipient?.chat_id || update.chat_id || null,
        updateType: update.update_type || update.type || null,
      },
    };
  }
}

module.exports = {
  MaxAdapter,
};
