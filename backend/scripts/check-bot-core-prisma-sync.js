const fs = require('node:fs');
const path = require('node:path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');

const requiredModels = ['ReferralQualification', 'WelcomeBonusGrant'];
const missing = requiredModels.filter((name) => !new RegExp(`\\bmodel\\s+${name}\\b`).test(schema));

if (missing.length) {
  console.error(`BOT_CORE_PRISMA_OUT_OF_SYNC: missing Prisma models: ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('BOT_CORE_PRISMA_SYNC_OK');
}
