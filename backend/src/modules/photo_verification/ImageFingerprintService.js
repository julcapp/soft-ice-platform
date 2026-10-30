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

function pHashFromLuminance(matrix) {
  const size = 32;
  if (!Array.isArray(matrix) || matrix.length !== size || matrix.some((row) => !Array.isArray(row) || row.length !== size)) {
    throw new Error('pHash requires a 32x32 luminance matrix');
  }

  const lowFrequency = [];
  for (let v = 0; v < 8; v += 1) {
    for (let u = 0; u < 8; u += 1) {
      let sum = 0;
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          sum += matrix[y][x]
            * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size))
            * Math.cos(((2 * y + 1) * v * Math.PI) / (2 * size));
        }
      }
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
      lowFrequency.push((2 / size) * cu * cv * sum);
    }
  }

  const comparisonValues = lowFrequency.slice(1);
  const sorted = [...comparisonValues].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const bits = lowFrequency.map((value, index) => index === 0 ? 0 : (value >= median ? 1 : 0));
  return bitsToHex(bits);
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

    const [matrix32x32, matrix8x9] = await Promise.all([
      this.imageDecoder.toLuminanceMatrix(buffer, { width: 32, height: 32 }),
      this.imageDecoder.toLuminanceMatrix(buffer, { width: 9, height: 8 }),
    ]);
    result.pHash = pHashFromLuminance(matrix32x32);
    result.dHash = dHashFromLuminance(matrix8x9);
    result.perceptualAvailable = true;
    return result;
  }
}

module.exports = {
  ImageFingerprintService,
  sha256,
  pHashFromLuminance,
  dHashFromLuminance,
  hammingDistance,
};
