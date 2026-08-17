const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const backendRoot = join(__dirname, '..');

test('история ответственности за аппарат запрещает удаление целевого Machine', () => {
  const schema = readFileSync(join(backendRoot, 'prisma', 'schema.prisma'), 'utf8');
  const responsibilityModel = schema.match(/model OrganizationResponsibility \{[\s\S]*?\n\}/)?.[0];

  assert.ok(responsibilityModel, 'OrganizationResponsibility должен присутствовать в Prisma schema');
  assert.match(
    responsibilityModel,
    /machine\s+Machine\?\s+@relation\(fields: \[machineId\], references: \[id\], onDelete: Restrict\)/,
  );
});
