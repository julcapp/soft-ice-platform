const { PHOTO_PUBLISHING_TARGETS } = require('./publishingTargets');

const PUBLICATION_STATUSES = Object.freeze({
  PENDING: 'pending',
  PUBLISHED: 'published',
  FAILED: 'failed',
  NOT_CONFIGURED: 'not_configured',
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
    const allRequiredPublished = requiredResults.every((result) => result.status === PUBLICATION_STATUSES.PUBLISHED);
    const anyPublished = results.some((result) => result.status === PUBLICATION_STATUSES.PUBLISHED);

    await this.repository.recordEvent({
      photoChallengeId,
      eventType: 'publication_batch_completed',
      eventSource: 'photo_publishing_orchestrator',
      correlationId,
      payload: {
        allRequiredPublished,
        anyPublished,
        channels: results.map(({ channel, status, required }) => ({ channel, status, required })),
      },
    });

    return { allRequiredPublished, anyPublished, results };
  }

  async #publishTarget({ photoChallengeId, target, media, caption, correlationId }) {
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
      return {
        channel: target.channel,
        required: target.required,
        status: PUBLICATION_STATUSES.FAILED,
      };
    }
  }
}

module.exports = { PhotoPublishingOrchestrator, PUBLICATION_STATUSES };
