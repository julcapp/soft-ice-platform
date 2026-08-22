const { PhotoVerificationAgent } = require('./PhotoVerificationAgent');
const { MockVisionProvider } = require('./MockVisionProvider');
const { OpenAIVisionProvider } = require('./OpenAIVisionProvider');
const { PrismaPhotoVerificationRepository } = require('./PrismaPhotoVerificationRepository');
const { PrismaPhotoSubmissionRepository } = require('./PrismaPhotoSubmissionRepository');
const { LocalPhotoStorageAdapter } = require('./LocalPhotoStorageAdapter');
const { PhotoSubmissionIntakeService } = require('./PhotoSubmissionIntakeService');
const { PhotoCaptureChallengeService } = require('./PhotoCaptureChallengeService');
const { PhotoModerationLifecycle } = require('./PhotoModerationLifecycle');
const { PhotoModerationOrchestrator } = require('./PhotoModerationOrchestrator');
const { BlockedPhotoRewardEngine } = require('./BlockedPhotoRewardEngine');
const { MetadataAnalyzer } = require('./MetadataAnalyzer');
const { ImageFingerprintService } = require('./ImageFingerprintService');
const { SharpImageDecoder } = require('./SharpImageDecoder');
const { DuplicateDetector } = require('./DuplicateDetector');
const { PhotoTechnicalAnalyzer } = require('./PhotoTechnicalAnalyzer');
const { PhotoCustomerWorkflow } = require('./PhotoCustomerWorkflow');
const { CrmPhotoNotifier } = require('./CrmPhotoNotifier');
const { PhotoVerificationAdminService } = require('./PhotoVerificationAdminService');
const { PhotoPublicationReadModel } = require('./PhotoPublicationReadModel');
const { TelegramPhotoPublisher } = require('./TelegramPhotoPublisher');
const { VkPhotoPublisher } = require('./VkPhotoPublisher');
const { MaxPhotoPublisher } = require('./MaxPhotoPublisher');
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
    'admin-controlled photo verification settings',
    'customer photo publication read model',
    'camera photo intake and source storage boundary',
    'one-time camera capture challenge',
    'CRM-backed customer photo notifications',
    'production image decoding boundary',
    'production publishing adapters',
    'production multimodal AI provider boundary',
    'end-to-end moderation orchestration',
    'reward engine boundary',
  ],
  PhotoVerificationAgent,
  MockVisionProvider,
  OpenAIVisionProvider,
  PrismaPhotoVerificationRepository,
  PrismaPhotoSubmissionRepository,
  LocalPhotoStorageAdapter,
  PhotoSubmissionIntakeService,
  PhotoCaptureChallengeService,
  PhotoModerationLifecycle,
  PhotoModerationOrchestrator,
  BlockedPhotoRewardEngine,
  MetadataAnalyzer,
  ImageFingerprintService,
  SharpImageDecoder,
  DuplicateDetector,
  PhotoTechnicalAnalyzer,
  PhotoCustomerWorkflow,
  CrmPhotoNotifier,
  PhotoVerificationAdminService,
  PhotoPublicationReadModel,
  TelegramPhotoPublisher,
  VkPhotoPublisher,
  MaxPhotoPublisher,
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
