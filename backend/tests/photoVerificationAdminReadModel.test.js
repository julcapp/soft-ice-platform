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
      listCustomerPhotoHistory: async () => [{
        photoChallengeId: 'photo-1',
        createdAt: new Date('2026-08-22T12:00:00Z'),
        moderationStatus: 'approved',
        sourceFileStatus: 'deleted',
        publications: [
          { channel: 'VK', status: 'confirmed', publicationUrl: 'https://vk.example/post', publishedAt: new Date() },
          { channel: 'TELEGRAM', status: 'confirmed', publicationUrl: 'https://t.me/ice_robo_club/1', publishedAt: new Date() },
          { channel: 'MAX', status: 'failed', publicationUrl: null, publishedAt: null },
        ],
      }],
    },
  });
  const [item] = await readModel.listForCustomer('customer-1');
  assert.equal(item.publications.VK.status, 'confirmed');
  assert.equal(item.publications.TELEGRAM.status, 'confirmed');
  assert.equal(item.publications.MAX.status, 'failed');
  assert.equal(item.allRequiredPublished, false);
  assert.equal(item.sourceFileDeleted, true);
});

test('customer read model marks workflow complete only when all required channels confirmed', async () => {
  const readModel = new PhotoPublicationReadModel({
    repository: {
      listCustomerPhotoHistory: async () => [{
        photoChallengeId: 'photo-2', createdAt: new Date(), moderationStatus: 'approved', sourceFileStatus: 'stored',
        publications: ['VK', 'TELEGRAM', 'MAX'].map((channel) => ({ channel, status: 'confirmed', publicationUrl: null, publishedAt: new Date() })),
      }],
    },
  });
  const [item] = await readModel.listForCustomer('customer-1');
  assert.equal(item.allRequiredPublished, true);
});
