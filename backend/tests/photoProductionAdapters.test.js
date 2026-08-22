const test = require('node:test');
const assert = require('node:assert/strict');
const { CrmPhotoNotifier } = require('../src/modules/photo_verification/CrmPhotoNotifier');
const { SharpImageDecoder } = require('../src/modules/photo_verification/SharpImageDecoder');
const { TelegramPhotoPublisher } = require('../src/modules/photo_verification/TelegramPhotoPublisher');
const { MaxPhotoPublisher } = require('../src/modules/photo_verification/MaxPhotoPublisher');
const { VkPhotoPublisher } = require('../src/modules/photo_verification/VkPhotoPublisher');
const { OpenAIVisionProvider } = require('../src/modules/photo_verification/OpenAIVisionProvider');

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, async text() { return JSON.stringify(body); }, async json() { return body; } };
}

test('CrmPhotoNotifier queues safe customer status with idempotency', async () => {
  const calls = [];
  const notifier = new CrmPhotoNotifier({ crmRuntime: { queueNotification: async (...args) => { calls.push(args); return { id: 'delivery-1' }; } } });
  const result = await notifier.notify({ customerId: 'c1', photoChallengeId: 'p1', status: 'approved', message: 'Одобрено', correlationId: 'corr1' });
  assert.equal(result.queued, true);
  assert.equal(calls[0][0], 'c1');
  assert.equal(calls[0][2].idempotencyKey, 'photo:p1:approved:customer');
});

test('SharpImageDecoder converts raw luminance output into matrix using injected sharp factory', async () => {
  const data = Buffer.from([1, 2, 3, 4]);
  const pipeline = { rotate(){ return this; }, resize(){ return this; }, greyscale(){ return this; }, removeAlpha(){ return this; }, raw(){ return this; }, async toBuffer(){ return { data, info: { width: 2, height: 2, channels: 1 } }; } };
  const decoder = new SharpImageDecoder({ sharpFactory: () => pipeline });
  assert.deepEqual(await decoder.toLuminanceMatrix(Buffer.from('x'), { width: 2, height: 2 }), [[1,2],[3,4]]);
});

test('Telegram publisher uploads photo and returns public post URL', async () => {
  const publisher = new TelegramPhotoPublisher({ botToken: 'secret', fetchImpl: async () => jsonResponse({ ok: true, result: { message_id: 42, date: 1 } }) });
  const result = await publisher.publish({ targetId: '@ice_robo_club', media: Buffer.from('photo'), caption: 'test' });
  assert.equal(result.externalPublicationId, '42');
  assert.equal(result.publicationUrl, 'https://t.me/ice_robo_club/42');
});

test('MAX publisher follows upload then message flow', async () => {
  const calls = [];
  const responses = [jsonResponse({ url: 'https://upload.example/image' }), jsonResponse({ token: 'image-token' }), jsonResponse({ message: { body: { mid: 'm1' }, url: 'https://max.ru/post/m1', timestamp: 1 } })];
  const publisher = new MaxPhotoPublisher({ accessToken: 'secret', fetchImpl: async (url, options) => { calls.push({ url, options }); return responses.shift(); } });
  const result = await publisher.publish({ targetId: '123', media: Buffer.from('photo'), caption: 'test' });
  assert.equal(result.externalPublicationId, 'm1');
  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /uploads\?type=image/);
  assert.match(calls[2].url, /messages\?chat_id=123/);
});

test('VK publisher follows upload/save/post flow', async () => {
  const responses = [
    jsonResponse({ response: { upload_url: 'https://upload.vk.test' } }),
    jsonResponse({ server: 1, photo: 'payload', hash: 'hash' }),
    jsonResponse({ response: [{ owner_id: -239119350, id: 9 }] }),
    jsonResponse({ response: { post_id: 77 } }),
  ];
  const publisher = new VkPhotoPublisher({ accessToken: 'secret', fetchImpl: async () => responses.shift() });
  const result = await publisher.publish({ targetId: 'club239119350', media: Buffer.from('photo'), caption: 'test' });
  assert.equal(result.externalPublicationId, '77');
  assert.equal(result.publicationUrl, 'https://vk.com/wall-239119350_77');
});

test('OpenAI provider sends image and parses strict verification JSON', async () => {
  let requestBody;
  const fetchImpl = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok: true, status: 200, async json() { return { model: 'vision-model', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ decision: 'approved', confidence: 0.96, fraudScore: 0.1, reasonCode: 'challenge_completed', checks: { challengeRelevant: true, requiredSubjectsPresent: true, imageQualityAcceptable: true, screenshotSuspected: false, unsafeContent: false } }) }] }] }; } };
  };
  const provider = new OpenAIVisionProvider({ apiKey: 'secret', model: 'vision-model', fetchImpl, mediaLoader: async () => ({ buffer: Buffer.from('image'), mimeType: 'image/jpeg' }) });
  const result = await provider.analyze({ storageKey: 'a.jpg', rules: {}, metadata: {}, antifraud: {} });
  assert.equal(result.decision, 'approved');
  assert.equal(result.confidence, 0.96);
  assert.equal(requestBody.store, false);
  assert.match(requestBody.input[0].content[1].image_url, /^data:image\/jpeg;base64,/);
  assert.equal(requestBody.text.format.type, 'json_schema');
});
