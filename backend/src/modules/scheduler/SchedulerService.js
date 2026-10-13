const fs = require('fs');

const TOMSK_OFFSET_MS = 7 * 60 * 60 * 1000;
const BACKUP_LOG = '/home/julcapp/softice-backups/logs/monthly-backup.log';

function nextMonthlyTomsk(now = new Date()) {
  const tomsk = new Date(now.getTime() + TOMSK_OFFSET_MS);
  let year = tomsk.getUTCFullYear();
  let month = tomsk.getUTCMonth() + 1;
  const currentDay = tomsk.getUTCDate();
  const currentHour = tomsk.getUTCHours();
  const currentMinute = tomsk.getUTCMinutes();
  const alreadyPassed = currentDay > 1 || currentHour > 0 || (currentHour === 0 && currentMinute >= 20);
  if (alreadyPassed) {
    month += 1;
    if (month === 13) { month = 1; year += 1; }
  }
  return new Date(Date.UTC(year, month - 1, 1, -7, 20, 0, 0)).toISOString();
}

function nextInterval(now, intervalMs) {
  return new Date(now.getTime() + intervalMs).toISOString();
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
  constructor({ clock = () => new Date() } = {}) {
    this.clock = clock;
  }

  async list() {
    const now = this.clock();
    const backup = readBackupLog();
    const runtimeJob = ({ id, name, category, intervalMs, description }) => ({
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
      lastRunAt: null,
      lastRunStatus: 'RUNNING',
      lastRunDetails: [],
      nextRunAt: nextInterval(now, intervalMs),
    });

    const items = [
      runtimeJob({
        id: 'payment-inbox-worker',
        name: 'Обработка входящих платежей',
        category: 'PAYMENTS',
        intervalMs: 5000,
        description: 'Проверяет очередь входящих платёжных событий и передаёт их в PaymentService для обработки.',
      }),
      runtimeJob({
        id: 'machine-command-worker',
        name: 'Отправка команд аппаратам',
        category: 'MACHINES',
        intervalMs: 5000,
        description: 'Забирает подготовленные команды из transactional outbox и передаёт их в контур выдачи аппарата.',
      }),
      runtimeJob({
        id: 'machine-recovery-worker',
        name: 'Восстановление незавершённых выдач',
        category: 'MACHINES',
        intervalMs: 15000,
        description: 'Проверяет незавершённые операции выдачи и запускает безопасное восстановление их состояния.',
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
        nextRunAt: nextMonthlyTomsk(now),
      },
    ];

    return { items, total: items.length };
  }

  async get(id) {
    const data = await this.list();
    const task = data.items.find(item => item.id === id);
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

[executed on device: Home-Boss (3edc2642-7822-40ad-8421-dfa47fe2a398)]