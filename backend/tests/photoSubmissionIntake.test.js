const test = require('node:test');
const assert = require('node:assert/strict');
const { PhotoSubmissionIntakeService } = require('../src/modules/photo_verification/PhotoSubmissionIntakeService');

test('camera intake stores photo only for owned active challenge and starts moderation', async () => {
  const calls = [];
  const repository = {
    findActiveChallengeForCustomer: async () => ({ id: 'challenge-1', status: 'waiting' }),
    getChallengeForCustomer: async (id, customerId) => id === 'challenge-1' && customerId === 'customer-1' ? { id, customerId, deadlineAt: new Date(Date.now() + 60000) } : null,
    attachSourceFile: async (input) => calls.push(['attach', input]),
  };
  const storage = { put: async () => ({ storageKey: 'customer-1/challenge-1/photo.jpg', mimeType: 'image/jpeg', size: 3 }) };
  const customerWorkflow = { recordUploaded: async (input) => { calls.push(['moderation', input]); return { status: 'moderation' }; } };
  const service = new PhotoSubmissionIntakeService({ repository, storage, customerWorkflow });

  const active = await service.getActiveChallenge('customer-1');
  assert.equal(active.captureMode, 'camera_required');
  const result = await service.submit({ customerId: 'customer-1', photoChallengeId: 'challenge-1', buffer: Buffer.from([1, 2, 3]), mimeType: 'image/jpeg', correlationId: 'corr-1' });
  assert.equal(result.customerStatus.status, 'moderation');
  assert.equal(calls[0][0], 'attach');
  assert.equal(calls[1][0], 'moderation');
});

test('camera intake rejects challenge owned by another customer', async () => {
  const service = new PhotoSubmissionIntakeService({
    repository: { getChallengeForCustomer: async () => null },
    storage: { put: async () => assert.fail('must not store') },
    customerWorkflow: { recordUploaded: async () => assert.fail('must not moderate') },
  });
  await assert.rejects(() => service.submit({ customerId: 'customer-2', photoChallengeId: 'challenge-1', buffer: Buffer.from([1]), mimeType: 'image/jpeg' }), (error) => error.code === 'PHOTO_CHALLENGE_NOT_FOUND' && error.statusCode === 404);
});
