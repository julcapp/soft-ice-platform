const fs = require('fs');

const TOMSK_OFFSET_MS = 7 * 60 * 60 * 1000;
const BACKUP_LOG = '/home/julcapp/softice-backups/logs/monthly-backup.log';

function nextMonthlyTomsk(now = new Date()) {
  const tomsk = new Date(now.getTime() + TOMSK_OFFSET_MS);
  let year = tomsk.getUTCFullYear();
  let month = tomsk.getUTCMonth() + 1;
  const passed = tomsk.getUTCDate() > 1 || tomsk.getUTCHours() > 0 || (tomsk.getUTCHours() === 0 && tomsk.getUTCMinutes() >= 20);
  if (passed) {
    month += 1;
    if (month === 13) { month = 1; year += 1; }
  }
  return new Date(Date.UTC(year, month - 1, 1, -7, 20, 0, 0)).toISOString();
}

function readBackupLog() {
  try {
    const lines = fs.readFileSync(BACKUP_LOG, 'utf8').trim().split(/\r?\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try {
        const row = JSON.parse(lines[i]);
        if (row && row.ok === true) return row;
      } catch {}
    }
  } catch {}
  return null;
}

class SchedulerService {
  constructor({ clock = () => new Date(), prisma = null } = {}) {
    this.clock = clock;
    this.prisma = prisma;
  }

  async runtimeFacts() {
    if (!this.prisma) return {};
    const [payment, commands, recovery, renewals, autoTopups] = await Promise.all([
      this.prisma.paymentProviderInbox.aggregate({
        _max: { processedAt: true, receivedAt: true },
        _count: { _all: true },
      }).catch(() => null),
      this.prisma.transactionalOutboxEvent.groupBy({
        by: ['status'],
        where: { eventType: 'MACHINE_COMMAND_QUEUED' },
        _count: { _all: true },
        _max: { updatedAt: true },
      }).catch(() => []),
      this.prisma.machineDispenseAttempt.groupBy({
        by: ['status'],
        _count: { _all: true },
        _max: { updatedAt: true },
      }).catch(() => []),
      this.prisma.$queryRawUnsafe(`
        SELECT
          (SELECT COUNT(*)::int FROM "PrivateChannelSubscription" WHERE "status"='ACTIVE' AND "recurringEnabled"=TRUE AND "cancelAtPeriodEnd"=FALSE AND "providerPaymentMethodRef" IS NOT NULL AND "currentPeriodEnd" IS NOT NULL AND "currentPeriodEnd" <= CURRENT_TIMESTAMP) AS "dueCount",
          (SELECT MAX("updatedAt") FROM "PrivateChannelRenewalAttempt") AS "lastActivityAt",
          (SELECT COUNT(*)::int FROM "PrivateChannelRenewalAttempt" WHERE "status"='FAILED') AS "failedCount",
          (SELECT COUNT(*)::int FROM "PrivateChannelRenewalAttempt" WHERE "status"='EXHAUSTED') AS "exhaustedCount",
          (SELECT COUNT(*)::int FROM "PrivateChannelRenewalAttempt" WHERE "status"='PAID') AS "paidCount"
      `).then((rows) => rows?.[0] || null).catch(() => null),
      this.prisma.$queryRawUnsafe(`
        SELECT
          (SELECT COUNT(*)::int FROM "CustomerAutoTopupSchedule" WHERE "status"='ACTIVE') AS "activeCount",
          (SELECT COUNT(*)::int FROM "CustomerAutoTopupSchedule" WHERE "status"='ACTIVE' AND "nextChargeAt" IS NOT NULL AND "nextChargeAt" <= CURRENT_TIMESTAMP) AS "dueCount",
          (SELECT MAX("updatedAt") FROM "CustomerAutoTopupAttempt") AS "lastActivityAt",
          (SELECT COUNT(*)::int FROM "CustomerAutoTopupAttempt" WHERE "status"='FAILED') AS "failedCount",
          (SELECT COUNT(*)::int FROM "CustomerAutoTopupAttempt" WHERE "status"='CREDITED') AS "creditedCount"
      `).then((rows) => rows?.[0] || null).catch(() => null),
    ]);

    const latest = (rows) => rows.reduce((max, row) => {
      const value = row?._max?.updatedAt;
      return value && (!max || value > max) ? value : max;
    }, null);

    return {
      payment: {
        lastActivityAt: payment?._max?.processedAt || payment?._max?.receivedAt || null,
        processedCount: payment?._count?._all || 0,
      },
      commands: {
        lastActivityAt: latest(commands),
        publishedCount: commands.find((x) => x.status === 'PUBLISHED')?._count?._all || 0,
        pendingCount: commands.filter((x) => ['PENDING','PROCESSING','RETRY'].includes(x.status)).reduce((n, x) => n + (x._count?._all || 0), 0),
        failedCount: commands.find((x) => x.status === 'DEAD_LETTER')?._count?._all || 0,
      },
      recovery: {
        lastActivityAt: latest(recovery),
        activeCount: recovery.filter((x) => ['DISPATCHING','SENT','ACCEPTED','DISPENSING','TIMED_OUT'].includes(x.status)).reduce((n, x) => n + (x._count?._all || 0), 0),
        manualReviewCount: recovery.find((x) => x.status === 'RECONCILIATION_REQUIRED')?._count?._all || 0,
      },
      renewals: renewals ? {
        lastActivityAt: renewals.lastActivityAt || null,
        dueCount: Number(renewals.dueCount || 0),
        failedCount: Number(renewals.failedCount || 0),
        exhaustedCount: Number(renewals.exhaustedCount || 0),
        paidCount: Number(renewals.paidCount || 0),
      } : null,
      autoTopups: autoTopups ? {
        lastActivityAt: autoTopups.lastActivityAt || null,
        activeCount: Number(autoTopups.activeCount || 0),
        dueCount: Number(autoTopups.dueCount || 0),
        failedCount: Number(autoTopups.failedCount || 0),
        creditedCount: Number(autoTopups.creditedCount || 0),
      } : null,
    };
  }

