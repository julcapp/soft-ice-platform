const EXIF_TAGS = Object.freeze({
  0x010f: 'make',
  0x0110: 'model',
  0x0112: 'orientation',
  0x0131: 'software',
  0x0132: 'modifiedAt',
  0x8769: 'exifIfdOffset',
  0x8825: 'gpsIfdOffset',
  0x9003: 'capturedAt',
  0x9004: 'digitizedAt',
  0x8827: 'iso',
  0x829a: 'exposureTime',
  0x829d: 'fNumber',
  0x920a: 'focalLength',
});

function readAscii(buffer, offset, length) {
  return buffer.subarray(offset, offset + Math.max(0, length - 1)).toString('ascii').replace(/\0+$/, '').trim();
}

function parseExifDate(value) {
  if (!value || !/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return null;
  const normalized = value.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T');
  const parsed = new Date(`${normalized}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function readIfdValue(tiff, entryOffset, littleEndian, tiffBase = 0) {
  const read16 = (offset) => littleEndian ? tiff.readUInt16LE(offset) : tiff.readUInt16BE(offset);
  const read32 = (offset) => littleEndian ? tiff.readUInt32LE(offset) : tiff.readUInt32BE(offset);
  const type = read16(entryOffset + 2);
  const count = read32(entryOffset + 4);
  const typeSize = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }[type] || 1;
  const byteLength = count * typeSize;
  const inlineOffset = entryOffset + 8;
  const valueOffset = byteLength <= 4 ? inlineOffset : tiffBase + read32(inlineOffset);
  if (valueOffset < 0 || valueOffset + byteLength > tiff.length) return null;

  if (type === 2) return readAscii(tiff, valueOffset, count);
  if (type === 3 && count === 1) return read16(valueOffset);
  if (type === 4 && count === 1) return read32(valueOffset);
  if (type === 5 && count === 1) {
    const numerator = read32(valueOffset);
    const denominator = read32(valueOffset + 4);
    return denominator === 0 ? null : numerator / denominator;
  }
  return null;
}

function parseIfd(tiff, ifdOffset, littleEndian, output, visited = new Set()) {
  if (!Number.isInteger(ifdOffset) || ifdOffset < 0 || ifdOffset + 2 > tiff.length || visited.has(ifdOffset)) return;
  visited.add(ifdOffset);
  const read16 = (offset) => littleEndian ? tiff.readUInt16LE(offset) : tiff.readUInt16BE(offset);
  const entries = read16(ifdOffset);
  for (let index = 0; index < entries; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    if (entryOffset + 12 > tiff.length) break;
    const tag = read16(entryOffset);
    const key = EXIF_TAGS[tag];
    if (!key) continue;
    const value = readIfdValue(tiff, entryOffset, littleEndian);
    if (value == null) continue;
    if (key === 'exifIfdOffset' || key === 'gpsIfdOffset') {
      output[key] = value;
      if (key === 'exifIfdOffset') parseIfd(tiff, value, littleEndian, output, visited);
      continue;
    }
    output[key] = value;
  }
}

function extractExifFromJpeg(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if (marker === 0xe1 && length >= 8 && buffer.subarray(offset + 2, offset + 8).toString('ascii') === 'Exif\0\0') {
      const tiff = buffer.subarray(offset + 8, offset + length);
      if (tiff.length < 8) return null;
      const byteOrder = tiff.subarray(0, 2).toString('ascii');
      const littleEndian = byteOrder === 'II';
      if (!littleEndian && byteOrder !== 'MM') return null;
      const read16 = (position) => littleEndian ? tiff.readUInt16LE(position) : tiff.readUInt16BE(position);
      const read32 = (position) => littleEndian ? tiff.readUInt32LE(position) : tiff.readUInt32BE(position);
      if (read16(2) !== 42) return null;
      const output = {};
      parseIfd(tiff, read32(4), littleEndian, output);
      return output;
    }
    offset += length;
  }
  return null;
}

class MetadataAnalyzer {
  analyze({ buffer, mimeType, receivedAt = new Date() }) {
    const exif = mimeType === 'image/jpeg' || mimeType === 'image/jpg' ? extractExifFromJpeg(buffer) : null;
    const capturedAt = parseExifDate(exif?.capturedAt);
    const modifiedAt = parseExifDate(exif?.modifiedAt);
    const software = exif?.software || null;
    const editingSoftwareDetected = Boolean(software && /(photoshop|lightroom|gimp|snapseed|editor|canva)/i.test(software));
    let captureTimeConsistent = null;
    if (capturedAt) {
      const driftMs = Math.abs(new Date(receivedAt).getTime() - new Date(capturedAt).getTime());
      captureTimeConsistent = driftMs <= 7 * 24 * 60 * 60 * 1000;
    }

    return {
      exifPresent: Boolean(exif),
      cameraMake: exif?.make || null,
      cameraModel: exif?.model || null,
      capturedAt,
      modifiedAt,
      orientation: exif?.orientation ?? null,
      iso: exif?.iso ?? null,
      exposureTime: exif?.exposureTime ?? null,
      fNumber: exif?.fNumber ?? null,
      focalLength: exif?.focalLength ?? null,
      gpsPresent: Number.isInteger(exif?.gpsIfdOffset),
      software,
      editingSoftwareDetected,
      captureTimeConsistent,
      metadataRiskSignals: [
        ...(editingSoftwareDetected ? ['editing_software_detected'] : []),
        ...(captureTimeConsistent === false ? ['capture_time_outside_expected_window'] : []),
      ],
    };
  }
}

module.exports = { MetadataAnalyzer, extractExifFromJpeg, parseExifDate };
