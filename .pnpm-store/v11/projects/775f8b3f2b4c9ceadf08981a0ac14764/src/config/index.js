const { getDatabaseConfig } = require('./databaseConfig');

class EnvironmentSecretProvider {
  constructor(environment = process.env) {
    this.environment = environment;
  }

  get(name) {
    return this.environment[name] || '';
  }
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Configuration value must be true or false, received: ${value}`);
}

function parseInteger(value, fallback, name, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value === undefined || value === '' ? fallback : value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

function createConfig(environment = process.env, secretProvider = new EnvironmentSecretProvider(environment)) {
  const profile = environment.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(profile)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  const config = {
    environment: profile,
    isProduction: profile === 'production',
    http: {
      host: environment.HOST || '0.0.0.0',
      port: parseInteger(environment.PORT, 3000, 'PORT', { max: 65535 }),
      shutdownTimeoutMs: parseInteger(environment.SHUTDOWN_TIMEOUT_MS, 10000, 'SHUTDOWN_TIMEOUT_MS'),
    },
    database: getDatabaseConfig(environment, secretProvider),
    auth: {
      telegramBotToken: secretProvider.get('TELEGRAM_BOT_TOKEN'),
      telegramInitDataMaxAgeSeconds: parseInteger(environment.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS, 86400, 'TELEGRAM_INIT_DATA_MAX_AGE_SECONDS'),
      accessTokenTtlSeconds: parseInteger(environment.AUTH_ACCESS_TOKEN_TTL_SECONDS, 900, 'AUTH_ACCESS_TOKEN_TTL_SECONDS'),
    },
    logging: { level: environment.LOG_LEVEL || (profile === 'production' ? 'info' : 'debug') },
    machineGateway: {
      machineId: environment.HUAXIN_MACHINE_ID || 'huaxin_default',
      heartbeatIntervalMs: parseInteger(environment.HUAXIN_HEARTBEAT_INTERVAL_MS, 15000, 'HUAXIN_HEARTBEAT_INTERVAL_MS'),
      heartbeatTimeoutMs: parseInteger(environment.HUAXIN_HEARTBEAT_TIMEOUT_MS, 45000, 'HUAXIN_HEARTBEAT_TIMEOUT_MS'),
      commandTimeoutMs: parseInteger(environment.HUAXIN_COMMAND_TIMEOUT_MS, 5000, 'HUAXIN_COMMAND_TIMEOUT_MS'),
      reconnectBaseDelayMs: parseInteger(environment.HUAXIN_RECONNECT_BASE_DELAY_MS, 1000, 'HUAXIN_RECONNECT_BASE_DELAY_MS'),
      reconnectMaxDelayMs: parseInteger(environment.HUAXIN_RECONNECT_MAX_DELAY_MS, 30000, 'HUAXIN_RECONNECT_MAX_DELAY_MS'),
      maxReconnectAttempts: parseInteger(environment.HUAXIN_MAX_RECONNECT_ATTEMPTS, 5, 'HUAXIN_MAX_RECONNECT_ATTEMPTS'),
      queueMaxSize: parseInteger(environment.HUAXIN_COMMAND_QUEUE_SIZE, 100, 'HUAXIN_COMMAND_QUEUE_SIZE'),
      telemetryLimit: parseInteger(environment.HUAXIN_TELEMETRY_LIMIT, 100, 'HUAXIN_TELEMETRY_LIMIT'),
    },
    features: Object.freeze({
      paymentsEnabled: parseBoolean(environment.FEATURE_PAYMENTS_ENABLED, false),
      machineDispatchEnabled: parseBoolean(environment.FEATURE_MACHINE_DISPATCH_ENABLED, false),
    }),
  };

  validateConfig(config);
  return Object.freeze(config);
}

function validateConfig(config) {
  const missing = [];
  if (config.isProduction && !config.database.url) missing.push('DATABASE_URL');
  if (config.isProduction && !config.auth.telegramBotToken) missing.push('TELEGRAM_BOT_TOKEN');
  if (missing.length) throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
  return config;
}

const backendConfig = createConfig();

module.exports = { EnvironmentSecretProvider, backendConfig, createConfig, getDatabaseConfig, validateConfig };
