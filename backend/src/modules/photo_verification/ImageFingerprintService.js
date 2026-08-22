const crypto = require('node:crypto');

function sha256(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('buffer must be a Buffer');
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function bitsToHex(bits) {
  let output = '';
  for (let i = 0; i < bits.length; i += 4) {
    let value = 0;
    for (let j = 0; j < 4; j += 1) value = (value << 1) | (bits[i + j] || 0);
    output += value.toString(16);
  }
  return output;
}

function dHashFromLuminance(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 8 || matrix.some((row) => !Array.isArray(row) || row.length !== 9)) {
    throw new Error('dHash requires an 8x9 luminance matrix');
  }
  const bits = [];
  for (const row of matrix) {
    for (let x = 0; x < 8; x += 1) bits.push(row[x] > row[x + 1] ? 1 : 0);
  }
  return bitsToHex(bits);
}

function aHashFromLuminance(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 8 || matrix.some((row) => !Array.isArray(row) || row.length !== 8)) {
    throw new Error('aHash requires an 8x8 luminance matrix');
  }
  const values = matrix.flat();
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return bitsToHex(values.map((value) => value >= average ? 1 : 0));
}

function hexToBits(value) {
  return value.toLowerCase().split('').flatMap((char) => {
    const numeric = Number.parseInt(char, 16);
    if (Number.isNaN(numeric)) throw new Error('Invalid hexadecimal hash');
    return [3, 2, 1, 0].map((shift) => (numeric >> shift) & 1);
  });
}

function hammingDistance(left, right) {
  if (!left || !right || left.length !== right.length) return null;
  const leftBits = hexToBits(left);
  const rightBits = hexToBits(right);
  return leftBits.reduce((distance, bit, index) => distance + (bit === rightBits[index] ? 0 : 1), 0);
}

class ImageFingerprintService {
  constructor({ imageDecoder = null } = {}) {
    this.imageDecoder = imageDecoder;
  }

  async fingerprint(buffer) {
    const result = { sha256: sha256(buffer), pHash: null, dHash: null, perceptualAvailable: false };
    if (!this.imageDecoder) return result;

    const [matrix8x8, matrix8x9] = await Promise.all([
      this.imageDecoder.toLuminanceMatrix(buffer, { width: 8, height: 8 }),
      this.imageDecoder.toLuminanceMatrix(buffer, { width: 9, height: 8 }),
    ]);
    result.pHash = aHashFromLuminance(matrix8x8);
    result.dHash = dHashFromLuminance(matrix8x9);
    result.perceptualAvailable = true;
    return result;
  }
}

module.exports = {
  ImageFingerprintService,
  sha256,
  aHashFromLuminance,
  dHashFromLuminance,
  hammingDistance,
};
