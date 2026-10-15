// Run in the owner's terminal only: prints the new password there, never in Git.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { hashPassword } = require('../src/platform/security/AdminAuthService');
const { AuditRepository } = require('../src/platform/audit/AuditRepository');

async function main() {
  if (!process.stdout.isTTY) throw new Error('Запустите команду в интерактивном терминале.');
  const config = fs.readFileSync('/etc/soft-ice-platform-v036.env', 'utf8');
  const line = config.split(/\r?\n/).find((value) => /^\s*(?:export\s+)?DATABASE_URL\s*=/.test(value));
  if (!line) throw new Error('Настройки базы не найдены.');
  let url = line.slice(line.indexOf('=') + 1).trim();
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) url = url.slice(1, -1);
  process.env.DATABASE_URL = url;
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const password = crypto.randomBytes(18).toString('base64url');
  try {
    const hash = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe('SELECT "id","status","roles" FROM "AdminUser" WHERE "id"=$1::uuid AND lower("login")=$2 FOR UPDATE', 'dc333c0c-389a-46c8-abc4-dc61f30f2c3f', 'julcapp');
      if (rows.length !== 1 || rows[0].status !== 'ACTIVE' || !rows[0].roles.includes('PLATFORM_OWNER')) throw new Error('Учётная запись не совпадает с подтверждённой записью владельца.');
      await tx.$executeRawUnsafe('UPDATE "AdminUser" SET "passwordHash"=$2,"passwordChangedAt"=NOW(),"failedLoginCount"=0,"lockedUntil"=NULL,"updatedAt"=NOW() WHERE "id"=$1::uuid', rows[0].id, hash);
      await tx.$executeRawUnsafe('UPDATE "AdminSession" SET "revokedAt"=NOW(),"revokedReason"=$2 WHERE "adminUserId"=$1::uuid AND "revokedAt" IS NULL', rows[0].id, 'owner_password_reset');
      await new AuditRepository(tx).record({ eventType: 'Admin.OwnerPasswordReset', subjectType: 'administrator', subjectId: rows[0].id, targetType: 'AdminUser', targetId: rows[0].id, action: 'reset_owner_password', decision: 'success', authMethod: 'server_terminal', sourceChannel: 'owner_terminal', correlationId: crypto.randomUUID() });
    });
    console.log('Логин: julcapp\nНовый пароль: ' + password + '\nСохраните пароль в менеджере паролей. Старые сессии отозваны.');
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error('Пароль не сброшен: проверьте права, базу и подтверждённую запись владельца.'); process.exitCode = 1; });
