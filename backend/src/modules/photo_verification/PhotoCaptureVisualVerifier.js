const crypto = require('node:crypto');

class PhotoCaptureVisualVerifier {
  constructor({ prisma, secret } = {}) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
    this.secret = secret || null;
  }

  async verify({ photoChallengeId, customerId, detectedCaptureCode }) {
    if (!this.secret) {
      return { matches: false, available: false, reasonCode: 'PHOTO_CAPTURE_CHALLENGE_SECRET_NOT_CONFIGURED' };
    }
    if (!detectedCaptureCode) {
      return { matches: false, available: true, reasonCode: 'PHOTO_CAPTURE_CODE_NOT_VISIBLE' };
    }

    const rows = await this.prisma.$queryRaw`
      SELECT issued."payload"->>'tokenHash' AS "tokenHash"
      FROM "PhotoVerificationEvent" consumed
      JOIN "PhotoVerificationEvent" issued
        ON issued."id" = consumed."payload"->>'issuedEventId'
      WHERE consumed."photoChallengeId" = ${photoChallengeId}
        AND consumed."eventType" = 'capture_challenge_consumed'
        AND consumed."payload"->>'customerId' = ${customerId}
        AND consumed."payload"->>'reason' = 'submitted'
        AND issued."eventType" = 'capture_challenge_issued'
      ORDER BY consumed."createdAt" DESC
      LIMIT 1
    `;
    const expectedHash = rows[0]?.tokenHash;
    if (!expectedHash) {
      return { matches: false, available: false, reasonCode: 'PHOTO_CAPTURE_CODE_EVIDENCE_NOT_FOUND' };
    }

    const actualHash = crypto.createHmac('sha256', this.secret)
      .update(`${photoChallengeId}:${customerId}:${String(detectedCaptureCode).trim().toUpperCase()}`)
      .digest('hex');
    const expected = Buffer.from(expectedHash, 'hex');
    const actual = Buffer.from(actualHash, 'hex');
    const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    return {
      matches,
      available: true,
      reasonCode: matches ? null : 'PHOTO_CAPTURE_CODE_VISUAL_MISMATCH',
    };
  }
}

module.exports = { PhotoCaptureVisualVerifier };
