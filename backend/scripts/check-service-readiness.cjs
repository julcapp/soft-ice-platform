// Read-only production preflight. Never prints credentials or password hashes.
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const backend = '/home/julcapp/soft-ice-worktrees/display-product-v1/backend';
  const config = fs.readFileSync('/etc/soft-ice-platform-v036.env', 'utf8');
  const line = config.split(/\r?\n/).find((value) => /^\s*(?:export\s+)?DATABASE_URL\s*=/.test(value));
  if (!line) throw new Error('DATABASE_URL не найден в конфигурации службы.');
  let value = line.slice(line.indexOf('=') + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  process.env.DATABASE_URL = value;
  const { PrismaClient } = require(path.join(backend, 'node_modules/@prisma/client'));
  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRawUnsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('AdminUser','AdminSession','AdminPasswordChangeChallenge','OrganizationMember','OrganizationRoleAssignment','OrganizationMachineAssignment','ServiceVisit','ServicePhoto') ORDER BY table_name`);
    console.log('Таблицы:', JSON.stringify(tables));
    const columns = await prisma.$queryRawUnsafe(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='AdminUser' AND column_name IN ('organizationMemberId','emailVerifiedAt','maxVerifiedAt')) OR (table_name='OrganizationMachineAssignment' AND column_name IN ('serviceSpecialistId','responsibleMemberId'))) ORDER BY table_name,column_name`);
    console.log('Поля полномочий:', JSON.stringify(columns));
    if (tables.some((table) => table.table_name === 'AdminUser')) {
      const users = await prisma.$queryRawUnsafe('SELECT "id","login","displayName","roles","status" FROM "AdminUser" WHERE lower("login")=$1', 'julcapp');
      console.log('Администратор julcapp:', JSON.stringify(users));
    }
    try { require.resolve('sharp', { paths: [backend] }); console.log('Обработка фотографий: sharp доступен'); }
    catch { console.log('Обработка фотографий: sharp не найден'); }
    console.log('Каталог media:', fs.existsSync('/var/lib/soft-ice/media/') ? 'существует' : 'не создан');
    console.log('Диагностика завершена. Данные не изменены.');
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error('Диагностика не завершена. Проверьте права sudo, конфигурацию службы и доступность PostgreSQL. Секреты не выводятся.'); process.exitCode = 1; });
