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
    const absolutePath = this.#resolve(relativeKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer, { flag: 'wx' });
    return { storageKey: relativeKey.replaceAll(path.sep, '/'), size: buffer.length, mimeType };
  }

  async get(storageKey) {
    return fs.readFile(this.#resolve(storageKey));
  }

  async delete(storageKey) {
    const absolutePath = this.#resolve(storageKey);
    try {
      await fs.unlink(absolutePath);
      return { deleted: true, storageKey };
    } catch (error) {
      if (error.code === 'ENOENT') return { deleted: true, storageKey, alreadyMissing: true };
      throw error;
    }
  }

  #resolve(storageKey) {
    const normalized = String(storageKey).replaceAll('\\', '/');
    const absolutePath = path.resolve(this.rootDir, normalized);
    const root = path.resolve(this.rootDir);
    if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
      const error = new Error('Photo storage key escapes configured root');
      error.code = 'PHOTO_STORAGE_INVALID_KEY';
      throw error;
    }
    return absolutePath;
  }
}

module.exports = { LocalPhotoStorageAdapter };
