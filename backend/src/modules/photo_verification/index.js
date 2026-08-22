const { PhotoVerificationAgent } = require('./PhotoVerificationAgent');
const { MockVisionProvider } = require('./MockVisionProvider');
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
  ],
  PhotoVerificationAgent,
  MockVisionProvider,
  PHOTO_VERIFICATION_MODES,
  PHOTO_VERIFICATION_DECISIONS,
  PHOTO_SUBMISSION_STATUSES,
};
