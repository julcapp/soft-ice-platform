const test = require('node:test');
const assert = require('node:assert/strict');

const { PhotoModerationLifecycle } = require('../src/modules/photo_verification/PhotoModerationLifecycle');
const { PHOTO_SUBMISSION_STATUSES } = require('../src/modules/photo_verification/constants');

function fakeRepository() {
  const calls = [];
  return {
    calls,
    async recordVerification(input) { calls.push(['recordVerification', input]); },
    async recordEvent(input) { calls.push(['recordEvent', input]); },
    async recordPublication(input) { calls.push(['recordPublication', input]); },
    async markSourceDeletion(input) { calls.push(['markSourceDeletion', input]); },
  };
}

test('confirmed publication is recorded before reward stage', async () => {
  const repository = fakeRepository();
  const lifecycle = new PhotoModerationLifecycle({ repository });

  const status = await lifecycle.confirmPublication({
    photoChallengeId: 'pc-1',
    channel: 'VK',
    externalPublicationId: 'post-10',
    publicationUrl: 'https://example.invalid/post-10',
    correlationId: 'corr-1',
  });

  assert.equal(status, PHOTO_SUBMISSION_STATUSES.PUBLISHED);
  assert.equal(repository.calls[0][0], 'recordPublication');
  assert.equal(repository.calls[0][1].status, 'confirmed');
  assert.equal(repository.calls[1][1].eventType, 'publication_confirmed');
});

test('source photo cannot be deleted before publication confirmation', async () => {
  const repository = fakeRepository();
  const lifecycle = new PhotoModerationLifecycle({ repository });

  await assert.rejects(
    lifecycle.recordSourceDeletion({
      photoChallengeId: 'pc-2',
      storageKey: 'ugc/pc-2.jpg',
      publicationConfirmed: false,
    }),
    /requires confirmed publication/,
  );

  assert.equal(repository.calls.length, 0);
});

test('source deletion writes deletion evidence after confirmed publication', async () => {
  const repository = fakeRepository();
  const lifecycle = new PhotoModerationLifecycle({ repository });

  const status = await lifecycle.recordSourceDeletion({
    photoChallengeId: 'pc-3',
    storageKey: 'ugc/pc-3.jpg',
    publicationConfirmed: true,
    correlationId: 'corr-3',
  });

  assert.equal(status, PHOTO_SUBMISSION_STATUSES.SOURCE_FILE_DELETED);
  assert.equal(repository.calls[0][0], 'markSourceDeletion');
  assert.equal(repository.calls[0][1].status, 'deleted');
  assert.equal(repository.calls[1][1].eventType, 'source_file_deleted');
});
