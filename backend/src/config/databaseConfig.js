function getDatabaseConfig() {
  return {
    provider: 'postgresql',
    url: process.env.DATABASE_URL || '',
    ssl: process.env.DATABASE_SSL === 'true',
    connectionLimit: Number(process.env.DATABASE_CONNECTION_LIMIT || 5),
  };
}

module.exports = {
  getDatabaseConfig,
};
