const { checkDatabaseConnection } = require('./connection');
const { disconnectDatabase, getPrismaClient } = require('./prismaClient');

module.exports = {
  checkDatabaseConnection,
  disconnectDatabase,
  getPrismaClient,
};
