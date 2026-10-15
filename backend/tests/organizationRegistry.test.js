const test = require('node:test');
const assert = require('node:assert/strict');
const { OrganizationRegistry } = require('../src/modules/organization/OrganizationRegistry');
const { OrganizationService } = require('../src/modules/organization/OrganizationService');
test('поиск без ключа честно отклоняется без вызова провайдера', async () => {
  const registry = new OrganizationRegistry({ token: '', fetchImpl: () => { throw Error('не вызывать'); } });
  assert.equal(registry.configuration().configured, false);
  await assert.rejects(registry.lookup('7017438363', 'owner'), { code: 'ORGANIZATION_REGISTRY_NOT_CONFIGURED' });
});
test('поиск передаёт ИНН, выбирает головную организацию и возвращает реквизиты без токена', async () => {
  let request;
  const registry = new OrganizationRegistry({ token: 'test-private-token', fetchImpl: async (url, options) => { request = options; return { ok: true, json: async () => ({ suggestions: [{ value: 'ООО Тест', data: { inn: '7017438363', kpp: '701701001', name: { full_with_opf: 'Общество Тест', short_with_opf: 'ООО Тест' }, opf: { short: 'ООО' }, management: { name: 'Иванов Иван Иванович', post: 'Директор' }, state: { status: 'ACTIVE' } } }] }) }; } });
  const result = await registry.lookup('7017438363', 'owner');
  assert.equal(JSON.parse(request.body).branch_type, 'MAIN');
  assert.equal(result.organization.directorName, 'Иванов Иван Иванович');
  assert.equal(result.organization.phone, '');
  assert.ok(!JSON.stringify(result).includes('test-private-token'));
});
test('неверный ИНН, отсутствие данных и ошибка провайдера различаются', async () => {
  const registry = new OrganizationRegistry({ token: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({ suggestions: [] }) }) });
  await assert.rejects(registry.lookup('123', 'owner'), { statusCode: 422 });
  await assert.rejects(registry.lookup('7017438363', 'owner'), { statusCode: 404 });
  registry.fetch = async () => { throw Error('секретный текст провайдера'); };
  await assert.rejects(registry.lookup('7017438363', 'owner'), (error) => error.statusCode === 502 && !error.message.includes('секретный'));
});
test('организация сохраняет директора и контакты, дубликат отклоняется', async () => {
  let created;
  const service = new OrganizationService({ repository: { create: async (input) => { created = input; return { ...input, id: 'org' }; }, findByInn: async () => null } });
  service.record = async () => {};
  await service.create({ fullName: 'Тест', shortName: 'Тест', organizationType: 'ООО', inn: '7017438363', directorName: 'Иван Иванов', phone: '+79000000000', email: 'test@example.org' }, {});
  assert.equal(created.directorName, 'Иван Иванов');
  await assert.rejects(service.create({ fullName: 'Тест', shortName: 'Тест', organizationType: 'ООО', email: 'bad' }, {}), { code: 'ORGANIZATION_EMAIL_INVALID' });
  service.repository.findByInn = async () => ({ id: 'existing' });
  await assert.rejects(service.create({ fullName: 'Тест', shortName: 'Тест', organizationType: 'ООО', inn: '7017438363' }, {}), { statusCode: 409 });
});
