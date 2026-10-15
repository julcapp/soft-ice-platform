function loadSharp() {
  try {
    return require('sharp');
  } catch (error) {
    const wrapped = new Error('Production image decoding requires the optional sharp package.');
    wrapped.code = 'IMAGE_DECODER_SHARP_NOT_INSTALLED';
    wrapped.cause = error;
    throw wrapped;
  }
}

class SharpImageDecoder {
  constructor({ sharpFactory = null } = {}) {
    this.sharpFactory = sharpFactory;
  }

  async toLuminanceMatrix(buffer, { width, height }) {
    if (!Buffer.isBuffer(buffer)) throw new TypeError('buffer must be a Buffer');
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
      throw new TypeError('width and height must be positive integers');
    }

    const sharp = this.sharpFactory || loadSharp();
    const { data, info } = await sharp(buffer, { failOn: 'warning', limitInputPixels: 64_000_000 })
      .rotate()
      .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
      .greyscale()
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (info.width !== width || info.height !== height || info.channels !== 1) {
      const error = new Error('Decoded luminance dimensions do not match requested matrix.');
      error.code = 'IMAGE_DECODER_DIMENSION_MISMATCH';
      throw error;
    }

    const matrix = [];
    for (let y = 0; y < height; y += 1) {
      const row = [];
      for (let x = 0; x < width; x += 1) row.push(data[y * width + x]);
      matrix.push(row);
    }
    return matrix;
  }
}

module.exports = { SharpImageDecoder, loadSharp };
