'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AesGcmValueCodec } = require('../src/platform/security/AesGcmValueCodec');
const { BotRecipientBindingService } = require('../src/modules/bot_core/BotRecipientBindingService');
const { sha256 } = require('../src/platform/security/hash');

function fixture() {
  const rows = new Map();
  const repository = {
    async upsert(row) { rows.set(`${row.customerId}:${row.channel}`, { id: 'binding-1', ...row }); return rows.get(`${row.customerId}:${row.channel}`); },
    async findActive(customerId, channel) { return rows.get(`${customerId}:${channel}`) || null; },
  };
  const identities = new Map([
    [`telegram:${sha256('12345')}`, { customer: { id: 'customer-1' } }],
    [`max:${sha256('67890')}`, { customer: { id: 'customer-1' } }],
  ]);
  const service = new BotRecipientBindingService({
    repository,
    customerRepository: { findByIdentity: async (provider, hash) => identities.get(`${provider}:${hash}`) || null },
    codec: new AesGcmValueCodec({ key: Buffer.alloc(32, 7).toString('base64') }),
    clock: () => new Date('2026-09-02T10:00:00Z'),
    logger: { error() {} },
  });
  return { service, rows };
}

test('private Telegram webhook creates an encrypted, customer-bound recipient', async () => {
  const { service, rows } = fixture();
  await service.observeInbound({
    customerId: 'customer-1',
    channel: 'telegram',
    externalUserId: '12345',
    metadata: { chatId: '12345', chatType: 'private' },
  });
  const stored = rows.get('customer-1:telegram');
  assert.equal(stored.externalSubjectHash, sha256('12345'));
  assert.equal(stored.recipientCiphertext.includes('12345'), false);
  assert.equal(stored.source, 'TRUSTED_BOT_WEBHOOK');
  assert.deepEqual(await service.resolve('customer-1', 'telegram'), {
    channel: 'telegram',
    recipientType: 'chat_id',
    recipientId: '12345',
    verifiedAt: new Date('2026-09-02T10:00:00Z'),
  });
});

test('Telegram group chat and mismatched identity are never bound', async () => {
  const { service, rows } = fixture();
  const group = await service.observeInbound({
    customerId: 'customer-1', channel: 'telegram', externalUserId: '12345',
    metadata: { chatId: '-1001', chatType: 'group' },
  });
  assert.equal(group, null);
  assert.equal(rows.size, 0);
  await assert.rejects(
    () => service.observeInbound({
      customerId: 'customer-2', channel: 'max', externalUserId: '67890', metadata: {},
    }),
    (error) => error.code === 'BOT_RECIPIENT_IDENTITY_MISMATCH',
  );
});

test('AES-GCM ciphertext cannot be decrypted under another customer/channel context', () => {
  const codec = new AesGcmValueCodec({ key: Buffer.alloc(32, 9).toString('base64') });
  const encrypted = codec.encrypt('12345', 'customer-1:telegram');
  assert.equal(codec.decrypt(encrypted, 'customer-1:telegram'), '12345');
  assert.throws(() => codec.decrypt(encrypted, 'customer-2:telegram'), (error) => error.code === 'ENCRYPTED_VALUE_INVALID');
});
