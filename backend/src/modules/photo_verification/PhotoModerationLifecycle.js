const { PHOTO_SUBMISSION_STATUSES } = require('./constants');

class PhotoModerationLifecycle {
  constructor({ repository }) {
    if (!repository) throw new Error('Photo verification repository is required');
    this.repository = repository;
  }

  async recordModerationResult({ photoChallengeId, result, correlationId }) {
    await this.repository.recordVerification({
      photoChallengeId,
      ...result,
    });

    await this.repository.recordEvent({
      photoChallengeId,
      eventType: 'moderation_completed',
      eventSource: 'photo_verification_agent',
      correlationId,
      payload: {
        decision: result.decision,
        confidence: result.confidence ?? null,
        fraudScore: result.fraudScore ?? null,
      },
    });

    return result.decision;
  }

  async confirmPublication({ photoChallengeId, channel, externalPublicationId, publicationUrl, publishedAt, correlationId }) {
    const confirmedAt = new Date();

    await this.repository.recordPublication({
      photoChallengeId,
      channel,
      status: 'confirmed',
      externalPublicationId,
      publicationUrl,
      publishedAt: publishedAt || confirmedAt,
      confirmedAt,
    });

    await this.repository.recordEvent({
      photoChallengeId,
      eventType: 'publication_confirmed',
      eventSource: 'publishing_service',
      correlationId,
      payload: { channel, externalPublicationId: externalPublicationId || null, publicationUrl: publicationUrl || null },
    });

    return PHOTO_SUBMISSION_STATUSES.PUBLISHED;
  }

  async recordSourceDeletion({ photoChallengeId, storageKey, publicationConfirmed, deletedAt, correlationId }) {
    if (!publicationConfirmed) {
      throw new Error('Source photo deletion requires confirmed publication');
    }

    const effectiveDeletedAt = deletedAt || new Date();

    await this.repository.markSourceDeletion({
      photoChallengeId,
      storageKey,
      status: 'deleted',
      deleteReason: 'publication_confirmed',
      requestedAt: effectiveDeletedAt,
      deletedAt: effectiveDeletedAt,
    });

    await this.repository.recordEvent({
      photoChallengeId,
      eventType: 'source_file_deleted',
      eventSource: 'media_retention_service',
      correlationId,
      payload: { storageKey, deleteReason: 'publication_confirmed' },
    });

    return PHOTO_SUBMISSION_STATUSES.SOURCE_FILE_DELETED;
  }
}

module.exports = { PhotoModerationLifecycle };
