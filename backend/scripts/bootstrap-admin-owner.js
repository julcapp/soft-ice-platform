const { getPrismaClient, disconnectDatabase } = require('../src/common/database');
const { hashPassword } = require('../src/platform/security/AdminAuthService');

async function main() {
  const login = String(process.env.ADMIN_OWNER_LOGIN || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_OWNER_PASSWORD || '');
  const displayName = String(process.env.ADMIN_OWNER_NAME || 'Владелец платформы').trim();
  const email = String(process.env.ADMIN_OWNER_EMAIL || '').trim().toLowerCase() || null;
  const maxUserId = String(process.env.ADMIN_OWNER_MAX_USER_ID || '').trim() || null;
  if (!login || password.length < 6 || password.length > 12) {
    throw new Error('Set ADMIN_OWNER_LOGIN and ADMIN_OWNER_PASSWORD (6 to 12 characters).');
  }
  const prisma = getPrismaClient();
  const passwordHash = await hashPassword(password);
  const rows = await prisma.$queryRawUnsafe('SELECT "id" FROM "AdminUser" WHERE lower("login")=$1 LIMIT 1', login);
  if (rows[0]) {
    await prisma.$executeRawUnsafe('UPDATE "AdminUser" SET "displayName"=$2, "passwordHash"=$3, "roles"=ARRAY[\'PLATFORM_OWNER\']::TEXT[], "status"=\'ACTIVE\', "failedLoginCount"=0, "lockedUntil"=NULL, "passwordChangedAt"=NOW(), "email"=COALESCE($4,"email"), "emailVerifiedAt"=CASE WHEN $4 IS NOT NULL THEN NOW() ELSE "emailVerifiedAt" END, "maxUserId"=COALESCE($5,"maxUserId"), "maxVerifiedAt"=CASE WHEN $5 IS NOT NULL THEN NOW() ELSE "maxVerifiedAt" END, "updatedAt"=NOW() WHERE "id"=$1::uuid', rows[0].id, displayName, passwordHash, email, maxUserId);
    console.log('Admin owner updated:', login);
  } else {
    await prisma.$executeRawUnsafe('INSERT INTO "AdminUser" ("login","displayName","passwordHash","roles","email","emailVerifiedAt","maxUserId","maxVerifiedAt") VALUES ($1,$2,$3,ARRAY[\'PLATFORM_OWNER\']::TEXT[],$4,CASE WHEN $4 IS NOT NULL THEN NOW() ELSE NULL END,$5,CASE WHEN $5 IS NOT NULL THEN NOW() ELSE NULL END)', login, displayName, passwordHash, email, maxUserId);
    console.log('Admin owner created:', login);
  }
  console.log('Security channels:', email ? 'EMAIL configured' : 'EMAIL not configured', ',', maxUserId ? 'MAX configured' : 'MAX not configured');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => disconnectDatabase());