  async list() {
    const backup = readBackupLog();
    const facts = await this.runtimeFacts();

    const runtimeJob = ({ id, name, category, intervalMs, description, fact, scheduleHuman = null }) => ({
      id,
      name,
      category,
      source: 'Node.js setInterval',
      unit: 'softice-display-backend-8800.service',
      scheduleHuman: scheduleHuman || (intervalMs === 60 * 60 * 1000 ? 'Каждый час' : `Каждые ${intervalMs / 1000} секунд`),
      scheduleTechnical: `setInterval(..., ${intervalMs})`,
      timezone: 'Не применяется',
      enabled: true,
      readOnly: true,
      description,
      retention: 'Не применяется',
      lastRunAt: fact?.lastActivityAt || null,
      lastRunStatus: (fact?.failedCount > 0 || fact?.manualReviewCount > 0 || fact?.exhaustedCount > 0) ? 'WARNING' : 'ACTIVE',
      lastRunDetails: fact ? [{ section: 'runtime', status: 'active', ...fact }] : [],
      nextRunAt: null,
    });

    const items = [
      runtimeJob({
        id: 'payment-inbox-worker',
        name: 'Обработка входящих платежей',
        category: 'PAYMENTS',
        intervalMs: 5000,
        description: 'Проверяет очередь входящих платёжных событий и передаёт их в PaymentService для обработки.',
        fact: facts.payment,
      }),
      runtimeJob({
        id: 'monthly-customer-auto-topup-worker',
        name: 'Ежемесячное автопополнение лицевых счетов',
        category: 'PAYMENTS',
        intervalMs: 60 * 60 * 1000,
        scheduleHuman: 'Раз в месяц по выбранному дню; техническая проверка каждый час',
        description: 'Каждый час проверяет графики MONTHLY, но создаёт платёж только когда наступил nextChargeAt конкретного пользователя. После подтверждённого succeeded от ЮKassa сумма зачисляется на клубный/лицевой счёт идемпотентной проводкой.',
        fact: facts.autoTopups,
      }),
      runtimeJob({
        id: 'private-channel-renewal-worker',
        name: 'Автопродление подписок',
        category: 'PAYMENTS',
        intervalMs: 60 * 60 * 1000,
        description: 'Раз в час проверяет только подписки, у которых наступил конец оплаченного периода. Реальное списание выполняется по сохранённому способу оплаты только при ранее зафиксированном согласии пользователя. Для месячного тарифа списание происходит раз в 30 дней.',
        fact: facts.renewals,
      }),
      runtimeJob({
        id: 'machine-command-worker',
        name: 'Отправка команд аппаратам',
        category: 'MACHINES',
        intervalMs: 5000,
        description: 'Забирает подготовленные команды из transactional outbox и передаёт их в контур выдачи аппарата.',
        fact: facts.commands,
      }),
      runtimeJob({
        id: 'machine-recovery-worker',
        name: 'Восстановление незавершённых выдач',
        category: 'MACHINES',
        intervalMs: 15000,
        description: 'Проверяет незавершённые операции выдачи и запускает безопасное восстановление их состояния.',
        fact: facts.recovery,
      }),
      {
        id: 'monthly-payments-messages-archive',
        name: 'Ежемесячный архив Payments + Messages',
        category: 'BACKUP',
        source: 'systemd timer',
        unit: 'softice-monthly-archive.timer',
        scheduleHuman: '1-е число каждого месяца, 00:20 (Томск)',
        scheduleTechnical: 'OnCalendar=*-*-01 00:20:00 Asia/Tomsk',
        timezone: 'Asia/Tomsk',
        enabled: true,
        readOnly: true,
        description: 'Архивирует полностью завершившийся предыдущий календарный месяц. Создаёт отдельные ZIP + SHA256 для Платежей и Центра сообщений. Рабочие строки из БД не удаляет.',
        retention: 'Бессрочно',
        lastRunAt: backup?.at || null,
        lastRunStatus: backup ? 'SUCCESS' : 'NOT_RUN',
        lastRunDetails: backup?.results || [],
        nextRunAt: nextMonthlyTomsk(this.clock()),
      },
    ];

    return { items, total: items.length };
  }

  async get(id) {
    const data = await this.list();
    const task = data.items.find((item) => item.id === id);
    if (!task) {
      const error = new Error('Задача планировщика не найдена.');
      error.statusCode = 404;
      error.code = 'SCHEDULER_TASK_NOT_FOUND';
      throw error;
    }
    return task;
  }
}

module.exports = { SchedulerService, nextMonthlyTomsk };
