const express = require('express');

const { checkDatabaseConnection } = require('../database');

function createHealthRouter({ databaseCheck = checkDatabaseConnection } = {}) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json({
      status: 'ok',
      service: 'backend',
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/live', (req, res) => {
    res.json({ status: 'live', service: 'backend', timestamp: new Date().toISOString() });
  });

  router.get('/ready', async (req, res) => {
    const database = await databaseCheck();
    const isReady = database.ok;

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not_ready',
      checks: { database, prisma: { ok: database.ok, status: database.status } },
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

module.exports = {
  createHealthRouter,
};
