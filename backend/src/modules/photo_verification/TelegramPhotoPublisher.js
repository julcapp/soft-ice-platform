const { toBlob, readJsonResponse } = require('./publisherMedia');

class TelegramPhotoPublisher {
  constructor({ botToken = process.env.TELEGRAM_BOT_TOKEN, fetchImpl = global.fetch } = {}) {
    this.botToken = botToken || null;
    this.fetch = fetchImpl;
  }

  async publish({ targetId, media, caption = '' }) {
    if (!this.botToken) throw configuredError('TELEGRAM_BOT_TOKEN_NOT_CONFIGURED');
    if (!targetId) throw configuredError('TELEGRAM_TARGET_NOT_CONFIGURED');
    if (!this.fetch) throw configuredError('FETCH_NOT_AVAILABLE');

    const { blob, filename } = toBlob(media);
    const form = new FormData();
    form.set('chat_id', String(targetId));
    if (caption) form.set('caption', String(caption).slice(0, 1024));
    form.set('photo', blob, filename);

    const response = await this.fetch(`https://api.telegram.org/bot${this.botToken}/sendPhoto`, { method: 'POST', body: form });
    const body = await readJsonResponse(response, 'TELEGRAM_PUBLISH_FAILED');
    if (!body.ok || !body.result?.message_id) {
      const error = new Error(body.description || 'Telegram did not confirm photo publication.');
      error.code = 'TELEGRAM_PUBLISH_NOT_CONFIRMED';
      throw error;
    }

    const messageId = String(body.result.message_id);
    const username = String(targetId).startsWith('@') ? String(targetId).slice(1) : null;
    return {
      externalPublicationId: messageId,
      publicationUrl: username ? `https://t.me/${username}/${messageId}` : null,
      publishedAt: body.result.date ? new Date(body.result.date * 1000) : new Date(),
      confirmedAt: new Date(),
    };
  }
}

function configuredError(code) { const error = new Error(code); error.code = code; return error; }
module.exports = { TelegramPhotoPublisher };
