const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ImageFingerprintService,
  DuplicateDetector,
  MetadataAnalyzer,
  PhotoTechnicalAnalyzer,
} = require('../src/modules/photo_verification');

const makeMatrix = (width, height, offset = 0) => Array.from({ length: height }, (_, y) =>
  Array.from({ length: width }, (_, x) => (x * 7 + y * 11 + offset) % 256));

test('fingerprint service always computes SHA-256 and computes pHash/dHash with decoder', async () => {
  const imageDecoder = {
    async toLuminanceMatrix(_buffer, { width, height }) {
      return makeMatrix(width, height);
    },
  };
  const service = new ImageFingerprintService({ imageDecoder });
  const result = await service.fingerprint(Buffer.from('photo-data'));

  assert.equal(result.sha256.length, 64);
  assert.equal(result.pHash.length, 16);
  assert.equal(result.dHash.length, 16);
  assert.equal(result.perceptualAvailable, true);
});

test('duplicate detector identifies exact SHA-256 duplicate', async () => {
  const repository = {
    async findFingerprintCandidates() {
      return [{ photoChallengeId: 'old', sha256: 'same', pHash: null, dHash: null }];
    },
  };
  const detector = new DuplicateDetector({ repository });
  const result = await detector.analyze({ photoChallengeId: 'new', sha256: 'same', pHash: null, dHash: null });

  assert.equal(result.duplicate, true);
  assert.equal(result.matchedPhotoChallengeId, 'old');
  assert.deepEqual(result.signals, ['exact_duplicate']);
});

test('metadata analyzer treats absent EXIF as neutral, not rejection evidence', () => {
  const analyzer = new MetadataAnalyzer();
  const result = analyzer.analyze({ buffer: Buffer.from('not-a-jpeg'), mimeType: 'image/png' });

  assert.equal(result.exifPresent, false);
  assert.deepEqual(result.metadataRiskSignals, []);
});

test('technical analyzer persists fingerprint and audit event', async () => {
  const calls = [];
  const repository = {
    async findFingerprintCandidates() { return []; },
    async upsertFingerprint(value) { calls.push(['fingerprint', value]); },
    async recordEvent(value) { calls.push(['event', value]); },
  };
  const imageDecoder = {
    async toLuminanceMatrix(_buffer, { width, height }) { return makeMatrix(width, height, 3); },
  };
  const fingerprintService = new ImageFingerprintService({ imageDecoder });
  const duplicateDetector = new DuplicateDetector({ repository });
  const technicalAnalyzer = new PhotoTechnicalAnalyzer({
    metadataAnalyzer: new MetadataAnalyzer(),
    fingerprintService,
    duplicateDetector,
    repository,
  });

  const result = await technicalAnalyzer.analyze({
    photoChallengeId: 'challenge-1',
    buffer: Buffer.from('image'),
    mimeType: 'image/png',
  });

  assert.equal(result.duplicateResult.duplicate, false);
  assert.equal(calls[0][0], 'fingerprint');
  assert.equal(calls[1][0], 'event');
  assert.equal(calls[1][1].eventType, 'technical_analysis_completed');
});
