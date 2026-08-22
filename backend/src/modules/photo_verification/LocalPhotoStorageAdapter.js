const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MIME_BY_EXTENSION = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

class LocalPhotoStorageAdapter {
  constructor({ rootDir = process.env.PHOTO_UPLOAD_DIR || path.resolve(process.cwd(), 'var/photo-submissions') } = {}) {
    this.rootDir = rootDir;
  }

  async put({ customerId, photoChallengeId, buffer, mimeType }) {
    const extension = EXTENSIONS[mimeType];
    if (!extension) throw new Error('Unsupported photo MIME type');
    const relativeKey = path.join(String(customerId), String(photoChallengeId), `${crypto.randomUUID()}.${extension}`);
    const absolutePath = this.#absolutePath(relativeKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer, { flag: 'wx' });
    return { storageKey: relativeKey.replaceAll(path.sep, '/'), size: buffer.length, mimeType };
  }

  async get(storageKey) {
    const absolutePath = this.#absolutePath(storageKey);
    const buffer = await fs.readFile(absolutePath);
    const mimeType = MIME_BY_EXTENSION[path.extname(absolutePath).toLowerCase()] || 'application/octet-stream';
    return { buffer, mimeType, storageKey };
  }

  #absolutePath(storageKey) {
    const normalized = String(storageKey).replaceAll('\\', '/');
    const absolutePath = path.resolve(this.rootDir, normalized);
    const root = path.resolve(this.rootDir);
    if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
      const error = new Error('Invalid photo storage key.');
      error.code = 'INVALID_PHOTO_STORAGE_KEY';
      throw error;
    }
    return absolutePath;
  }
}

module.exports = { LocalPhotoStorageAdapter };
