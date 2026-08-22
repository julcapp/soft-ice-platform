const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

class LocalPhotoStorageAdapter {
  constructor({ rootDir = process.env.PHOTO_UPLOAD_DIR || path.resolve(process.cwd(), 'var/photo-submissions') } = {}) {
    this.rootDir = rootDir;
  }

  async put({ customerId, photoChallengeId, buffer, mimeType }) {
    const extension = EXTENSIONS[mimeType];
    if (!extension) throw new Error('Unsupported photo MIME type');
    const relativeKey = path.join(String(customerId), String(photoChallengeId), `${crypto.randomUUID()}.${extension}`);
    const absolutePath = path.join(this.rootDir, relativeKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer, { flag: 'wx' });
    return { storageKey: relativeKey.replaceAll(path.sep, '/'), size: buffer.length, mimeType };
  }
}

module.exports = { LocalPhotoStorageAdapter };
