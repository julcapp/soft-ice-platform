class BotTransportSender {
  constructor({ telegramClient = null, maxClient = null, clients = null } = {}) {
    this.telegramClient = telegramClient || clients?.telegram || null;
    this.maxClient = maxClient || clients?.max || null;
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

    if (this.telegramClient.sendMessageContract === 'telegram_bot_api') {
      if (!destination?.chatId) throw new Error('Telegram destination chatId is required.');
      const options = { reply_markup: rendered.reply_markup };
      const ephemeral = buildEphemeralParameters({
        destination,
        delivery: rendered.delivery,
        enabled: this.telegramClient.features?.ephemeralMessages === true,
      });
      if (ephemeral) options.ephemeral_message_parameters = ephemeral;

      if (rendered.rich_message && this.telegramClient.features?.richMessages === true) {
        if (typeof this.telegramClient.sendRichMessage !== 'function') {
          throw new Error('telegramClient.sendRichMessage is required when rich messages are enabled.');
        }
        return this.telegramClient.sendRichMessage(destination.chatId, rendered.rich_message, options);
      }

      return this.telegramClient.sendMessage(destination.chatId, rendered.text, options);
    }

    // Compatibility contract for transport fakes/legacy adapters that accept
    // one destination object plus one rendered payload object.
    return this.telegramClient.sendMessage(destination, rendered);
  }

  async sendMax(destination, rendered) {
    if (!this.maxClient) return { sent: false, reason: 'max_client_not_configured', preview: rendered };
    if (typeof this.maxClient.sendMessage !== 'function') throw new Error('maxClient.sendMessage is required.');
    return this.maxClient.sendMessage({ chatId: destination.chatId, userId: destination.userId, ...rendered });
  }
}

function buildEphemeralParameters({ destination, delivery, enabled }) {
  if (!enabled || delivery?.mode !== 'ephemeral' || delivery?.critical !== false) return null;
  const receiverUserId = telegramInteger(destination?.userId);
  if (receiverUserId === null) return null;
  const parameters = { receiver_user_id: receiverUserId };
  if (destination.callbackQueryId) parameters.callback_query_id = destination.callbackQueryId;
  if (delivery.replaceCallbackQueryMessage === true) parameters.replace_callback_query_message = true;
  return parameters;
}

function telegramInteger(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

module.exports = { BotTransportSender, buildEphemeralParameters };
