const test = require('node:test');
const assert = require('node:assert/strict');
const { CustomerRoleContextService } = require('../src/modules/customer_profile/CustomerRoleContextService');

test('ordinary customer receives only customer context', async () => {
  let call = 0;
  const prisma = { $queryRawUnsafe: async () => (++call === 1 ? [{ id: 'c1', name: 'Иван', phone: '+7', email: null, status: 'active' }] : []) };
  const result = await new CustomerRoleContextService({ prisma }).getForCustomer('c1');
  assert.deepEqual(result.roles, ['CUSTOMER']);
  assert.equal(result.contexts.length, 1);
  assert.equal(result.contexts[0].code, 'CUSTOMER');
  assert.equal(result.canSwitchContext, false);
});

test('customer who is a service specialist keeps customer context and gains service context', async () => {
  let call = 0;
  const prisma = { $queryRawUnsafe: async () => {
    call += 1;
    if (call === 1) return [{ id: 'c1', name: 'Иван', phone: '+7', email: 'i@example.test', status: 'active' }];
    return [{ id: 'm1', fullName: 'Иван Мастер', position: 'Техник', status: 'ACTIVE', isServiceSpecialist: true, isMachineResponsible: false }];
  } };
  const result = await new CustomerRoleContextService({ prisma }).getForCustomer('c1');
  assert.equal(result.roles.includes('CUSTOMER'), true);
  assert.equal(result.roles.includes('SERVICE_SPECIALIST'), true);
  assert.equal(result.contexts.map((item) => item.code).join(','), 'CUSTOMER,SERVICE');
  assert.equal(result.defaultContext, 'CUSTOMER');
  assert.equal(result.canSwitchContext, true);
  assert.equal(result.rule, 'ONE_IDENTITY_MULTIPLE_CONTEXTS');
});
