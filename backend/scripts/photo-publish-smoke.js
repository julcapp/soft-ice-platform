const fs = require('node:fs/promises');
const path = require('node:path');
const {
  TelegramPhotoPublisher,
  VkPhotoPublisher,
  MaxPhotoPublisher,
  PHOTO_PUBLISHING_TARGETS,
} = require('../src/modules/photo_verification');

async function main() {
  if (process.env.PHOTO_PUBLISH_SMOKE_CONFIRM !== 'YES') {
    throw new Error('Refusing to publish. Set PHOTO_PUBLISH_SMOKE_CONFIRM=YES explicitly.');
  }

  const imagePath = process.env.PHOTO_PUBLISH_SMOKE_IMAGE;
  if (!imagePath) throw new Error('PHOTO_PUBLISH_SMOKE_IMAGE is required');

  const missing = [
    ['TELEGRAM_BOT_TOKEN', process.env.TELEGRAM_BOT_TOKEN],
    ['VK_ACCESS_TOKEN', process.env.VK_ACCESS_TOKEN],
    ['MAX_BOT_TOKEN', process.env.MAX_BOT_TOKEN],
    ['MAX_CHANNEL_CHAT_ID', process.env.MAX_CHANNEL_CHAT_ID],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const buffer = await fs.readFile(imagePath);
  if (!buffer.length) throw new Error('Smoke-test image is empty');

  const caption = process.env.PHOTO_PUBLISH_SMOKE_CAPTION || 'Тест публикации Photo Verification — У Тимоши';
  const filename = path.basename(imagePath);
  const mimeType = mimeTypeFromPath(imagePath);
  const media = { buffer, filename, mimeType };

  const targets = {
    VK: PHOTO_PUBLISHING_TARGETS.VK.targetId,
    TELEGRAM: PHOTO_PUBLISHING_TARGETS.TELEGRAM.targetId,
    MAX: process.env.MAX_CHANNEL_CHAT_ID,
  };

  const publishers = {
    VK: new VkPhotoPublisher(),
    TELEGRAM: new TelegramPhotoPublisher(),
    MAX: new MaxPhotoPublisher(),
  };

  console.log('About to publish one smoke-test image to all three public UGC channels.');
  console.log(`VK target: ${targets.VK}`);
  console.log(`Telegram target: ${targets.TELEGRAM}`);
  console.log(`MAX target: ${targets.MAX}`);

  const results = await Promise.all(Object.entries(publishers).map(async ([channel, publisher]) => {
    try {
      const result = await publisher.publish({ targetId: targets[channel], media, caption });
      return { channel, ok: true, ...result };
    } catch (error) {
      return { channel, ok: false, code: error.code || 'PUBLISH_FAILED', message: error.message };
    }
  }));

  for (const result of results) {
    if (result.ok) {
      console.log(`[OK] ${result.channel}: ${result.publicationUrl || result.externalPublicationId}`);
    } else {
      console.error(`[FAIL] ${result.channel}: ${result.code} ${result.message}`);
    }
  }

  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

function mimeTypeFromPath(filePath) {
  const lower = String(filePath).toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
