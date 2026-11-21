const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { PhotoCaptureVisualVerifier } = require('../src/modules/photo_verification/PhotoCaptureVisualVerifier');

function tokenHash(secret, photoChallengeId, customerId, code) {
  return crypto.createHmac('sha256', secret)
    .update(`${photoChallengeId}:${customerId}:${code.trim().toUpperCase()}`)
    .digest('hex');
}

test('visual verifier matches OCR code against stored capture challenge HMAC', async () => {
  const secret = 'test-secret';
  const code = 'ТИМОША-483721';
  const prisma = {
    async $queryRaw() {
      return [{ tokenHash: tokenHash(secret, 'photo-1', 'customer-1', code) }];
    },
  };
  const verifier = new PhotoCaptureVisualVerifier({ prisma, secret });
  const result = await verifier.verify({ photoChallengeId: 'photo-1', customerId: 'customer-1', detectedCaptureCode: code });
  assert.equal(result.matches, true);
  assert.equal(result.reasonCode, null);
});

test('visual verifier sends mismatched OCR code to safe review path', async () => {
  const secret = 'test-secret';
  const prisma = {
    async $queryRaw() {
      return [{ tokenHash: tokenHash(secret, 'photo-1', 'customer-1', 'ТИМОША-483721') }];
    },
  };
  const verifier = new PhotoCaptureVisualVerifier({ prisma, secret });
  const result = await verifier.verify({ photoChallengeId: 'photo-1', customerId: 'customer-1', detectedCaptureCode: 'ТИМОША-000001' });
  assert.equal(result.matches, false);
  assert.equal(result.reasonCode, 'PHOTO_CAPTURE_CODE_VISUAL_MISMATCH');
});

test('visual verifier does not guess when code is not visible', async () => {
  const verifier = new PhotoCaptureVisualVerifier({ prisma: { $queryRaw: async () => assert.fail('DB lookup is not needed') }, secret: 'test-secret' });
  const result = await verifier.verify({ photoChallengeId: 'photo-1', customerId: 'customer-1', detectedCaptureCode: null });
  assert.equal(result.matches, false);
  assert.equal(result.reasonCode, 'PHOTO_CAPTURE_CODE_NOT_VISIBLE');
});
