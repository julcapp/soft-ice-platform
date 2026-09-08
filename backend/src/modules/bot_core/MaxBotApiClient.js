'use strict';

class MaxBotApiClient {
  constructor({ token, apiBaseUrl = 'https://platform-api2.max.ru', fetchImpl = globalThis.fetch, requestTimeoutMs = 15000 } = {}) {
    if (!token) throw new Error('MAX bot token is required.');
    if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required.');
    this.token = token;
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, '');
    this.fetch = fetchImpl;
    this.requestTimeoutMs = requestTimeoutMs;
    this.sendMessageContract = 'max_bot_api';
  }

  async call(path, { method = 'GET', query = {}, body } = {}) {
    const url = new URL(`${this.apiBaseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await this.fetch(url, {
        method,
        headers: { Authorization: this.token, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      let payload;
      try {
        payload = await response.json();
      } catch (error) {
        if (controller.signal.aborted) throw error;
        payload = null;
      }
      if (!response.ok) {
        const error = new Error(`MAX Bot API ${method} ${path} failed: ${payload?.message || `HTTP ${response.status}`}`);
        error.status = response.status;
        error.maxResponse = payload;
        throw error;
      }
      return payload;
    } catch (error) {
      if (controller.signal.aborted) throw providerTimeout('MAX_PROVIDER_TIMEOUT');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  sendMessage({ userId = null, chatId = null, text, attachments = null, format = null, notify = true } = {}) {
    const user = maxInteger(userId);
    const chat = maxInteger(chatId);
    if (!user && !chat) throw new Error('MAX destination userId or chatId is required.');
    if (typeof text !== 'string' || !text) throw new Error('MAX message text is required.');
    return this.call('/messages', {
      method: 'POST',
      query: user ? { user_id: user } : { chat_id: chat },
      body: {
        text,
        ...(attachments ? { attachments } : {}),
        ...(format ? { format } : {}),
        notify,
      },
    });
  }
}

function maxInteger(value) {
  const normalized = String(value || '');
  return /^-?\d{1,20}$/.test(normalized) ? normalized : null;
}

function providerTimeout(code) {
  return Object.assign(new Error('MAX Bot API request timed out.'), { code });
}

module.exports = { MaxBotApiClient, maxInteger };
