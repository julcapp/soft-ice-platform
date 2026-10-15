const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const express = require('express');
const { CustomerRepository } = require('../src/modules/customer/CustomerRepository');
const { createAuthRouter } = require('../src/api/v1/authRoutes');
const { attachCorrelationId, sendError } = require('../src/platform/http/apiResponse');
const { DisplayCustomerRecognitionService, AllowDisplayRecognitionAbuseGuard,
  DeterministicDisplayPhoneVerificationProvider } = require('../src/modules/customer/DisplayCustomerRecognitionService');
process.env.NODE_ENV = 'test';
const request = { machine_id: 'test-machine', phone: '+79130000001' };
function fixture({ known = false, provider = new DeterministicDisplayPhoneVerificationProvider(), guard = new AllowDisplayRecognitionAbuseGuard(), lookupError = false, defaultProvider = false } = {}) {
  let now = new Date('2026-09-29T00:00:00Z');
  const reads = [], audits = [];
  const rows = [{ id: 'private-customer', phone: request.phone, phoneVerifiedAt: known ? now : null, name: 'Private name', identities: [], clubAccount: { balance: 999 } }];
  const before = JSON.stringify(rows);
  // The real repository may only read; all domain mutations and session access throw.
  const forbidden = new Proxy({}, { get() { throw new Error('Forbidden domain access'); } });
  const prisma = { customer: { async findFirst(query) { reads.push(query); if (lookupError) throw new Error('private database failure'); return rows.find(row => row.phone === query.where.phone && row.phoneVerifiedAt !== null) || null; } }, authSession: forbidden, clubAccount: forbidden, order: forbidden };
  const service = new DisplayCustomerRecognitionService({ customerRepository: new CustomerRepository(prisma), auditRepository: { record: async (event) => audits.push(event) }, ...(defaultProvider ? {} : { verificationProvider: provider }), abuseGuard: guard, clock: () => now, codeFactory: () => '123456' });
  return { service, reads, audits, unchanged: () => assert.equal(JSON.stringify(rows), before), advance: (ms) => { now = new Date(now.getTime() + ms); } };
}
test('normalizes explicit RU forms and reads only verified phones without domain mutation', async () => {
  const f = fixture({ known: true });
  for (const phone of ['+7 (913) 000-00-01', '8 (913) 000-00-01', '79130000001', '9130000001']) {
    assert.deepEqual(await f.service.recognize({ ...request, phone }), { state: 'RETURNING' });
  }
  assert.ok(f.reads.every(q => q.where.phone === request.phone && q.where.phoneVerifiedAt.not === null));
  f.unchanged();
  assert.doesNotMatch(JSON.stringify(f.audits), /79130000001|9130000001|Private name|private-customer|999/);
});
test('rejects malformed, foreign, Kazakhstan range, excessive and non-string phones safely', async () => {
  const f = fixture();
  for (const phone of [null, {}, 79130000001, '+1 9130000001', '+77010000001', '+79130000001abc', '+79130000001 ext 2', '+7+9130000001', '913', '9'.repeat(100), '+7\n9130000001']) {
    await assert.rejects(f.service.recognize({ ...request, phone }), e => e.statusCode === 400 && e.code === 'DISPLAY_PHONE_INVALID' && !e.message.includes(String(phone)));
  }
  assert.equal(f.reads.length, 0);
});
test('unknown and unverified phones are NEW; default provider is unavailable with no challenge', async () => {
  for (const phone of [request.phone, '+79130000002']) {
    const f = fixture({ defaultProvider: true });
    const result = await f.service.recognize({ ...request, phone });
    assert.equal(result.state, 'NEW'); assert.equal(result.verification.status, 'UNAVAILABLE');
    assert.equal(f.service.challengeRepository.challenges.size, 0); f.unchanged();
  }
});
test('default guard and failed lookup fail closed, without leaking errors', async () => {
  const defaultService = new DisplayCustomerRecognitionService({ customerRepository: { findByVerifiedPhone() { throw new Error('must not read'); } } });
  assert.equal((await defaultService.recognize(request)).state, 'UNAVAILABLE');
  assert.deepEqual(await fixture({ lookupError: true }).service.recognize(request), { state: 'UNAVAILABLE', retryable: true });
});
test('challenge expires exactly after five minutes; no raw code or phone is stored', async () => {
  const f = fixture(); const result = await f.service.recognize(request); const c = result.verification;
  assert.equal(result.state, 'NEW'); assert.equal(c.expiresAt, '2026-09-29T00:05:00.000Z');
  assert.doesNotMatch(JSON.stringify([...f.service.challengeRepository.challenges.values()]), /123456|79130000001/);
  f.advance(300000); assert.equal((await f.service.verify(c.challengeId, { code: '123456' })).status, 'EXPIRED'); f.unchanged();
});
test('three incorrect attempts invalidate, including malformed codes and concurrent attempts', async () => {
  const f = fixture(); const { verification: c } = await f.service.recognize(request);
  const results = await Promise.all(['bad', '000000', ''].map(code => f.service.verify(c.challengeId, { code })));
  assert.equal(results.at(-1).status, 'INVALIDATED');
  assert.equal((await f.service.verify(c.challengeId, { code: '123456' })).status, 'INVALIDATED');
  assert.equal((await f.service.verify(c.challengeId, { code: '123456' })).remainingAttempts, 0);
});
test('correct code verifies only the challenge, never identity/session/club/order', async () => {
  const f = fixture(); const { verification: c } = await f.service.recognize(request);
  assert.equal((await f.service.verify(c.challengeId, { code: '123456' })).status, 'VERIFIED');
  f.unchanged(); assert.equal(f.reads.length, 1);
});
test('resend invalidates previous challenge, binds machine/phone, and fails closed', async () => {
  const f = fixture(); const { verification: c } = await f.service.recognize(request);
  await assert.rejects(f.service.resend(c.challengeId, { ...request, phone: '+79130000002' }), e => e.statusCode === 404);
  const next = await f.service.resend(c.challengeId, request);
  assert.notEqual(next.challengeId, c.challengeId);
  assert.equal((await f.service.verify(c.challengeId, { code: '123456' })).status, 'INVALIDATED');
  f.service.verificationProvider = { async sendCode() { throw new Error('secret provider data'); } };
  assert.equal((await f.service.resend(next.challengeId, request)).status, 'UNAVAILABLE');
  assert.equal((await f.service.verify(next.challengeId, { code: '123456' })).status, 'INVALIDATED');
});
test('repeated recognition invalidates previous pending challenge', async () => {
  const f = fixture(); const first = await f.service.recognize(request); await f.service.recognize(request);
  assert.equal((await f.service.verify(first.verification.challengeId, { code: '123456' })).status, 'INVALIDATED');
});
test('test verifier rejects production and development imports/usage', () => {
  for (const env of ['production', 'development']) assert.throws(() => execFileSync(process.execPath, ['-e', `new (require('./src/modules/customer/DisplayCustomerRecognitionService').DeterministicDisplayPhoneVerificationProvider)()`], { cwd: require('path').resolve(__dirname, '..'), env: { ...process.env, NODE_ENV: env }, stdio: 'pipe' }));
});
test('HTTP DTO is allowlisted, no-store, safe Russian validation, no caller correlation PII', async (t) => {
  const f = fixture({ known: true }); const app = express(); app.use(express.json()); app.use(attachCorrelationId);
  app.use('/api/v1/auth', createAuthRouter({ displayCustomerRecognitionService: f.service })); app.use((e, req, res, next) => sendError(res, req, e));
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); t.after(() => server.close());
  const post = (body) => fetch(`http://127.0.0.1:${server.address().port}/api/v1/auth/display-phone/recognition`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': request.phone }, body: JSON.stringify(body) });
  const response = await post(request); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const payload = await response.json(); assert.deepEqual(payload.data.attributes, { state: 'RETURNING', retryable: false, verification: null });
  assert.doesNotMatch(JSON.stringify({ payload, audit: f.audits }), /79130000001|private-customer|Private name|balance|bonus|customer_id|orders|token/);
  const invalid = await post({ ...request, phone: 'invalid' }); assert.equal(invalid.status, 400); assert.match((await invalid.json()).error.message, /Введите российский/);
});
test('audit errors are sanitized and invalid bodies never leak input', async () => {
  const f = fixture({ known: true });
  f.service.auditRepository = { async record() { throw new Error('raw phone +79130000001 database secret'); } };
  await assert.rejects(f.service.recognize(request), e => e.statusCode === 503 && e.code === 'DISPLAY_RECOGNITION_AUDIT_UNAVAILABLE' && !e.message.includes('7913'));
  await assert.rejects(f.service.recognize(null), e => e.statusCode === 400);
});
test('resend throttling invalidates previous challenge without issuing another', async () => {
  const f = fixture(); const { verification: c } = await f.service.recognize(request);
  f.service.abuseGuard = { async check() { throw new Error('throttled'); } };
  assert.equal((await f.service.resend(c.challengeId, request)).status, 'UNAVAILABLE');
  assert.equal((await f.service.verify(c.challengeId, { code: '123456' })).status, 'INVALIDATED');
  assert.equal(f.service.challengeRepository.challenges.size, 1);
});
