const test = require('node:test');
const assert = require('node:assert/strict');

const { PhotoCustomerWorkflow } = require('../src/modules/photo_verification/PhotoCustomerWorkflow');

function createFixture() {
  const events = [];
  const notifications = [];
  const repository = { recordEvent: async (event) => events.push(event) };
  const notifier = { notify: async (notification) => notifications.push(notification) };
  return { events, notifications, workflow: new PhotoCustomerWorkflow({ repository, notifier }) };
}

test('notifies customer that uploaded photo is under moderation', async () => {
  const { workflow, events, notifications } = createFixture();
  const result = await workflow.recordUploaded({ photoChallengeId: 'p1', customerId: 'c1' });
  assert.equal(result.status, 'moderation');
  assert.equal(events[0].eventType, 'customer_photo_moderation_started');
  assert.equal(notifications[0].status, 'moderation');
});

test('exact duplicate stops before Vision and tells customer it was already uploaded', async () => {
  const { workflow, notifications } = createFixture();
  const result = await workflow.handleDuplicateCheck({
    photoChallengeId: 'p1',
    customerId: 'c1',
    duplicateResult: { duplicate: true, nearDuplicate: false },
  });
  assert.equal(result.stopBeforeVision, true);
  assert.equal(result.status.status, 'duplicate');
  assert.match(notifications[0].message, /уже было загружено/);
});

test('near duplicate routes to additional review before Vision', async () => {
  const { workflow } = createFixture();
  const result = await workflow.handleDuplicateCheck({
    photoChallengeId: 'p1',
    customerId: 'c1',
    duplicateResult: { duplicate: false, nearDuplicate: true },
  });
  assert.equal(result.stopBeforeVision, true);
  assert.equal(result.routeToManualReview, true);
  assert.equal(result.status.status, 'additional_review');
});

test('published status carries channel, URL and publication time for personal cabinet projection', async () => {
  const { workflow, events } = createFixture();
  const publishedAt = new Date('2026-08-22T12:00:00Z');
  const result = await workflow.recordPublished({
    photoChallengeId: 'p1',
    customerId: 'c1',
    channel: 'VK',
    publicationUrl: 'https://example.test/post/1',
    publishedAt,
  });
  assert.equal(result.status, 'published');
  assert.equal(result.channel, 'VK');
  assert.equal(result.publicationUrl, 'https://example.test/post/1');
  assert.equal(events[0].eventType, 'customer_photo_published');
});
