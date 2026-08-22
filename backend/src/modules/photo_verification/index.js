const { PhotoVerificationAgent } = require('./PhotoVerificationAgent');
const { MockVisionProvider } = require('./MockVisionProvider');
const { PrismaPhotoVerificationRepository } = require('./PrismaPhotoVerificationRepository');
const { PhotoModerationLifecycle } = require('./PhotoModerationLifecycle');
const { MetadataAnalyzer } = require('./MetadataAnalyzer');
const { ImageFingerprintService } = require('./ImageFingerprintService');
const { DuplicateDetector } = require('./DuplicateDetector');
const { PhotoTechnicalAnalyzer } = require('./PhotoTechnicalAnalyzer');
const { PhotoCustomerWorkflow } = require('./PhotoCustomerWorkflow');
const {
  USER_PHOTO_STATUSES,
  USER_PHOTO_MESSAGES,
  publicStatus,
} = require('./UserPhotoStatus');
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
    'customer-facing photo moderation status',
  ],
  PhotoVerificationAgent,
  MockVisionProvider,
  PrismaPhotoVerificationRepository,
  PhotoModerationLifecycle,
  MetadataAnalyzer,
  ImageFingerprintService,
  DuplicateDetector,
  PhotoTechnicalAnalyzer,
  PhotoCustomerWorkflow,
  USER_PHOTO_STATUSES,
  USER_PHOTO_MESSAGES,
  publicStatus,
  PHOTO_VERIFICATION_MODES,
  PHOTO_VERIFICATION_DECISIONS,
  PHOTO_SUBMISSION_STATUSES,
};
