'use strict';

const crypto = require('node:crypto');

class AesGcmValueCodec {
  constructor({ key, keyVersion = 1 } = {}) {
    this.key = decodeKey(key);
    this.keyVersion = keyVersion;
  }

  encrypt(value, associatedData) {
    if (!String(value || '')) throw new Error('Value is required.');
    if (!String(associatedData || '')) throw new Error('Associated data is required.');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(String(associatedData), 'utf8'));
    const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v${this.keyVersion}.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  decrypt(payload, associatedData) {
    const match = String(payload || '').match(/^v(\d+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
    if (!match || Number(match[1]) !== this.keyVersion) throw invalidCiphertext();
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(match[2], 'base64url'));
      decipher.setAAD(Buffer.from(String(associatedData), 'utf8'));
      decipher.setAuthTag(Buffer.from(match[3], 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(match[4], 'base64url')), decipher.final()]).toString('utf8');
    } catch {
      throw invalidCiphertext();
    }
  }
}

function decodeKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('A base64 encryption key is required.');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('Encryption key must decode to exactly 32 bytes.');
  return key;
}

function invalidCiphertext() {
  const error = new Error('Encrypted value cannot be authenticated.');
  error.code = 'ENCRYPTED_VALUE_INVALID';
  return error;
}

module.exports = { AesGcmValueCodec };
