class CRMRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  // All account mutations and security audit entries commit in the same transaction.
  // Block metadata columns must exist before enabling block/unblock actions.
  async applyAccountAction({ customerId, plan, actorId, correlationId }) {
    if (!actorId) throw new Error('ADMIN_IDENTITY_REQUIRED');
    if (!['edit', 'block', 'unblock'].includes(plan.action)) throw new Error('UNSUPPORTED_ACCOUNT_ACTION');
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.customer.findUnique({ where: { id: customerId }, select: { id: true, status: true } });
      if (!current || current.status === 'deleted_released') throw new Error('CUSTOMER_NOT_AVAILABLE');
      let affected = 0;
      if (plan.action === 'edit') {
        affected = (await tx.customer.updateMany({ where: { id: customerId, status: { not: 'deleted_released' } }, data: { name: plan.name } })).count;
      } else if (plan.action === 'block') {
        affected = await tx.$executeRaw`
          UPDATE "Customer" SET "status"='blocked', "blockReason"=${plan.reason},
          "blockedAt"=NOW(), "blockedUntil"=${plan.until ? new Date(plan.until) : null},
          "updatedAt"=NOW() WHERE "id"=${customerId} AND "status"='active'
        `;
      } else {
        affected = await tx.$executeRaw`
          UPDATE "Customer" SET "status"='active', "blockReason"=NULL,
          "blockedAt"=NULL, "blockedUntil"=NULL, "updatedAt"=NOW()
          WHERE "id"=${customerId} AND "status"='blocked'
        `;
      }
      if (affected !== 1) throw new Error('CUSTOMER_ACTION_CONFLICT');
      await tx.auditEvent.create({ data: {
        eventType: 'CRM.CustomerAccountAction', subjectType: 'administrator', subjectId: actorId,
        targetType: 'Customer', targetId: customerId, action: plan.action, decision: 'success',
        sourceChannel: 'crm', correlationId: correlationId || null,
        metadata: { reason: plan.reason || null, until: plan.until || null, nameChanged: plan.action === 'edit' },
      } });
    });
    return this.findCustomer(customerId);
  }

  async hasExpiryScheduler() {
    // Fail closed until migration, timer and worker are installed and smoke-tested.
    return false;
  }

  async releaseExpiredBlocks(now, batchSize = 100) {
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('INVALID_EXPIRY_TIME');
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new RangeError('INVALID_EXPIRY_BATCH_SIZE');
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`
        WITH candidates AS (
          SELECT "id" FROM "Customer"
          WHERE "status" = 'blocked' AND "blockedUntil" IS NOT NULL
            AND "blockedUntil" <= ${now}
          ORDER BY "blockedUntil", "id"
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "Customer" AS c
        SET "status"='active', "blockReason"=NULL, "blockedAt"=NULL,
            "blockedUntil"=NULL, "updatedAt"=NOW()
        FROM candidates
        WHERE c."id" = candidates."id" AND c."status"='blocked'
        RETURNING c."id"
      `;
      for (const row of rows) {
        await tx.auditEvent.create({ data: {
          eventType: 'CRM.CustomerBlockExpired',
          subjectType: 'system', subjectId: 'crm-block-expiry',
          targetType: 'Customer', targetId: row.id,
          action: 'unblock', decision: 'success', sourceChannel: 'crm',
          occurredAt: now,
          metadata: { reason: 'temporary_block_expired', automatic: true },
        } });
      }
      return rows;
    });
  }

  async listCustomers({ query = '', limit = 50 } = {}) {
    const where = query ? {
      status: { not: 'deleted_released' },
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    } : { status: { not: 'deleted_released' } };
    return this.prisma.customer.findMany({
      where,
      take: Math.min(Number(limit) || 50, 100),
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      include: {
        clubAccount: true,
        bonusAccount: true,
        segmentAssignments: { where: { unassignedAt: null }, include: { segment: true } },
        orders: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  findCustomer(customerId) {
    return this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        clubAccount: { include: { transactions: { orderBy: { postedAt: 'desc' }, take: 50 } } },
        bonusAccount: true,
        bonusTransactions: { orderBy: { postedAt: 'desc' }, take: 50 },
        orders: { orderBy: { createdAt: 'desc' }, take: 50 },
        referralsMade: { orderBy: { createdAt: 'desc' }, take: 50 },
        referredBy: { orderBy: { createdAt: 'desc' }, take: 1 },
        segmentAssignments: {
          where: { unassignedAt: null },
          include: { segment: true },
          orderBy: { assignedAt: 'desc' },
        },
        crmProfile: true,
        notificationDeliveries: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
  }

  async adjustBonus(customerId, { amountBonus, reason, actorId }) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.bonusAccount.findUnique({ where: { customerId } });
      if (!account) throw Object.assign(new Error('Бонусный счёт клиента не найден.'), { statusCode: 404, code: 'BONUS_ACCOUNT_NOT_FOUND' });
      const delta = Number(amountBonus);
      const next = account.balanceBonus + delta;
      if (!Number.isInteger(delta) || delta === 0) throw Object.assign(new Error('Изменение бонусов должно быть целым ненулевым числом.'), { statusCode: 422, code: 'BONUS_ADJUSTMENT_INVALID' });
      if (next < 0) throw Object.assign(new Error('Недостаточно бонусов для списания.'), { statusCode: 422, code: 'BONUS_BALANCE_INSUFFICIENT' });
      const updated = await tx.bonusAccount.update({ where: { customerId }, data: { balanceBonus: next } });
      const transaction = await tx.bonusTransaction.create({
        data: {
          customerId,
          type: 'ADMIN_ADJUSTMENT',
          direction: delta > 0 ? 'credit' : 'debit',
          amountBonus: Math.abs(delta),
          source: 'ADMIN_CRM',
          reason: reason || 'Ручная корректировка администратором',
          balanceAfterBonus: next,
          comment: actorId ? 'Администратор: ' + actorId : null,
        },
      });
      return { account: updated, transaction };
    });
  }

  async eraseAndReleaseCustomer(customerId, { actorId, reason }) {
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) return null;

      await tx.authSession.deleteMany({ where: { customerId } });
      await tx.customerIdentity.deleteMany({ where: { customerId } });
      await tx.customerChannelSubscription.deleteMany({ where: { customerId } });
      await tx.customerExternalProfile.deleteMany({ where: { customerId } });
      await tx.customerPreference.deleteMany({ where: { customerId } });
      await tx.customerSegment.deleteMany({ where: { customerId } });
      await tx.crmCustomerProfile.deleteMany({ where: { customerId } });
      await tx.customerAiProfile.deleteMany({ where: { customerId } });

      const bonusAccount = await tx.bonusAccount.findUnique({ where: { customerId } });
      if (bonusAccount && bonusAccount.balanceBonus !== 0) {
        await tx.bonusTransaction.create({
          data: {
            customerId,
            type: 'ACCOUNT_CLOSURE',
            direction: 'debit',
            amountBonus: Math.max(0, bonusAccount.balanceBonus),
            source: 'ADMIN_CRM',
            reason: reason || 'Удаление пользователя и освобождение идентификаторов',
            balanceAfterBonus: 0,
            comment: actorId ? 'Администратор: ' + actorId : null,
          },
        });
        await tx.bonusAccount.update({ where: { customerId }, data: { balanceBonus: 0 } });
      }

      await tx.customer.update({
        where: { id: customerId },
        data: {
          phone: null,
          phoneVerifiedAt: null,
          primaryIdentityProvider: null,
          name: null,
          telegramId: null,
          telegramUsername: null,
          email: null,
          birthday: null,
          vkProfile: null,
          trustedStatus: false,
          trustedStatusAt: null,
          status: 'deleted_released',
        },
      });

      return { customerId, released: true };
    });
  }

  upsertProfile(customerId, data) {
    return this.prisma.crmCustomerProfile.upsert({
      where: { customerId },
      create: { customerId, ...data },
      update: data,
    });
  }

  listCampaigns() {
    return this.prisma.crmCampaign.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
  }

  createCampaign(data) {
    return this.prisma.crmCampaign.create({ data });
  }

  createNotification(data) {
    return this.prisma.crmNotificationDelivery.create({ data });
  }

  listNotifications({ limit = 50 } = {}) {
    return this.prisma.crmNotificationDelivery.findMany({
      take: Math.min(Number(limit) || 50, 100),
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: { campaign: true },
    });
  }

  async dashboard() {
    const [customers, activeCustomers, campaigns, queuedNotifications, orders, bonus] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customer.count({ where: { status: 'active' } }),
      this.prisma.crmCampaign.count({ where: { status: 'ACTIVE' } }),
      this.prisma.crmNotificationDelivery.count({ where: { status: { in: ['QUEUED', 'PENDING', 'SENDING'] } } }),
      this.prisma.order.aggregate({ _count: true, _sum: { amountPaidRub: true } }),
      this.prisma.bonusAccount.aggregate({ _sum: { balanceBonus: true } }),
    ]);
    return {
      customers,
      activeCustomers,
      campaigns,
      queuedNotifications,
      purchases: orders._count,
      revenueRub: Number(orders._sum.amountPaidRub || 0),
      bonusLiability: Number(bonus._sum.balanceBonus || 0),
    };
  }
}

module.exports = { CRMRepository };
