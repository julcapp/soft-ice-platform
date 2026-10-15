const PHOTO_VERIFICATION_MODES = Object.freeze({
  DISABLED: 'disabled',
  MANUAL_ONLY: 'manual_only',
  AI_ASSISTED: 'ai_assisted',
});

const PHOTO_VERIFICATION_DECISIONS = Object.freeze({
  APPROVED: 'approved',
  REJECTED: 'rejected',
  MANUAL_REVIEW: 'manual_review',
});

const PHOTO_SUBMISSION_STATUSES = Object.freeze({
  UPLOADED: 'uploaded',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  AI_APPROVED: 'ai_approved',
  AI_REJECTED: 'ai_rejected',
  MANUAL_REVIEW: 'manual_review',
  APPROVED_FINAL: 'approved_final',
  REJECTED_FINAL: 'rejected_final',
  PUBLICATION_PENDING: 'publication_pending',
  PUBLISHED: 'published',
  PUBLICATION_FAILED: 'publication_failed',
  REWARD_PENDING: 'reward_pending',
  REWARD_GRANTED: 'reward_granted',
  REWARD_FAILED: 'reward_failed',
  SOURCE_FILE_DELETED: 'source_file_deleted',
});

module.exports = {
  PHOTO_VERIFICATION_MODES,
  PHOTO_VERIFICATION_DECISIONS,
  PHOTO_SUBMISSION_STATUSES,
};
