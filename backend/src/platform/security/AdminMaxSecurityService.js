const crypto = require('crypto');

class AdminMaxSecurityService {
  constructor({ prisma, auditRepository, env = process.env, fetchImpl = globalThis.fetch } = {}) {
    this.prisma = prisma;
    this.audit = auditRepository;
    this.env = env;
    this.fetch = fetchImpl;
  }

  verifyWebhookSecret(value) {
    const expected = String(this.env.ADMIN_SECURITY_MAX_WEBHOOK_SECRET || '');
    const actual = String(value || '');
    if (!expected || !actual) return false;
    const left = Buffer.from(expected);
    const right = Buffer.from(actual);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  }

  async handleUpdate(update = {}) {
    const type = String(update.update_type || '');
    if (type !== 'bot_started' && type !== 'message_created') {
      return { accepted: true, ignored: true };
    }

    const user = type === 'bot_started' ? update.user : update.message?.sender;
    const maxUserId = user?.user_id != null ? String(user.user_id) : '';
    if (!maxUserId) return { accepted: true, ignored: true };

    const chatId = type === 'bot_started'
      ? update.chat_id
      : (update.message?.recipient?.chat_id ?? update.chat_id ?? null);
    const timestamp = type === 'bot_started'
      ? update.timestamp
      : (update.message?.timestamp ?? update.timestamp);

    await this.prisma.$executeRawUnsafe(
      'UPDATE "AdminMaxLinkCandidate" SET "consumedAt"=NOW() WHERE "maxUserId"=$1 AND "consumedAt" IS NULL',
      maxUserId,
    );

    const rows = await this.prisma.$queryRawUnsafe(
      `INSERT INTO "AdminMaxLinkCandidate" ("maxUserId","chatId","firstName","lastName","username","startedAt")
       VALUES ($1,$2,$3,$4,$5,TO_TIMESTAMP($6 / 1000.0)) RETURNING *`,
      maxUserId,
      chatId != null ? String(chatId) : null,
      user?.first_name || user?.name || null,
      user?.last_name || null,
      user?.username || null,
      Number(timestamp || Date.now()),
    );

    await this.sendMaxMessage(maxUserId, 'Запрос на подключение MAX к безопасности Soft ICE получен. Вернитесь в личный кабинет владельца и подтвердите привязку.');
    return { accepted: true, candidateId: rows[0]?.id || null };
  }

  async listCandidates(securityContext) {
    return this.prisma.$queryRawUnsafe(
      `SELECT "id","maxUserId","chatId","firstName","lastName","username","startedAt","createdAt"
       FROM "AdminMaxLinkCandidate"
       WHERE "consumedAt" IS NULL
       ORDER BY "createdAt" DESC LIMIT 10`,
    );
  }

  async confirmCandidate(securityContext, candidateId, context = {}) {
    const rows = await this.prisma.$queryRawUnsafe(
      'SELECT * FROM "AdminMaxLinkCandidate" WHERE "id"=$1::uuid AND "consumedAt" IS NULL LIMIT 1',
      candidateId,
    );
    const candidate = rows[0];
    if (!candidate) {
      const error = new Error('Запрос на привязку MAX не найден или уже обработан.');
      error.statusCode = 400;
      error.code = 'ADMIN_MAX_LINK_CANDIDATE_INVALID';
      throw error;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'UPDATE "AdminUser" SET "maxUserId"=$2, "maxVerifiedAt"=NOW(), "updatedAt"=NOW() WHERE "id"=$1::uuid',
        securityContext.subject_id,
        candidate.maxUserId,
      );
      await tx.$executeRawUnsafe(
        'UPDATE "AdminMaxLinkCandidate" SET "confirmedByAdminUserId"=$2::uuid, "confirmedAt"=NOW(), "consumedAt"=NOW() WHERE "id"=$1::uuid',
        candidate.id,
        securityContext.subject_id,
      );
    });

    if (this.audit) {
      await this.audit.record({
        eventType: 'Admin.MaxSecurityLinked',
        subjectType: 'administrator',
        subjectId: securityContext.subject_id,
        targetType: 'AdminUser',
        targetId: securityContext.subject_id,
        action: 'link_max_security_channel',
        decision: 'success',
        reasonCode: 'owner_confirmed_candidate',
        authMethod: securityContext.auth_method,
        sourceChannel: 'admin_console',
        correlationId: context.correlationId || null,
        metadata: {
          max_user_id: candidate.maxUserId,
          max_username: candidate.username || null,
          ip_address: context.ipAddress || null,
          user_agent: context.userAgent || null,
        },
      });
    }

    await this.sendMaxMessage(candidate.maxUserId, 'MAX успешно подключён к безопасности Soft ICE. Теперь сюда будут приходить коды подтверждения административных операций.');
    return { linked: true, maxUserId: candidate.maxUserId, username: candidate.username || null };
  }

  async sendMaxMessage(userId, text) {
    const token = this.env.ADMIN_SECURITY_MAX_BOT_TOKEN;
    const baseUrl = String(this.env.MAX_API_BASE_URL || 'https://platform-api2.max.ru').replace(/\/$/, '');
    if (!token || !this.fetch) return false;
    const response = await this.fetch(`${baseUrl}/messages?user_id=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ text }),
    });
    return response.ok;
  }
}

module.exports = { AdminMaxSecurityService };
