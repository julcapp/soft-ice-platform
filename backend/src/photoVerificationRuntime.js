const { getPrismaClient } = require('./common/database');
const {
  PrismaPhotoVerificationRepository,
  PrismaPhotoSubmissionRepository,
  LocalPhotoStorageAdapter,
  PhotoSubmissionIntakeService,
  PhotoCustomerWorkflow,
  CrmPhotoNotifier,
  PhotoVerificationAdminService,
  PhotoPublicationReadModel,
} = require('./modules/photo_verification');

function attachPhotoVerificationRuntime(dependencies, { prisma, logger } = {}) {
  if (!dependencies) throw new Error('dependencies are required');

  const db = prisma || getPrismaClient();
  const repository = dependencies.photoVerificationRepository || new PrismaPhotoVerificationRepository(db);
  const submissionRepository = dependencies.photoSubmissionRepository || new PrismaPhotoSubmissionRepository(db);
  const notifier = dependencies.photoNotifier || new CrmPhotoNotifier({ crmRuntime: dependencies.crmRuntime, logger });
  const customerWorkflow = dependencies.photoCustomerWorkflow || new PhotoCustomerWorkflow({ repository, notifier });

  dependencies.photoVerificationRepository = repository;
  dependencies.photoSubmissionRepository = submissionRepository;
  dependencies.photoNotifier = notifier;
  dependencies.photoCustomerWorkflow = customerWorkflow;
  dependencies.photoVerificationAdminService = dependencies.photoVerificationAdminService || new PhotoVerificationAdminService({ repository });
  dependencies.photoPublicationReadModel = dependencies.photoPublicationReadModel || new PhotoPublicationReadModel({ repository });
  dependencies.photoSubmissionIntakeService = dependencies.photoSubmissionIntakeService || new PhotoSubmissionIntakeService({
    repository: submissionRepository,
    storage: dependencies.photoStorage || new LocalPhotoStorageAdapter(),
    customerWorkflow,
  });

  return dependencies;
}

module.exports = { attachPhotoVerificationRuntime };
