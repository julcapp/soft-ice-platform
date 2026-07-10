const { getDatabaseConfig } = require('./databaseConfig');

const backendConfig = {
  environment: process.env.NODE_ENV || 'development',
  http: {
    host: process.env.HOST || '0.0.0.0',
    port: Number(process.env.PORT || 3000),
  },
  database: getDatabaseConfig(),
};

module.exports = {
  backendConfig,
  getDatabaseConfig,
};
