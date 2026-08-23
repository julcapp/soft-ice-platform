const test = require('node:test');
const assert = require('node:assert/strict');
const { PhotoSubmissionIntakeService } = require('../src/modules/photo_verification/PhotoSubmissionIntakeService');

function captureService(calls = []) {
  return {
    issue: async ({ photoChallengeId }) => ({ required: true, code: 'ТИМОША-123456', expiresAt: new Date(Date.now() + 60000), photoChallengeId }),
    verify: async ({ code }) => code === 'ТИМОША-123456'
      ? { valid: true, issuedEventId: 'capture-event-1' }
      : { valid: false, reasonCode: 'PHOTO_CAPTURE_CODE_INVALID' },
    consume: async (input) => calls.push(['consume', input]),
  };
}

test('camera intake stores photo only for owned active challenge and consumes one-time code', async () => {
  const calls = [];
  const repository = {
    findActiveChallengeForCustomer: async () => ({ id: 'challenge-1', status: 'waiting' }),
    getChallengeForCustomer: async (id, customerId) => id === 'challenge-1' && customerId === 'customer-1' ? { id, customerId, deadlineAt: new Date(Date.now() + 60000), photoFilePath: null } : null,
    attachSourceFile: async (input) => calls.push(['attach', input]),
  };
  const storage = {
    put: async () => ({ storageKey: 'customer-1/challenge-1/photo.jpg', mimeType: 'image/jpeg', size: 3 }),
    delete: async () => null,
  };
  const customerWorkflow = { recordUploaded: async (input) => { calls.push(['moderation', input]); return { status: 'moderation' }; } };
  const service = new PhotoSubmissionIntakeService({ repository, storage, customerWorkflow, captureChallengeService: captureService(calls) });

  const active = await service.getActiveChallenge('customer-1');
  assert.equal(active.captureMode, 'camera_required');
  assert.equal(active.captureChallenge.code, 'ТИМОША-123456');
  const result = await service.submit({ customerId: 'customer-1', photoChallengeId: 'challenge-1', buffer: Buffer.from([1, 2, 3]), mimeType: 'image/jpeg', captureCode: 'ТИМОША-123456', correlationId: 'corr-1' });
  assert.equal(result.customerStatus.status, 'moderation');
  assert.equal(result.captureChallengeConsumed, true);
  assert.deepEqual(calls.map(([name]) => name), ['attach', 'consume', 'moderation']);
});

test('camera intake rejects invalid one-time capture code before storage', async () => {
  const service = new PhotoSubmissionIntakeService({
    repository: { getChallengeForCustomer: async () => ({ id: 'challenge-1', customerId: 'customer-1', deadlineAt: new Date(Date.now() + 60000), photoFilePath: null }) },
    storage: { put: async () => assert.fail('must not store') },
    customerWorkflow: { recordUploaded: async () => assert.fail('must not moderate') },
    captureChallengeService: captureService(),
  });
  await assert.rejects(
    () => service.submit({ customerId: 'customer-1', photoChallengeId: 'challenge-1', buffer: Buffer.from([1]), mimeType: 'image/jpeg', captureCode: 'WRONG' }),
    (error) => error.code === 'PHOTO_CAPTURE_CODE_INVALID' && error.statusCode === 409,
  );
});

test('camera intake rejects challenge owned by another customer', async () => {
  const service = new PhotoSubmissionIntakeService({
    repository: { getChallengeForCustomer: async () => null },
    storage: { put: async () => assert.fail('must not store') },
    customerWorkflow: { recordUploaded: async () => assert.fail('must not moderate') },
    captureChallengeService: captureService(),
  });
  await assert.rejects(() => service.submit({ customerId: 'customer-2', photoChallengeId: 'challenge-1', buffer: Buffer.from([1]), mimeType: 'image/jpeg', captureCode: 'ТИМОША-123456' }), (error) => error.code === 'PHOTO_CHALLENGE_NOT_FOUND' && error.statusCode === 404);
});
