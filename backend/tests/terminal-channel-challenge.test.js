const test = require('node:test');
const assert = require('node:assert/strict');
const { TerminalChannelChallengeService } = require('../src/modules/bot_core/TerminalChannelChallengeService');

class MemoryRepo {
  constructor() { this.rows = []; }
  async create(data) {
    const row = { id: `ch_${this.rows.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
    this.rows.push(row);
    return row;
  }
  async findByTokenHash(tokenHash) { return this.rows.find((x) => x.tokenHash === tokenHash) || null; }
  async findActiveByExternalUserIdHash({ channel, externalUserIdHash }) {
    return [...this.rows].reverse().find((x) => x.channel === channel && x.externalUserIdHash === externalUserIdHash && x.status === 'STARTED') || null;
  }
  async invalidatePending({ phoneFingerprint, channel }) {
    for (const row of this.rows) {
      if (row.phoneFingerprint === phoneFingerprint && row.channel === channel && ['PENDING','STARTED'].includes(row.status)) {
        row.status = 'INVALIDATED';
        row.consumedAt = new Date();
      }
    }
  }
  async update(id, data) {
    const row = this.rows.find((x) => x.id === id);
    Object.assign(row, data, { updatedAt: new Date() });
    return row;
  }
}

class CustomerRepo {
  constructor() { this.customers = new Map(); this.identities = new Map(); this.next = 1; }
  async findByVerifiedPhone(phone) { return this.customers.get(phone) || null; }
  async createVerifiedPhoneCustomer({ phone }) {
    const customer = { id: `customer_${this.next++}`, phone, identities: [] };
    this.customers.set(phone, customer);
    return customer;
  }
  async findByIdentity(provider, subjectHash) {
    const hit = this.identities.get(`${provider}:${subjectHash}`);
    return hit || null;
  }
  async linkExternalIdentity(customerId, identityData) {
    const customer = [...this.customers.values()].find((x) => x.id === customerId);
    const value = { id: `identity_${this.identities.size + 1}`, customerId, ...identityData };
    this.identities.set(`${identityData.provider}:${identityData.externalSubjectHash}`, { identity: value, customer });
    return value;
  }
}

function makeService(clockRef = { now: new Date('2026-10-05T10:00:00Z') }) {
  return {
    repo: new MemoryRepo(),
    customers: new CustomerRepo(),
    service: null,
    clockRef,
  };
}

function wire(ctx) {
  ctx.service = new TerminalChannelChallengeService({
    repository: ctx.repo,
    customerRepository: ctx.customers,
    phoneSecret: 'test-phone-secret',
    maxBotUrl: 'https://max.ru/id7017438363_bot',
    telegramBotUrl: 'https://t.me/example_bot',
    clock: () => new Date(ctx.clockRef.now),
    ttlMs: 10 * 60 * 1000,
  });
  return ctx;
}

test('creates opaque MAX challenge without phone in deep link', async () => {
  const ctx = wire(makeService());
  const result = await ctx.service.create({
    machineId: 'TEST-MACHINE-001',
    phone: '+7 (903) 955-70-50',
    channel: 'MAX',
  });
  assert.equal(result.channel, 'MAX');
  assert.match(result.deepLink, /^https:\/\/max\.ru\/id7017438363_bot\?start=verify_[A-Za-z0-9_-]+$/);
  assert.equal(result.deepLink.includes('79039557050'), false);
  assert.equal(ctx.repo.rows[0].phoneFingerprint.includes('79039557050'), false);
});

test('verifies matching MAX contact and links identity', async () => {
  const ctx = wire(makeService());
  const created = await ctx.service.create({ machineId: 'TEST-MACHINE-001', phone: '+79039557050', channel: 'MAX' });
  const token = new URL(created.deepLink).searchParams.get('start').replace(/^verify_/, '');
  await ctx.service.start({ channel: 'MAX', token, externalUserId: '388292358' });
  const verified = await ctx.service.verifyContact({
    channel: 'MAX',
    externalUserId: '388292358',
    phone: '+79039557050',
    contactVerified: true,
  });
  assert.equal(verified.challenge.status, 'VERIFIED');
  assert.equal(verified.customer.phone, '+79039557050');
  assert.equal(ctx.customers.identities.size, 1);
});

test('rejects contact when messenger phone differs from terminal input', async () => {
  const ctx = wire(makeService());
  const created = await ctx.service.create({ machineId: 'TEST-MACHINE-001', phone: '+79039557050', channel: 'MAX' });
  const token = new URL(created.deepLink).searchParams.get('start').replace(/^verify_/, '');
  await ctx.service.start({ channel: 'MAX', token, externalUserId: '388292358' });
  await assert.rejects(
    () => ctx.service.verifyContact({
      channel: 'MAX',
      externalUserId: '388292358',
      phone: '+79030000000',
      contactVerified: true,
    }),
    (error) => error.code === 'PHONE_MISMATCH',
  );
});

test('expires challenge after ten minutes', async () => {
  const ctx = wire(makeService());
  const created = await ctx.service.create({ machineId: 'TEST-MACHINE-001', phone: '+79039557050', channel: 'MAX' });
  const token = new URL(created.deepLink).searchParams.get('start').replace(/^verify_/, '');
  ctx.clockRef.now = new Date('2026-10-05T10:10:01Z');
  await assert.rejects(
    () => ctx.service.start({ channel: 'MAX', token, externalUserId: '388292358' }),
    (error) => error.code === 'CHALLENGE_EXPIRED',
  );
});


test('does not allow a started challenge to be rebound to another MAX user', async () => {
  const ctx = wire(makeService());
  const created = await ctx.service.create({ machineId: 'TEST-MACHINE-001', phone: '+79990000001', channel: 'MAX' });
  const token = new URL(created.deepLink).searchParams.get('start').replace(/^verify_/, '');
  await ctx.service.start({ channel: 'MAX', token, externalUserId: '111111111' });
  await assert.rejects(
    () => ctx.service.start({ channel: 'MAX', token, externalUserId: '222222222' }),
    (error) => error.code === 'CHALLENGE_SUBJECT_MISMATCH',
  );
});
