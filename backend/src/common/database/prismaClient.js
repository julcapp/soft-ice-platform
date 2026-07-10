const { PrismaClient } = require('@prisma/client');

let prismaClient;

function getPrismaClient() {
  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }

  return prismaClient;
}

async function disconnectDatabase() {
  if (!prismaClient) {
    return;
  }

  await prismaClient.$disconnect();
  prismaClient = undefined;
}

module.exports = {
  getPrismaClient,
  disconnectDatabase,
};
