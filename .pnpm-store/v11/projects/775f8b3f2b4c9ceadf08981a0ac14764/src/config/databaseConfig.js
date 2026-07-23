function getDatabaseConfig(environment = process.env, secretProvider = { get: (name) => environment[name] || '' }) {
  return {
    provider: 'postgresql',
    url: secretProvider.get('DATABASE_URL'),
    ssl: environment.DATABASE_SSL === 'true',
    connectionLimit: Number(environment.DATABASE_CONNECTION_LIMIT || 5),
  };
}

module.exports = { getDatabaseConfig };
