const { toBlob, readJsonResponse } = require('./publisherMedia');

class MaxPhotoPublisher {
  constructor({ accessToken = process.env.MAX_BOT_TOKEN, fetchImpl = global.fetch, baseUrl = 'https://platform-api2.max.ru' } = {}) {
    this.accessToken = accessToken || null;
    this.fetch = fetchImpl;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async publish({ targetId, media, caption = '' }) {
    if (!this.accessToken) throw configuredError('MAX_BOT_TOKEN_NOT_CONFIGURED');
    if (!targetId) throw configuredError('MAX_TARGET_NOT_CONFIGURED');

    const uploadInitResponse = await this.fetch(`${this.baseUrl}/uploads?type=image`, {
      method: 'POST', headers: { Authorization: this.accessToken },
    });
    const uploadInit = await readJsonResponse(uploadInitResponse, 'MAX_UPLOAD_INIT_FAILED');
    if (!uploadInit.url) throw configuredError('MAX_UPLOAD_URL_NOT_RETURNED');

    const { blob, filename } = toBlob(media);
    const form = new FormData();
    form.set('data', blob, filename);
    const uploadResponse = await this.fetch(uploadInit.url, { method: 'POST', body: form });
    const uploaded = await readJsonResponse(uploadResponse, 'MAX_UPLOAD_FAILED');
    const token = uploaded.token || uploadInit.token;
    if (!token) throw configuredError('MAX_IMAGE_TOKEN_NOT_RETURNED');

    const messageResponse = await this.fetch(`${this.baseUrl}/messages?chat_id=${encodeURIComponent(String(targetId))}`, {
      method: 'POST',
      headers: { Authorization: this.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: caption || null,
        attachments: [{ type: 'image', payload: { token } }],
        notify: true,
      }),
    });
    const result = await readJsonResponse(messageResponse, 'MAX_PUBLISH_FAILED');
    const message = result.message;
    const messageId = message?.body?.mid || message?.mid || message?.id || message?.message_id;
    if (!messageId) throw configuredError('MAX_PUBLISH_NOT_CONFIRMED');
    return {
      externalPublicationId: String(messageId),
      publicationUrl: message.url || null,
      publishedAt: message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date(),
      confirmedAt: new Date(),
    };
  }
}

function configuredError(code) { const error = new Error(code); error.code = code; return error; }
module.exports = { MaxPhotoPublisher };
