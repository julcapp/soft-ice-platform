class CrmDirectMessageSender {
  constructor({ prisma, fetchImpl = global.fetch, telegramToken = process.env.TELEGRAM_BOT_TOKEN || null, maxToken = process.env.MAX_BOT_TOKEN || null, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    if (!fetchImpl) throw new Error('fetch implementation is required');
    this.prisma = prisma;
    this.fetch = fetchImpl;
    this.telegramToken = telegramToken;
    this.maxToken = maxToken;
    this.clock = clock;
  }

  async run({ limit = 100 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT "id","customerId","channel","subject","body","status","idempotencyKey","createdAt"
       FROM "CrmNotificationDelivery"
       WHERE "status"='QUEUED' AND UPPER("channel") IN ('TELEGRAM','MAX')
       ORDER BY "createdAt" ASC LIMIT $1`, safeLimit,
    );
    const results = [];
    for (const row of rows) results.push(await this.#sendOne(row));
    return {
      checked: rows.length,
      sent: results.filter((item) => item.status === 'SENT').length,
      failed: results.filter((item) => item.status === 'FAILED').length,
      results,
    };
  }

  async #sendOne(delivery) {
    const channel = String(delivery.channel || '').toUpperCase();
    try {
      const recipient = await this.#resolveRecipient(delivery.customerId, channel);
      if (!recipient) throw senderError('DIRECT_RECIPIENT_NOT_LINKED', `Нет идентификатора получателя ${channel}.`);
      const result = channel === 'TELEGRAM'
        ? await this.#sendTelegram(recipient, delivery.body)
        : await this.#sendMax(recipient, delivery.body);
      await this.prisma.$executeRawUnsafe(`UPDATE "CrmNotificationDelivery" SET "status"='SENT' WHERE "id"=$1 AND "status"='QUEUED'`, delivery.id);
      await this.#syncEscalationDelivery(delivery.id, 'SENT', result.messageId || null, null, null);
      return { id: delivery.id, channel, status: 'SENT', providerMessageId: result.messageId || null };
    } catch (error) {
      await this.prisma.$executeRawUnsafe(`UPDATE "CrmNotificationDelivery" SET "status"='FAILED' WHERE "id"=$1 AND "status"='QUEUED'`, delivery.id);
      await this.#syncEscalationDelivery(delivery.id, 'FAILED', null, error.code || 'DIRECT_SEND_FAILED', error.message || 'Не удалось отправить сообщение.');
      return { id: delivery.id, channel, status: 'FAILED', errorCode: error.code || 'DIRECT_SEND_FAILED' };
    }
  }

  async #resolveRecipient(customerId, channel) {
    const profiles = await this.prisma.$queryRawUnsafe(
      `SELECT "externalUserId","isVerified","status" FROM "CustomerExternalProfile"
       WHERE "customerId"=$1 AND UPPER("channelType")=$2
       ORDER BY "isVerified" DESC,"updatedAt" DESC LIMIT 1`, customerId, channel,
    );
    const profile = profiles[0];
    if (profile?.externalUserId && profile.isVerified) return String(profile.externalUserId);
    if (channel !== 'TELEGRAM') return null;
    const customers = await this.prisma.$queryRawUnsafe(`SELECT "telegramId" FROM "Customer" WHERE "id"=$1 LIMIT 1`, customerId);
    return customers[0]?.telegramId ? String(customers[0].telegramId) : null;
  }

  async #sendTelegram(userId, text) {
    if (!this.telegramToken) throw senderError('TELEGRAM_BOT_TOKEN_MISSING', 'Telegram bot token is not configured.');
    const response = await this.fetch(`https://api.telegram.org/bot${this.telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: userId, text: String(text || '').slice(0, 4096) }),
    });
    const body = await safeJson(response);
    if (!response.ok || !body?.ok) throw senderError(`TELEGRAM_HTTP_${response.status}`, body?.description || 'Telegram sendMessage failed.');
    return { messageId: body?.result?.message_id != null ? String(body.result.message_id) : null };
  }

  async #sendMax(userId, text) {
    if (!this.maxToken) throw senderError('MAX_BOT_TOKEN_MISSING', 'MAX bot token is not configured.');
    const url = `https://platform-api2.max.ru/messages?user_id=${encodeURIComponent(userId)}`;
    const response = await this.fetch(url, {
      method: 'POST',
      headers: { Authorization: this.maxToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: String(text || '').slice(0, 4000) }),
    });
    const body = await safeJson(response);
    if (!response.ok) throw senderError(`MAX_HTTP_${response.status}`, body?.message || body?.error || 'MAX message send failed.');
    const messageId = body?.message?.body?.mid || body?.message?.mid || body?.mid || null;
    return { messageId: messageId != null ? String(messageId) : null };
  }

  async #syncEscalationDelivery(crmDeliveryId, status, providerMessageId, failureCode, failureMessage) {
    const now = this.clock();
    await this.prisma.$executeRawUnsafe(
      `UPDATE "AdminOperationsEscalationDelivery"
       SET "status"=$2,"providerMessageId"=$3,"failureCode"=$4,"failureMessage"=$5,
           "sentAt"=CASE WHEN $2='SENT' THEN COALESCE("sentAt",$6) ELSE "sentAt" END,"updatedAt"=$6
       WHERE "crmDeliveryId"=$1`, crmDeliveryId, status, providerMessageId, failureCode, failureMessage, now,
    );
  }
}

async function safeJson(response) { try { return await response.json(); } catch { return null; } }
function senderError(code, message) { const error = new Error(message); error.code = code; return error; }
module.exports = { CrmDirectMessageSender };
