const { getPrismaClient } = require('./common/database');
const {
  PrismaPhotoVerificationRepository,
  PhotoVerificationAdminService,
  PhotoPublicationReadModel,
} = require('./modules/photo_verification');

function attachPhotoVerificationRuntime(dependencies, { prisma } = {}) {
  if (!dependencies) throw new Error('dependencies are required');
  if (dependencies.photoVerificationAdminService && dependencies.photoPublicationReadModel) return dependencies;

  const db = prisma || getPrismaClient();
  const repository = dependencies.photoVerificationRepository || new PrismaPhotoVerificationRepository(db);

  dependencies.photoVerificationRepository = repository;
  dependencies.photoVerificationAdminService = dependencies.photoVerificationAdminService || new PhotoVerificationAdminService({ repository });
  dependencies.photoPublicationReadModel = dependencies.photoPublicationReadModel || new PhotoPublicationReadModel({ repository });

  return dependencies;
}

module.exports = { attachPhotoVerificationRuntime };
