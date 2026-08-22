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
  PHOTO_PUBLISHING_TARGETS,
  PHOTO_PAID_SUBSCRIPTION_CHANNELS,
} = require('./publishingTargets');
const { PhotoPublishingOrchestrator, PUBLICATION_STATUSES } = require('./PhotoPublishingOrchestrator');
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
    'photo publishing target configuration',
    'multi-channel photo publishing orchestration',
    'paid subscription channel configuration boundary',
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
  PhotoPublishingOrchestrator,
  PUBLICATION_STATUSES,
  PHOTO_PUBLISHING_TARGETS,
  PHOTO_PAID_SUBSCRIPTION_CHANNELS,
  USER_PHOTO_STATUSES,
  USER_PHOTO_MESSAGES,
  publicStatus,
  PHOTO_VERIFICATION_MODES,
  PHOTO_VERIFICATION_DECISIONS,
  PHOTO_SUBMISSION_STATUSES,
};
