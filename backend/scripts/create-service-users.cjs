// Interactive owner-terminal command; passwords are never persisted in source files.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { hashPassword } = require('../src/platform/security/AdminAuthService');
const { AuditRepository } = require('../src/platform/audit/AuditRepository');
async function main() {
  if (!process.stdout.isTTY) throw new Error('Требуется интерактивный SSH-терминал.');
  const config = fs.readFileSync('/etc/soft-ice-platform-v036.env', 'utf8');
  const line = config.split(/\r?\n/).find((value) => /^\s*(?:export\s+)?DATABASE_URL\s*=/.test(value));
  if (!line) throw new Error('Настройки базы не найдены.');
  let url = line.slice(line.indexOf('=') + 1).trim();
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) url = url.slice(1, -1);
  process.env.DATABASE_URL = url;
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const users = [ { login: 'tehnik', name: 'Технический специалист', role: 'SERVICE_SPECIALIST' }, { login: 'master', name: 'Мастер', role: 'MACHINE_RESPONSIBLE' } ];
  try {
    for (const user of users) { user.password = crypto.randomBytes(18).toString('base64url'); user.hash = await hashPassword(user.password); }
    await prisma.$transaction(async (tx) => {
      const owner = await tx.$queryRawUnsafe('SELECT "id" FROM "AdminUser" WHERE "id"=$1::uuid AND lower("login")=$2 AND "status"=\'ACTIVE\' AND \'PLATFORM_OWNER\'=ANY("roles")', 'dc333c0c-389a-46c8-abc4-dc61f30f2c3f', 'julcapp');
      if (!owner.length) throw new Error('Владелец не подтверждён.');
      const existing = await tx.$queryRawUnsafe('SELECT "login" FROM "AdminUser" WHERE lower("login")=ANY($1::text[])', users.map((user) => user.login));
      if (existing.length) throw new Error('Учётные записи уже существуют. Их пароли и права не изменены.');
      for (const user of users) {
        const rows = await tx.$queryRawUnsafe('INSERT INTO "AdminUser" ("login","displayName","passwordHash","roles","status") VALUES ($1,$2,$3,ARRAY[$4]::text[],\'ACTIVE\') RETURNING "id"', user.login, user.name, user.hash, user.role);
        await new AuditRepository(tx).record({ eventType: 'Admin.ServiceUserCreated', subjectType: 'administrator', subjectId: owner[0].id, targetType: 'AdminUser', targetId: rows[0].id, action: 'create_service_user', decision: 'success', authMethod: 'owner_terminal', sourceChannel: 'owner_terminal', correlationId: crypto.randomUUID(), metadata: { role: user.role } });
      }
    });
    for (const user of users) console.log(`\n${user.name}\nЛогин: ${user.login}\nПароль: ${user.password}`);
    console.log('\nСохраните пароли отдельно. Доступ к аппаратам пока не назначен.');
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error.message === 'Учётные записи уже существуют. Их пароли и права не изменены.' ? error.message : 'Пользователи не созданы: проверьте права, базу и запись владельца.'); process.exitCode = 1; });
