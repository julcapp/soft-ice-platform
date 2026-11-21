const test = require('node:test');
const assert = require('node:assert/strict');
const { PhotoCaptureChallengeService } = require('../src/modules/photo_verification/PhotoCaptureChallengeService');

function createRepository() {
  let current = null;
  const consumed = new Set();
  const calls = [];
  return {
    calls,
    async findActiveCaptureChallenge() {
      if (!current || consumed.has(current.id)) return null;
      return current;
    },
    async issueCaptureChallenge(input) {
      current = { id: `issued-${calls.length + 1}`, tokenHash: input.tokenHash, expiresAt: input.expiresAt };
      calls.push(['issued', current.id]);
      return current.id;
    },
    async consumeCaptureChallenge(input) {
      consumed.add(input.issuedEventId);
      calls.push(['consumed', input.issuedEventId, input.reason]);
    },
  };
}

test('capture challenge issues HMAC-backed code and validates it', async () => {
  const repository = createRepository();
  const service = new PhotoCaptureChallengeService({
    repository,
    secret: 'test-secret',
    randomInt: () => 4837,
    clock: () => new Date('2026-08-22T12:00:00Z'),
  });

  const issued = await service.issue({ photoChallengeId: 'p1', customerId: 'c1' });
  assert.equal(issued.code, 'ТИМОША-004837');
  const valid = await service.verify({ photoChallengeId: 'p1', customerId: 'c1', code: issued.code });
  assert.equal(valid.valid, true);
  const invalid = await service.verify({ photoChallengeId: 'p1', customerId: 'c1', code: 'ТИМОША-000001' });
  assert.equal(invalid.valid, false);
});

test('issuing a new capture code invalidates the previous one', async () => {
  const repository = createRepository();
  let value = 111111;
  const service = new PhotoCaptureChallengeService({ repository, secret: 'test-secret', randomInt: () => value++ });
  const first = await service.issue({ photoChallengeId: 'p1', customerId: 'c1' });
  const second = await service.issue({ photoChallengeId: 'p1', customerId: 'c1' });

  assert.notEqual(first.code, second.code);
  assert.ok(repository.calls.some(([type, , reason]) => type === 'consumed' && reason === 'rotated'));
  assert.equal((await service.verify({ photoChallengeId: 'p1', customerId: 'c1', code: first.code })).valid, false);
  assert.equal((await service.verify({ photoChallengeId: 'p1', customerId: 'c1', code: second.code })).valid, true);
});

test('capture challenge fails closed without deployment secret', async () => {
  const service = new PhotoCaptureChallengeService({ repository: createRepository() });
  await assert.rejects(
    () => service.issue({ photoChallengeId: 'p1', customerId: 'c1' }),
    (error) => error.code === 'PHOTO_CAPTURE_CHALLENGE_SECRET_NOT_CONFIGURED' && error.statusCode === 503,
  );
});
