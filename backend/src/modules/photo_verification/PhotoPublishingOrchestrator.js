const { PHOTO_PUBLISHING_TARGETS } = require('./publishingTargets');

const PUBLICATION_STATUSES = Object.freeze({
  PENDING: 'pending',
  PUBLISHED: 'published',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  NOT_CONFIGURED: 'not_configured',
  SKIPPED: 'skipped',
});

class PhotoPublishingOrchestrator {
  constructor({ publishers = {}, repository, targets = PHOTO_PUBLISHING_TARGETS }) {
    if (!repository) throw new Error('repository is required');
    this.publishers = publishers;
    this.repository = repository;
    this.targets = targets;
  }

  async publishAll({ photoChallengeId, media, caption, correlationId }) {
    const entries = Object.values(this.targets);
    const results = await Promise.all(entries.map((target) => this.#publishTarget({
      photoChallengeId,
      target,
      media,
      caption,
      correlationId,
    })));

    const requiredResults = results.filter((result) => result.required);
    const allRequiredPublished = requiredResults.every((result) => isSuccessful(result.status));
    const anyPublished = results.some((result) => isSuccessful(result.status));

    await this.repository.recordEvent({
      photoChallengeId,
      eventType: 'publication_batch_completed',
      eventSource: 'photo_publishing_orchestrator',
      correlationId,
      payload: {
        allRequiredPublished,
        anyPublished,
        channels: results.map(({ channel, status, required, skipped }) => ({ channel, status, required, skipped: Boolean(skipped) })),
      },
    });

    return { allRequiredPublished, anyPublished, results };
  }

  async #publishTarget({ photoChallengeId, target, media, caption, correlationId }) {
    const existing = await this.repository.getPublicationAttempt?.(photoChallengeId, target.channel);
    if (existing && isSuccessful(existing.status)) {
      return {
        channel: target.channel,
        required: target.required,
        status: existing.status,
        skipped: true,
        externalPublicationId: existing.externalPublicationId || null,
        publicationUrl: existing.publicationUrl || null,
      };
    }

    const publisher = this.publishers[target.channel];
    if (!target.targetId || !publisher) {
      const status = PUBLICATION_STATUSES.NOT_CONFIGURED;
      await this.repository.upsertPublicationAttempt({
        photoChallengeId,
        channel: target.channel,
        targetId: target.targetId || null,
        status,
        errorCode: 'PUBLISHER_NOT_CONFIGURED',
        errorMessage: `Publisher or target is not configured for ${target.channel}`,
      });
      return { channel: target.channel, required: target.required, status };
    }

    try {
      const result = await publisher.publish({
        targetId: target.targetId,
        media,
        caption,
        idempotencyKey: `${photoChallengeId}:${target.channel}`,
      });
      await this.repository.upsertPublicationAttempt({
        photoChallengeId,
        channel: target.channel,
        targetId: target.targetId,
        status: PUBLICATION_STATUSES.PUBLISHED,
        externalPublicationId: result.externalPublicationId,
        publicationUrl: result.publicationUrl || null,
        publishedAt: result.publishedAt || new Date(),
        confirmedAt: result.confirmedAt || new Date(),
        errorCode: null,
        errorMessage: null,
      });
      return {
        channel: target.channel,
        required: target.required,
        status: PUBLICATION_STATUSES.PUBLISHED,
        externalPublicationId: result.externalPublicationId,
        publicationUrl: result.publicationUrl || null,
      };
    } catch (error) {
      await this.repository.upsertPublicationAttempt({
        photoChallengeId,
        channel: target.channel,
        targetId: target.targetId,
        status: PUBLICATION_STATUSES.FAILED,
        errorCode: error.code || 'PUBLISH_FAILED',
        errorMessage: error.message,
      });
      return { channel: target.channel, required: target.required, status: PUBLICATION_STATUSES.FAILED };
    }
  }
}

function isSuccessful(status) {
  return status === PUBLICATION_STATUSES.PUBLISHED || status === PUBLICATION_STATUSES.CONFIRMED;
}

module.exports = { PhotoPublishingOrchestrator, PUBLICATION_STATUSES, isSuccessful };
