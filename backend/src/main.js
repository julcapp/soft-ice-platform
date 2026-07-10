const express = require('express');

const { createHealthRouter } = require('./common/http/healthRouter');
const { disconnectDatabase } = require('./common/database');
const { backendConfig } = require('./config');
const { moduleManifests } = require('./modules');

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    project: 'soft-ice-platform',
    service: 'backend',
    status: 'online',
    architecture: 'modular-monolith',
    modules: moduleManifests.map(({ name, status }) => ({ name, status })),
    serverTime: new Date().toISOString(),
  });
});

app.use('/health', createHealthRouter());

let server;

function startServer() {
  if (server) {
    return server;
  }

  server = app.listen(backendConfig.http.port, backendConfig.http.host, () => {
    console.log(
      `Soft ICE backend listening on ${backendConfig.http.host}:${backendConfig.http.port}`,
    );
  });

  return server;
}

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down backend.`);

  await disconnectDatabase();

  if (!server) {
    process.exit(0);
    return;
  }

  server.close(() => {
    process.exit(0);
  });
}

if (require.main === module) {
  startServer();

  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
}

module.exports = {
  app,
  startServer,
  shutdown,
};
