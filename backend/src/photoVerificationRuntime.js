const { getPrismaClient } = require('./common/database');
const { BonusRewardEngine } = require('./modules/bonus');
const { PhotoCaptureVisualVerifier } = require('./modules/photo_verification/PhotoCaptureVisualVerifier');
const {
  PrismaPhotoVerificationRepository,
  PrismaPhotoSubmissionRepository,
  LocalPhotoStorageAdapter,
  PhotoSubmissionIntakeService,
  PhotoCaptureChallengeService,
  PhotoCustomerWorkflow,
  CrmPhotoNotifier,
  PhotoVerificationAdminService,
  PhotoManualReviewService,
  PhotoVerificationMetricsService,
  PhotoPublicationReadModel,
  PhotoRewardPolicy,
  ImageFingerprintService,
  SharpImageDecoder,
  MetadataAnalyzer,
  DuplicateDetector,
  PhotoTechnicalAnalyzer,
  PhotoModerationLifecycle,
  PhotoModerationOrchestrator,
  OpenAIVisionProvider,
  TelegramPhotoPublisher,
  VkPhotoPublisher,
  MaxPhotoPublisher,
  PhotoPublishingOrchestrator,
  PHOTO_PUBLISHING_TARGETS,
} = require('./modules/photo_verification');

function attachPhotoVerificationRuntime(dependencies, { prisma, logger } = {}) {
  if (!dependencies) throw new Error('dependencies are required');

  const db = prisma || getPrismaClient();
  const repository = dependencies.photoVerificationRepository || new PrismaPhotoVerificationRepository(db);
  const submissionRepository = dependencies.photoSubmissionRepository || new PrismaPhotoSubmissionRepository(db);
  const storage = dependencies.photoStorage || new LocalPhotoStorageAdapter();
  const notifier = dependencies.photoNotifier || new CrmPhotoNotifier({ crmRuntime: dependencies.crmRuntime, logger });
  const customerWorkflow = dependencies.photoCustomerWorkflow || new PhotoCustomerWorkflow({ repository, notifier });
  const captureChallengeService = dependencies.photoCaptureChallengeService || new PhotoCaptureChallengeService({
    repository,
    secret: process.env.PHOTO_CAPTURE_CHALLENGE_SECRET,
    ttlSeconds: process.env.PHOTO_CAPTURE_CHALLENGE_TTL_SECONDS || 180,
  });
  const captureVisualVerifier = dependencies.photoCaptureVisualVerifier || new PhotoCaptureVisualVerifier({
    prisma: db,
    secret: process.env.PHOTO_CAPTURE_CHALLENGE_SECRET,
  });
  const imageDecoder = dependencies.photoImageDecoder || new SharpImageDecoder();
  const fingerprintService = dependencies.photoFingerprintService || new ImageFingerprintService({ imageDecoder });
  const duplicateDetector = dependencies.photoDuplicateDetector || new DuplicateDetector({ repository });
  const technicalAnalyzer = dependencies.photoTechnicalAnalyzer || new PhotoTechnicalAnalyzer({
    metadataAnalyzer: dependencies.photoMetadataAnalyzer || new MetadataAnalyzer(),
    fingerprintService,
    duplicateDetector,
    repository,
  });
  const moderationLifecycle = dependencies.photoModerationLifecycle || new PhotoModerationLifecycle({ repository });

  const targets = {
    ...PHOTO_PUBLISHING_TARGETS,
    MAX: Object.freeze({
      ...PHOTO_PUBLISHING_TARGETS.MAX,
      targetId: process.env.MAX_CHANNEL_CHAT_ID || PHOTO_PUBLISHING_TARGETS.MAX.targetId,
    }),
  };
  const publishers = dependencies.photoPublishers || {
    VK: new VkPhotoPublisher(),
    TELEGRAM: new TelegramPhotoPublisher(),
    MAX: new MaxPhotoPublisher(),
  };
  const visionProvider = dependencies.photoVisionProvider || (
    process.env.OPENAI_API_KEY && process.env.PHOTO_VISION_MODEL
      ? new OpenAIVisionProvider({
        mediaLoader: async (storageKey) => ({
          buffer: await storage.get(storageKey),
          mimeType: mimeTypeFromStorageKey(storageKey),
        }),
      })
      : null
  );

  const publishingOrchestrator = dependencies.photoPublishingOrchestrator || new PhotoPublishingOrchestrator({ publishers, repository, targets });
  const rewardPolicy = dependencies.photoRewardPolicy || new PhotoRewardPolicy({ repository });
  const rewardEngine = dependencies.photoRewardEngine || new BonusRewardEngine({
    prisma: db,
    resolveBonusUnits: (context) => rewardPolicy.resolveBonusUnits(context),
  });

  dependencies.photoVerificationRepository = repository;
  dependencies.photoSubmissionRepository = submissionRepository;
  dependencies.photoStorage = storage;
  dependencies.photoNotifier = notifier;
  dependencies.photoCustomerWorkflow = customerWorkflow;
  dependencies.photoCaptureChallengeService = captureChallengeService;
  dependencies.photoCaptureVisualVerifier = captureVisualVerifier;
  dependencies.photoImageDecoder = imageDecoder;
  dependencies.photoFingerprintService = fingerprintService;
  dependencies.photoDuplicateDetector = duplicateDetector;
  dependencies.photoTechnicalAnalyzer = technicalAnalyzer;
  dependencies.photoModerationLifecycle = moderationLifecycle;
  dependencies.photoVisionProvider = visionProvider;
  dependencies.photoPublishers = publishers;
  dependencies.photoPublishingTargets = targets;
  dependencies.photoPublishingOrchestrator = publishingOrchestrator;
  dependencies.photoRewardPolicy = rewardPolicy;
  dependencies.photoRewardEngine = rewardEngine;
  dependencies.photoModerationOrchestrator = dependencies.photoModerationOrchestrator || new PhotoModerationOrchestrator({
    repository, storage, technicalAnalyzer, customerWorkflow, moderationLifecycle, publishingOrchestrator,
    rewardEngine, captureVisualVerifier, visionProvider, logger,
  });
  dependencies.photoManualReviewService = dependencies.photoManualReviewService || new PhotoManualReviewService({
    repository, storage, customerWorkflow, publishingOrchestrator, rewardEngine, moderationLifecycle,
  });
  dependencies.photoVerificationMetricsService = dependencies.photoVerificationMetricsService || new PhotoVerificationMetricsService({
    prisma: db, manualReviewService: dependencies.photoManualReviewService,
  });
  dependencies.photoVerificationAdminService = dependencies.photoVerificationAdminService || new PhotoVerificationAdminService({ repository });
  dependencies.photoPublicationReadModel = dependencies.photoPublicationReadModel || new PhotoPublicationReadModel({ repository });
  dependencies.photoSubmissionIntakeService = dependencies.photoSubmissionIntakeService || new PhotoSubmissionIntakeService({
    repository: submissionRepository, storage, customerWorkflow, captureChallengeService,
  });

  return dependencies;
}

function mimeTypeFromStorageKey(storageKey) {
  const normalized = String(storageKey).toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

module.exports = { attachPhotoVerificationRuntime, mimeTypeFromStorageKey };
