const express = require('express');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');

const INTERNAL_JOBS = [
  { id: 'payment-inbox-worker', name: 'Обработка входящих платежей', cadence: 'Каждые 5 секунд', source: 'NODE_INTERVAL', status: 'ACTIVE', scope: 'Платежи' },
  { id: 'machine-command-worker', name: 'Отправка команд аппаратам', cadence: 'Каждые 5 секунд', source: 'NODE_INTERVAL', status: 'ACTIVE', scope: 'Автоматы' },
  { id: 'machine-recovery-worker', name: 'Восстановление незавершённых выдач', cadence: 'Каждые 15 секунд', source: 'NODE_INTERVAL', status: 'ACTIVE', scope: 'Автоматы' },
];

const EXTERNAL_JOBS = [
  { id: 'messages-monthly-backup', name: 'Ежемесячный архив Центра сообщений', cadence: '1-го числа каждого месяца', source: 'SYSTEMD_TIMER', status: 'NOT_CONFIGURED', scope: 'Сообщения' },
  { id: 'payments-monthly-backup', name: 'Ежемесячный архив платежей', cadence: '1-го числа каждого месяца', source: 'SYSTEMD_TIMER', status: 'NOT_CONFIGURED', scope: 'Платежи' },
];

function createSchedulerRouter({ adminAuth = {} } = {}) {
  const router = express.Router();
  router.get('/scheduler', createAdminAuthenticator(adminAuth), (req, res) => {
    res.json({
      generatedAt: new Date().toISOString(),
      processStartedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      jobs: [...INTERNAL_JOBS, ...EXTERNAL_JOBS],
    });
  });
  return router;
}

module.exports = { createSchedulerRouter };
