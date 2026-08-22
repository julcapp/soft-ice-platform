const test = require('node:test');
const assert = require('node:assert/strict');
const { PhotoVerificationAdminService } = require('../src/modules/photo_verification/PhotoVerificationAdminService');
const { PhotoPublicationReadModel } = require('../src/modules/photo_verification/PhotoPublicationReadModel');

test('admin settings deny non-admin roles', async () => {
  const service = new PhotoVerificationAdminService({ repository: { getSettings: async () => ({}) } });
  await assert.rejects(
    () => service.getSettings({ roles: ['USER'] }),
    (error) => error.code === 'PHOTO_VERIFICATION_ADMIN_PERMISSION_DENIED' && error.statusCode === 403,
  );
});

test('admin can update settings without enabling financial mechanics', async () => {
  const calls = [];
  const service = new PhotoVerificationAdminService({
    repository: {
      upsertSettings: async (input) => { calls.push(input); return input; },
    },
  });
  const result = await service.updateSettings(
    { roles: ['ADMIN'], userId: 'admin-1' },
    { enabled: true, mode: 'ai_assisted', publishingEnabled: true },
  );
  assert.equal(result.enabled, true);
  assert.equal(result.mode, 'ai_assisted');
  assert.equal(calls[0].updatedBy, 'admin-1');
  assert.equal(Object.hasOwn(result, 'discountPercent'), false);
  assert.equal(Object.hasOwn(result, 'bonusPercent'), false);
});

test('customer read model exposes independent VK Telegram MAX statuses', async () => {
  const readModel = new PhotoPublicationReadModel({
    repository: {
      getSettings: async () => ({ requiredChannels: ['VK', 'TELEGRAM', 'MAX'] }),
      listCustomerPhotoHistory: async () => [{
        photoChallengeId: 'photo-1',
        createdAt: new Date('2026-08-22T12:00:00Z'),
        moderationStatus: 'approved',
        sourceFileStatus: 'deleted',
        publications: [
          { channel: 'VK', status: 'published', publicationUrl: 'https://vk.example/post', publishedAt: new Date() },
          { channel: 'TELEGRAM', status: 'published', publicationUrl: 'https://t.me/ice_robo_club/1', publishedAt: new Date() },
          { channel: 'MAX', status: 'failed', publicationUrl: null, publishedAt: null },
        ],
      }],
    },
  });
  const [item] = await readModel.listForCustomer('customer-1');
  assert.equal(item.publications.VK.status, 'published');
  assert.equal(item.publications.TELEGRAM.status, 'published');
  assert.equal(item.publications.MAX.status, 'failed');
  assert.deepEqual(item.requiredChannels, ['VK', 'TELEGRAM', 'MAX']);
  assert.equal(item.allRequiredPublished, false);
  assert.equal(item.sourceFileDeleted, true);
});

test('customer read model accepts published and confirmed as complete publication evidence', async () => {
  const readModel = new PhotoPublicationReadModel({
    repository: {
      getSettings: async () => ({ requiredChannels: ['VK', 'TELEGRAM', 'MAX'] }),
      listCustomerPhotoHistory: async () => [{
        photoChallengeId: 'photo-2', createdAt: new Date(), moderationStatus: 'approved', sourceFileStatus: 'stored',
        publications: [
          { channel: 'VK', status: 'published', publicationUrl: null, publishedAt: new Date() },
          { channel: 'TELEGRAM', status: 'confirmed', publicationUrl: null, publishedAt: new Date() },
          { channel: 'MAX', status: 'published', publicationUrl: null, publishedAt: new Date() },
        ],
      }],
    },
  });
  const [item] = await readModel.listForCustomer('customer-1');
  assert.equal(item.allRequiredPublished, true);
});

test('customer read model uses configured required channels instead of hard-coded three-channel completion', async () => {
  const readModel = new PhotoPublicationReadModel({
    repository: {
      getSettings: async () => ({ requiredChannels: ['VK', 'TELEGRAM'] }),
      listCustomerPhotoHistory: async () => [{
        photoChallengeId: 'photo-3', createdAt: new Date(), moderationStatus: 'approved', sourceFileStatus: 'stored',
        publications: [
          { channel: 'VK', status: 'published', publicationUrl: null, publishedAt: new Date() },
          { channel: 'TELEGRAM', status: 'published', publicationUrl: null, publishedAt: new Date() },
          { channel: 'MAX', status: 'failed', publicationUrl: null, publishedAt: null },
        ],
      }],
    },
  });
  const [item] = await readModel.listForCustomer('customer-1');
  assert.deepEqual(item.requiredChannels, ['VK', 'TELEGRAM']);
  assert.equal(item.allRequiredPublished, true);
});
