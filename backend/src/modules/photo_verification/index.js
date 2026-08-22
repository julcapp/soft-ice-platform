const { PhotoVerificationAgent } = require('./PhotoVerificationAgent');
const { MockVisionProvider } = require('./MockVisionProvider');
const { PrismaPhotoVerificationRepository } = require('./PrismaPhotoVerificationRepository');
const { PhotoModerationLifecycle } = require('./PhotoModerationLifecycle');
const { MetadataAnalyzer } = require('./MetadataAnalyzer');
const { ImageFingerprintService } = require('./ImageFingerprintService');
const { DuplicateDetector } = require('./DuplicateDetector');
const { PhotoTechnicalAnalyzer } = require('./PhotoTechnicalAnalyzer');
const {
  PHOTO_VERIFICATION_MODES,
  PHOTO_VERIFICATION_DECISIONS,
  PHOTO_SUBMISSION_STATUSES,
} = require('./constants');

module.exports = {
  name: 'photo_verification',
  status: 'foundation',
  owns: [
    'photo verification decisions',
    'photo verification provider boundary',
    'photo moderation decision policy',
    'photo verification persistence records',
    'photo publication evidence',
    'source photo deletion evidence',
    'photo metadata analysis',
    'photo fingerprinting and duplicate detection',
  ],
  PhotoVerificationAgent,
  MockVisionProvider,
  PrismaPhotoVerificationRepository,
  PhotoModerationLifecycle,
  MetadataAnalyzer,
  ImageFingerprintService,
  DuplicateDetector,
  PhotoTechnicalAnalyzer,
  PHOTO_VERIFICATION_MODES,
  PHOTO_VERIFICATION_DECISIONS,
  PHOTO_SUBMISSION_STATUSES,
};
