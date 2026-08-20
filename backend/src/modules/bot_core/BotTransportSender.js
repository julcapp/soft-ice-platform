class BotTransportSender {
  constructor({ telegramClient = null, maxClient = null } = {}) {
    this.telegramClient = telegramClient;
    this.maxClient = maxClient;
  }

  async send({ channel, destination, rendered }) {
    if (channel === 'telegram') return this.sendTelegram(destination, rendered);
    if (channel === 'max') return this.sendMax(destination, rendered);
    throw new Error(`Unsupported bot channel: ${channel}`);
  }

  async sendTelegram(destination, rendered) {
    if (!this.telegramClient) return { sent: false, reason: 'telegram_client_not_configured', preview: rendered };
    if (destination.callbackQueryId && typeof this.telegramClient.answerCallbackQuery === 'function') {
      await this.telegramClient.answerCallbackQuery(destination.callbackQueryId).catch(() => null);
    }
    if (typeof this.telegramClient.sendMessage !== 'function') throw new Error('telegramClient.sendMessage is required.');
    return this.telegramClient.sendMessage(destination.chatId, rendered.text, { reply_markup: rendered.reply_markup });
  }

  async sendMax(destination, rendered) {
    if (!this.maxClient) return { sent: false, reason: 'max_client_not_configured', preview: rendered };
    if (typeof this.maxClient.sendMessage !== 'function') throw new Error('maxClient.sendMessage is required.');
    return this.maxClient.sendMessage({ chatId: destination.chatId, userId: destination.userId, ...rendered });
  }
}

module.exports = { BotTransportSender };
