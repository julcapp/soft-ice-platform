const test = require('node:test');
const assert = require('node:assert/strict');
const { ServiceSpecialistDirectoryService, specialistCard } = require('../src/modules/admin_dashboard/ServiceSpecialistDirectoryService');

test('specialist card exposes contact details and channel identities', () => {
  const card = specialistCard({
    memberId: 'm1', platformUserId: 'u1', fullName: 'Иван Петров', position: 'Техник-мастер', phone: '+79990000000', email: 'ivan@example.test', status: 'ACTIVE', telegramId: 'tg-1', telegramUsername: 'ivan_master', vkProfile: 'https://vk.com/id1',
  }, [
    { channelType: 'MAX', externalUserId: 'max-1', username: 'ivan-max', isVerified: true, status: 'ACTIVE' },
  ]);
  assert.equal(card.fullName, 'Иван Петров');
  assert.equal(card.phone, '+79990000000');
  assert.equal(card.email, 'ivan@example.test');
  assert.equal(card.channels.telegram.userId, 'tg-1');
  assert.equal(card.channels.telegram.username, 'ivan_master');
  assert.equal(card.channels.max.userId, 'max-1');
  assert.equal(card.channels.max.verified, true);
  assert.equal(card.channels.vk.profileUrl, 'https://vk.com/id1');
});

test('directory resolves organization member from platform subject', async () => {
  let call = 0;
  const prisma = { $queryRawUnsafe: async () => {
    call += 1;
    if (call === 1) return [{ id: 'm1' }];
    if (call === 2) return [{ memberId: 'm1', platformUserId: 'u1', fullName: 'Иван Петров', position: 'Техник-мастер', phone: '+79990000000', email: 'ivan@example.test', status: 'ACTIVE', telegramId: 'tg1' }];
    return [{ channelType: 'TELEGRAM', externalUserId: 'tg1', username: 'master', isVerified: true, status: 'ACTIVE' }];
  } };
  const card = await new ServiceSpecialistDirectoryService({ prisma }).getBySubject('u1');
  assert.equal(card.memberId, 'm1');
  assert.equal(card.platformUserId, 'u1');
  assert.equal(card.channels.telegram.username, 'master');
});
