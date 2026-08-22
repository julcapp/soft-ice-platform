const { PhotoVerificationAgent } = require('./PhotoVerificationAgent');
const { MockVisionProvider } = require('./MockVisionProvider');
const { PrismaPhotoVerificationRepository } = require('./PrismaPhotoVerificationRepository');
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
  ],
  PhotoVerificationAgent,
  MockVisionProvider,
  PrismaPhotoVerificationRepository,
  PHOTO_VERIFICATION_MODES,
  PHOTO_VERIFICATION_DECISIONS,
  PHOTO_SUBMISSION_STATUSES,
};
