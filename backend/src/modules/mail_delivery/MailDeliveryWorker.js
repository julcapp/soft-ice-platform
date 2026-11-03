const DEFAULT_RETRY_DELAYS_MS = [
  60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
];

class PrismaMailDeliveryRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  recoverStaleSending({ before, now }) {
    return this.prisma.crmNotificationDelivery.updateMany({
      where: {
        channel: 'EMAIL',
        status: 'SENDING',
        lastAttemptAt: { lt: before },
      },
      data: {
        status: 'FAILED',
        failureReason: 'STALE_SENDING_RECOVERED',
        providerResponse: 'Worker recovered a stale SENDING delivery.',
        nextAttemptAt: now,
      },
    });
  }

  listCandidates({ now, maxAttempts, batchSize }) {
    return this.prisma.crmNotificationDelivery.findMany({
      where: {
        channel: 'EMAIL',
        status: { in: ['PENDING', 'QUEUED', 'FAILED'] },
        attemptCount: { lt: maxAttempts },
        OR: [
          { nextAttemptAt: null },
          { nextAttemptAt: { lte: now } },
        ],
      },
      include: {
        customer: {
          select: {
            email: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      take: batchSize,
    });
  }

  async claim(delivery, now) {
    const result = await this.prisma.crmNotificationDelivery.updateMany({
      where: {
        id: delivery.id,
        status: delivery.status,
        attemptCount: delivery.attemptCount,
      },
      data: {
        status: 'SENDING',
        attemptCount: { increment: 1 },
        lastAttemptAt: now,
        nextAttemptAt: null,
      },
    });
    return result.count === 1;
  }

  markSent(id, {
    sentAt,
    providerId,
    providerResponse,
  }) {
    return this.prisma.crmNotificationDelivery.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt,
        providerId: providerId || null,
        providerResponse: providerResponse || null,
        failureReason: null,
        nextAttemptAt: null,
      },
    });
  }

  markFailed(id, {
    failureReason,
    providerResponse,
    nextAttemptAt,
  }) {
    return this.prisma.crmNotificationDelivery.update({
      where: { id },
      data: {
        status: 'FAILED',
        failureReason,
        providerResponse: providerResponse || null,
        nextAttemptAt,
      },
    });
  }
}

class MailDeliveryWorker {
  constructor({
    repository,
    sendMail,
    clock = () => new Date(),
    logger = console,
    batchSize = 20,
    maxAttempts = 5,
    staleSendingMs = 5 * 60 * 1000,
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  }) {
    if (!repository) throw new Error('Mail delivery repository is required.');
    if (typeof sendMail !== 'function') throw new Error('Mail transport is required.');

    this.repository = repository;
    this.sendMail = sendMail;
    this.clock = clock;
    this.logger = logger;
    this.batchSize = Math.max(1, Number(batchSize) || 20);
    this.maxAttempts = Math.max(1, Number(maxAttempts) || 5);
    this.staleSendingMs = Math.max(30_000, Number(staleSendingMs) || 5 * 60 * 1000);
    this.retryDelaysMs = Array.isArray(retryDelaysMs) && retryDelaysMs.length
      ? retryDelaysMs.map((value) => Math.max(0, Number(value) || 0))
      : DEFAULT_RETRY_DELAYS_MS;
  }

  async runOnce() {
    const now = this.clock();
    const staleBefore = new Date(now.getTime() - this.staleSendingMs);

    await this.repository.recoverStaleSending({
      before: staleBefore,
      now,
    });

    const candidates = await this.repository.listCandidates({
      now,
      maxAttempts: this.maxAttempts,
      batchSize: this.batchSize,
    });

    const stats = {
      scanned: candidates.length,
      claimed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    };

    for (const delivery of candidates) {
      const claimed = await this.repository.claim(delivery, this.clock());
      if (!claimed) {
        stats.skipped += 1;
        continue;
      }

      stats.claimed += 1;
      const attemptNumber = Number(delivery.attemptCount || 0) + 1;
      const recipient = delivery.recipientAddress || delivery.customer?.email || null;

      if (!recipient) {
        await this.#fail(delivery.id, attemptNumber, new Error('Recipient email is missing.'));
        stats.failed += 1;
        continue;
      }

      try {
        const result = await this.sendMail({
          to: recipient,
          subject: delivery.subject || 'У Тимоши',
          body: delivery.body,
          correlationId: delivery.correlationId || null,
          deliveryId: delivery.id,
        });

        await this.repository.markSent(delivery.id, {
          sentAt: this.clock(),
          providerId: result?.messageId || null,
          providerResponse: result?.providerResponse || null,
        });
        stats.sent += 1;
      } catch (error) {
        await this.#fail(delivery.id, attemptNumber, error);
        stats.failed += 1;
      }
    }

    return stats;
  }

  async #fail(id, attemptNumber, error) {
    const now = this.clock();
    const smtpCode = extractSmtpCode(error);
    const failureReason = smtpCode
      ? `SMTP_${smtpCode}`
      : String(error?.code || 'SMTP_DELIVERY_FAILED').slice(0, 120);
    const providerResponse = String(error?.message || error || failureReason).slice(0, 1000);

    let nextAttemptAt = null;
    if (attemptNumber < this.maxAttempts) {
      const delayIndex = Math.min(
        Math.max(0, attemptNumber - 1),
        this.retryDelaysMs.length - 1,
      );
      nextAttemptAt = new Date(now.getTime() + this.retryDelaysMs[delayIndex]);
    }

    await this.repository.markFailed(id, {
      failureReason,
      providerResponse,
      nextAttemptAt,
    });

    this.logger.warn?.({
      event: 'mail.delivery.failed',
      delivery_id: id,
      attempt: attemptNumber,
      failure_reason: failureReason,
      next_attempt_at: nextAttemptAt?.toISOString() || null,
    });
  }
}

function extractSmtpCode(error) {
  const match = /SMTP error\s+(\d{3})/i.exec(String(error?.message || error || ''));
  return match ? Number(match[1]) : null;
}

module.exports = {
  DEFAULT_RETRY_DELAYS_MS,
  MailDeliveryWorker,
  PrismaMailDeliveryRepository,
  extractSmtpCode,
};
