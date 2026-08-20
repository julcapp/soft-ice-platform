function createBotWebhookHandlers({ botRuntime, logger = console } = {}) {
  if (!botRuntime) throw new Error('botRuntime is required.');

  async function handleTelegram(req, res) {
    return handle('telegram', req, res);
  }

  async function handleMax(req, res) {
    return handle('max', req, res);
  }

  async function handle(channel, req, res) {
    try {
      await botRuntime.handle(channel, req.body || {});
      if (res?.status) return res.status(200).json({ ok: true });
      return { statusCode: 200, body: { ok: true } };
    } catch (error) {
      logger.error?.('bot_webhook_failed', { channel, message: error.message, stack: error.stack });
      if (res?.status) return res.status(500).json({ ok: false });
      return { statusCode: 500, body: { ok: false } };
    }
  }

  return { handleTelegram, handleMax };
}

module.exports = { createBotWebhookHandlers };
