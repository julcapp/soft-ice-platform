class EmailDeliveryWorker {
  constructor({
    prisma,
    transport,
    clock = () => new Date(),
    maxAttempts = Number(process.env.MAIL_MAX_ATTEMPTS || 6),
    batchSize = Number(process.env.MAIL_BATCH_SIZE || 20),
    backoffSeconds = parseBackoff(process.env.MAIL_BACKOFF_SECONDS || '60,300,1800,7200,21600,43200'),
  }) {
    if (!prisma) throw new Error('prisma is required');
    if (!transport) throw new Error('transport is required');
    this.prisma = prisma;
    this.transport = transport;
    this.clock = clock;
    this.maxAttempts = Math.max(1, Number(maxAttempts) || 6);
    this.batchSize = Math.min(Math.max(Number(batchSize) || 20, 1), 100);
    this.backoffSeconds = backoffSeconds;
  }

  async runOnce() {
    const results = [];
    for (let i = 0; i < this.batchSize; i += 1) {
      const delivery = await this.#claimNext();
      if (!delivery) break;
      results.push(await this.#deliver(delivery));
    }
    return {
      checked: results.length,
      sent: results.filter((item) => item.status === 'SENT').length,
      failed: results.filter((item) => item.status === 'FAILED').length,
      results,
    };
  }

  async #claimNext() {
    const rows = await this.prisma.$queryRawUnsafe(
      `WITH candidate AS (
         SELECT "id"
         FROM "CrmNotificationDelivery"
         WHERE UPPER("channel")='EMAIL'
           AND (
             "status" IN ('PENDING','QUEUED')
             OR ("status"='FAILED' AND "nextAttemptAt" IS NOT NULL AND "nextAttemptAt" <= NOW())
             OR ("status"='SENDING' AND "lastAttemptAt" IS NOT NULL AND "lastAttemptAt" <= NOW() - INTERVAL '10 minutes')
           )
           AND COALESCE("attemptCount",0) < $1
         ORDER BY COALESCE("nextAttemptAt","createdAt") ASC, "createdAt" ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE "CrmNotificationDelivery" d
       SET "status"='SENDING',
           "attemptCount"=COALESCE(d."attemptCount",0)+1,
           "lastAttemptAt"=NOW(),
           "nextAttemptAt"=NULL,
           "updatedAt"=NOW()
       FROM candidate
       WHERE d."id"=candidate."id"
       RETURNING d."id",d."customerId",d."subject",d."body",d."recipientAddress",
                 d."attemptCount",d."correlationId",d."idempotencyKey"`,
      this.maxAttempts,
    );
    return rows?.[0] || null;
  }

  async #deliver(delivery) {
    try {
      const recipient = await this.#resolveRecipient(delivery);
      if (!recipient) throw workerError('EMAIL_RECIPIENT_MISSING', 'Email recipient is not available.');

      const result = await this.transport.send({
        to: recipient,
        subject: delivery.subject || 'У Тимоши',
        body: delivery.body,
      });

      await this.prisma.$executeRawUnsafe(
        `UPDATE "CrmNotificationDelivery"
         SET "status"='SENT',
             "providerId"=$2,
             "providerResponse"=$3,
             "failureReason"=NULL,
             "nextAttemptAt"=NULL,
             "sentAt"=$4,
             "updatedAt"=$4
         WHERE "id"=$1 AND "status"='SENDING'`,
        delivery.id,
        result?.messageId || null,
        truncate(result?.response, 1000),
        this.clock(),
      );

      return {
        id: delivery.id,
        status: 'SENT',
        recipient,
        attemptCount: Number(delivery.attemptCount || 1),
        providerMessageId: result?.messageId || null,
      };
    } catch (error) {
      const attemptCount = Number(delivery.attemptCount || 1);
      const nextAttemptAt = attemptCount >= this.maxAttempts
        ? null
        : new Date(this.clock().getTime() + this.#backoffFor(attemptCount) * 1000);
      const code = String(error?.code || 'EMAIL_DELIVERY_FAILED').slice(0, 120);
      const message = truncate(error?.message || String(error), 1000);

      await this.prisma.$executeRawUnsafe(
        `UPDATE "CrmNotificationDelivery"
         SET "status"='FAILED',
             "failureReason"=$2,
             "providerResponse"=$3,
             "nextAttemptAt"=$4,
             "updatedAt"=$5
         WHERE "id"=$1 AND "status"='SENDING'`,
        delivery.id,
        code,
        message,
        nextAttemptAt,
        this.clock(),
      );

      return {
        id: delivery.id,
        status: 'FAILED',
        attemptCount,
        errorCode: code,
        nextAttemptAt,
      };
    }
  }

  async #resolveRecipient(delivery) {
    if (delivery.recipientAddress) return normalizeEmail(delivery.recipientAddress);

    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT COALESCE(
           c."email",
           (
             SELECT v."email"
             FROM "CustomerEmailVerification" v
             WHERE v."customerId"=c."id" AND v."status"='VERIFIED'
             ORDER BY v."verifiedAt" DESC NULLS LAST, v."createdAt" DESC
             LIMIT 1
           )
         ) AS "email"
       FROM "Customer" c
       WHERE c."id"=$1
       LIMIT 1`,
      delivery.customerId,
    );
    return normalizeEmail(rows?.[0]?.email || null);
  }

  #backoffFor(attemptCount) {
    const index = Math.min(Math.max(Number(attemptCount) - 1, 0), this.backoffSeconds.length - 1);
    return this.backoffSeconds[index] || 60;
  }
}

function parseBackoff(value) {
  const items = String(value || '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
  return items.length ? items : [60, 300, 1800, 7200, 21600, 43200];
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function truncate(value, limit) {
  if (value == null) return null;
  return String(value).slice(0, limit);
}

function workerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

module.exports = { EmailDeliveryWorker, parseBackoff, normalizeEmail };
