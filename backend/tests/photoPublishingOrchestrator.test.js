const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PhotoPublishingOrchestrator,
  PUBLICATION_STATUSES,
} = require('../src/modules/photo_verification/PhotoPublishingOrchestrator');

function repositoryDouble() {
  return {
    attempts: [],
    events: [],
    async upsertPublicationAttempt(input) { this.attempts.push(input); },
    async recordEvent(input) { this.events.push(input); },
  };
}

test('publishes to all configured required channels independently', async () => {
  const repository = repositoryDouble();
  const publisher = {
    async publish({ targetId }) {
      return {
        externalPublicationId: `post-${targetId}`,
        publicationUrl: `https://example.test/${targetId}`,
      };
    },
  };
  const orchestrator = new PhotoPublishingOrchestrator({
    repository,
    publishers: { VK: publisher, TELEGRAM: publisher, MAX: publisher },
    targets: {
      VK: { channel: 'VK', targetId: 'club239119350', required: true },
      TELEGRAM: { channel: 'TELEGRAM', targetId: 'tg-channel', required: true },
      MAX: { channel: 'MAX', targetId: 'max-channel', required: true },
    },
  });

  const result = await orchestrator.publishAll({
    photoChallengeId: 'challenge-1',
    media: { objectKey: 'ugc/photo-1.jpg' },
    caption: 'test',
    correlationId: 'corr-1',
  });

  assert.equal(result.allRequiredPublished, true);
  assert.equal(result.results.length, 3);
  assert.equal(repository.attempts.length, 3);
  assert.equal(repository.events.at(-1).eventType, 'publication_batch_completed');
});

test('missing Telegram/MAX configuration does not fake success', async () => {
  const repository = repositoryDouble();
  const orchestrator = new PhotoPublishingOrchestrator({
    repository,
    publishers: {
      VK: {
        async publish() {
          return { externalPublicationId: 'vk-1' };
        },
      },
    },
    targets: {
      VK: { channel: 'VK', targetId: 'club239119350', required: true },
      TELEGRAM: { channel: 'TELEGRAM', targetId: null, required: true },
      MAX: { channel: 'MAX', targetId: null, required: true },
    },
  });

  const result = await orchestrator.publishAll({
    photoChallengeId: 'challenge-2',
    media: { objectKey: 'ugc/photo-2.jpg' },
  });

  assert.equal(result.allRequiredPublished, false);
  assert.equal(result.anyPublished, true);
  assert.equal(result.results.find((item) => item.channel === 'TELEGRAM').status, PUBLICATION_STATUSES.NOT_CONFIGURED);
  assert.equal(result.results.find((item) => item.channel === 'MAX').status, PUBLICATION_STATUSES.NOT_CONFIGURED);
});

test('one channel failure does not roll back successful channels', async () => {
  const repository = repositoryDouble();
  const successPublisher = { async publish() { return { externalPublicationId: 'ok' }; } };
  const failedPublisher = { async publish() { const error = new Error('temporary failure'); error.code = 'TEMP'; throw error; } };
  const orchestrator = new PhotoPublishingOrchestrator({
    repository,
    publishers: { VK: successPublisher, TELEGRAM: failedPublisher, MAX: successPublisher },
    targets: {
      VK: { channel: 'VK', targetId: 'club239119350', required: true },
      TELEGRAM: { channel: 'TELEGRAM', targetId: 'tg-channel', required: true },
      MAX: { channel: 'MAX', targetId: 'max-channel', required: true },
    },
  });

  const result = await orchestrator.publishAll({ photoChallengeId: 'challenge-3', media: { objectKey: 'ugc/photo-3.jpg' } });

  assert.equal(result.allRequiredPublished, false);
  assert.equal(result.results.find((item) => item.channel === 'VK').status, PUBLICATION_STATUSES.PUBLISHED);
  assert.equal(result.results.find((item) => item.channel === 'TELEGRAM').status, PUBLICATION_STATUSES.FAILED);
  assert.equal(result.results.find((item) => item.channel === 'MAX').status, PUBLICATION_STATUSES.PUBLISHED);
});
