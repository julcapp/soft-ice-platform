'use strict';

class ExolveSmsClient {
  constructor({
    apiKey,
    sender,
    apiBaseUrl = 'https://api.exolve.ru',
    fetchImpl = globalThis.fetch,
    requestTimeoutMs = 15000,
  } = {}) {
    if (!apiKey) throw new Error('Exolve SMS apiKey is required.');
    if (!sender) throw new Error('Exolve SMS sender is required.');
    if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required.');
    Object.assign(this, { apiKey, sender, apiBaseUrl: apiBaseUrl.replace(/\/$/, ''), fetchImpl, requestTimeoutMs });
  }

  async sendMessage({ to, text } = {}) {
    const destination = normalizeDestination(to);
    if (!destination) throw problem('EXOLVE_SMS_DESTINATION_INVALID', 400);
    if (typeof text !== 'string' || !text.trim()) throw problem('EXOLVE_SMS_TEXT_REQUIRED', 400);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    let response;
    try {
      response = await this.fetchImpl(`${this.apiBaseUrl}/messaging/v1/SendSMS`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: this.sender,
          destination,
          text: text.trim(),
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw problem('EXOLVE_SMS_TIMEOUT', 504);
      throw problem('EXOLVE_SMS_NETWORK_ERROR', 503);
    } finally {
      clearTimeout(timeout);
    }

    let body = null;
    try { body = await response.json(); } catch {}
    if (!response.ok) {
      const error = problem(`EXOLVE_SMS_HTTP_${response.status}`, response.status);
      error.providerBody = body && typeof body === 'object' ? sanitize(body) : null;
      throw error;
    }
    return {
      id: body?.message_id ? String(body.message_id) : null,
      messageId: body?.message_id ? String(body.message_id) : null,
      templateResourceId: body?.template_resource_id ? String(body.template_resource_id) : null,
    };
  }
}

function normalizeDestination(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return /^7\d{10}$/.test(digits) ? digits : null;
}
function problem(code, statusCode) { return Object.assign(new Error(code), { code, statusCode }); }
function sanitize(value) {
  const out = {};
  for (const [key, child] of Object.entries(value || {})) {
    if (!/(token|secret|authorization|api.?key|credential)/i.test(key)) out[key] = typeof child === 'string' ? child.slice(0, 500) : child;
  }
  return out;
}

module.exports = { ExolveSmsClient, normalizeDestination };
