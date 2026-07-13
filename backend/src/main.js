const express = require('express');

const { createApiCompatibilityRouter } = require('./api/compatibilityRoutes');
const { createApiV1Router } = require('./api/v1');
const { createHealthRouter } = require('./common/http/healthRouter');
const { disconnectDatabase } = require('./common/database');
const { backendConfig } = require('./config');
const { moduleManifests } = require('./modules');
const { createRuntimeDependencies } = require('./runtimeDependencies');

function createApp(options = {}) {
  const app = express();
  const dependencies = options.dependencies || createRuntimeDependencies();

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
  app.use('/api/v1', createApiV1Router(dependencies));
  app.use('/api', createApiCompatibilityRouter(dependencies));

  return app;
}

let app;

let server;

function startServer() {
  if (server) {
    return server;
  }

  server = getApp().listen(backendConfig.http.port, backendConfig.http.host, () => {
    console.log(
      `Soft ICE backend listening on ${backendConfig.http.host}:${backendConfig.http.port}`,
    );
  });

  return server;
}

function getApp() {
  if (!app) {
    app = createApp();
  }

  return app;
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
  get app() {
    return getApp();
  },
  createApp,
  startServer,
  shutdown,
};
