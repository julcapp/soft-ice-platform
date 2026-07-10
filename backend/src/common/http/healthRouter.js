const express = require('express');

const { checkDatabaseConnection } = require('../database');

function createHealthRouter() {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json({
      status: 'ok',
      service: 'backend',
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/ready', async (req, res) => {
    const database = await checkDatabaseConnection();
    const isReady = database.ok;

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not_ready',
      database,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

module.exports = {
  createHealthRouter,
};
