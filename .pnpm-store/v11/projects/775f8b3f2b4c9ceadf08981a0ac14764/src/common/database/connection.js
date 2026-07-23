const { getDatabaseConfig } = require('../../config');
const { getPrismaClient } = require('./prismaClient');

async function checkDatabaseConnection() {
  const databaseConfig = getDatabaseConfig();

  if (!databaseConfig.url) {
    return {
      ok: false,
      provider: databaseConfig.provider,
      status: 'missing_database_url',
    };
  }

  try {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;

    return {
      ok: true,
      provider: databaseConfig.provider,
      status: 'connected',
    };
  } catch (error) {
    return {
      ok: false,
      provider: databaseConfig.provider,
      status: 'unavailable',
      errorCode: error.code || 'DATABASE_CONNECTION_ERROR',
    };
  }
}

module.exports = {
  checkDatabaseConnection,
};
