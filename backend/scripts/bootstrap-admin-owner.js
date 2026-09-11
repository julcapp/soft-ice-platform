const { getPrismaClient, disconnectDatabase } = require('../src/common/database');
const { hashPassword } = require('../src/platform/security/AdminAuthService');

async function main() {
  const login = String(process.env.ADMIN_OWNER_LOGIN || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_OWNER_PASSWORD || '');
  const displayName = String(process.env.ADMIN_OWNER_NAME || 'Владелец платформы').trim();
  if (!login || password.length < 6 || password.length > 12) {
    throw new Error('Set ADMIN_OWNER_LOGIN and ADMIN_OWNER_PASSWORD (6 to 12 characters).');
  }
  const prisma = getPrismaClient();
  const passwordHash = await hashPassword(password);
  const rows = await prisma.$queryRawUnsafe('SELECT "id" FROM "AdminUser" WHERE lower("login")=$1 LIMIT 1', login);
  if (rows[0]) {
    await prisma.$executeRawUnsafe('UPDATE "AdminUser" SET "displayName"=$2, "passwordHash"=$3, "roles"=ARRAY[\'PLATFORM_OWNER\']::TEXT[], "status"=\'ACTIVE\', "failedLoginCount"=0, "lockedUntil"=NULL, "passwordChangedAt"=NOW(), "updatedAt"=NOW() WHERE "id"=$1::uuid', rows[0].id, displayName, passwordHash);
    console.log('Admin owner updated:', login);
  } else {
    await prisma.$executeRawUnsafe('INSERT INTO "AdminUser" ("login","displayName","passwordHash","roles") VALUES ($1,$2,$3,ARRAY[\'PLATFORM_OWNER\']::TEXT[])', login, displayName, passwordHash);
    console.log('Admin owner created:', login);
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => disconnectDatabase());
