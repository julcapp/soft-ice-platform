const test = require('node:test');
const assert = require('node:assert/strict');
const { TelegramAdapter } = require('../src/modules/bot_core/TelegramAdapter');
const { TelegramRenderer } = require('../src/modules/bot_core/TelegramRenderer');
const { CustomerService } = require('../src/modules/customer/CustomerService');
const { CustomerRuntime } = require('../src/modules/customer/CustomerRuntime');

test('Telegram only verifies own contact in a private chat', () => {
  const adapter = new TelegramAdapter();
  const message = { from: { id: 7 }, chat: { id: 7, type: 'private' }, contact: { user_id: 7, phone_number: '79990000000' } };
  assert.equal(adapter.normalizeInbound({ message }).contact.verified, true);
  assert.equal(adapter.normalizeInbound({ message: { ...message, contact: { ...message.contact, user_id: 8 } } }).contact.verified, false);
  assert.equal(adapter.normalizeInbound({ message: { ...message, chat: { type: 'group' } } }).contact.verified, false);
  assert.equal(adapter.normalizeInbound({ message: { ...message, contact: { phone_number: '79990000000' } } }).contact.verified, false);
});

test('phone binding rejects foreign contacts and keeps consent untouched', async () => {
  let writes = 0;
  let audit;
  const customer = { id: 'c', phone: null, phoneVerifiedAt: null };
  const service = new CustomerRuntime({ customerService: new CustomerService({ customerRepository: {
    findByIdentity: async () => ({ customer }),
    setVerifiedPhone: async (_id, data) => { writes++; Object.assign(customer, data, { phoneVerifiedAt: data.verifiedAt }); return customer; },
  }, auditRepository: { record: async (event) => { audit = event; } } }) });
  const context = { authMethod: 'telegram_bot', correlationId: '1' };
  await assert.rejects(service.verifyTelegramBotPhone('c', { externalUserId: '7', contactUserId: '8', phone: '79990000000' }, context), { code: 'PHONE_VERIFICATION_FAILED' });
  await assert.rejects(service.verifyTelegramBotPhone('other', { externalUserId: '7', contactUserId: '7', phone: '79990000000' }, context), { code: 'PHONE_VERIFICATION_FAILED' });
  assert.equal(writes, 0);
  await service.verifyTelegramBotPhone('c', { externalUserId: '7', contactUserId: '7', phone: '79990000000' }, context);
  assert.equal(customer.phone, '+79990000000');
  assert.equal(audit.authMethod, 'telegram_bot');
  assert.equal(customer.consents, undefined);
  await service.verifyTelegramBotPhone('c', { externalUserId: '7', contactUserId: '7', phone: '79990000000' }, context);
  assert.equal(writes, 1);
  await assert.rejects(service.verifyTelegramBotPhone('c', { externalUserId: '7', contactUserId: '7', phone: '79990000001' }, context), { code: 'IDENTITY_CONFLICT' });
});

test('Mini App opens inside Telegram only for private chats', () => {
  const renderer = new TelegramRenderer();
  const view = { text: 'Открыть', actions: [{ type: 'open_mini_app', label: 'Открыть', url: 'https://example.test' }] };
  assert.equal(renderer.renderView(view, { chatType: 'private' }).reply_markup.inline_keyboard[0][0].web_app.url, 'https://example.test');
  assert.equal(renderer.renderView(view, { chatType: 'group' }).reply_markup.inline_keyboard[0][0].url, 'https://example.test');
});
