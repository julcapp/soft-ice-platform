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
    const [payment, commands, recovery] = await Promise.all([
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
    };
  }

  async list() {
    const backup = readBackupLog();
    const facts = await this.runtimeFacts();

    const runtimeJob = ({ id, name, category, intervalMs, description, fact }) => ({
      id,
      name,
      category,
      source: 'Node.js setInterval',
      unit: 'softice-display-backend-8800.service',
      scheduleHuman: `Каждые ${intervalMs / 1000} секунд`,
      scheduleTechnical: `setInterval(..., ${intervalMs})`,
      timezone: 'Не применяется',
      enabled: true,
      readOnly: true,
      description,
      retention: 'Не применяется',
      lastRunAt: fact?.lastActivityAt || null,
      lastRunStatus: 'ACTIVE',
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
