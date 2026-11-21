function normalizePublisherMedia(media) {
  if (Buffer.isBuffer(media)) return { buffer: media, contentType: 'image/jpeg', filename: 'photo.jpg' };
  if (!media || !Buffer.isBuffer(media.buffer)) {
    const error = new TypeError('Publisher media must be a Buffer or { buffer, contentType, filename }.');
    error.code = 'INVALID_PUBLISHER_MEDIA';
    throw error;
  }
  return {
    buffer: media.buffer,
    contentType: media.contentType || 'image/jpeg',
    filename: media.filename || filenameFor(media.contentType),
  };
}

function filenameFor(contentType = '') {
  if (contentType === 'image/png') return 'photo.png';
  if (contentType === 'image/webp') return 'photo.webp';
  return 'photo.jpg';
}

function toBlob(media) {
  const normalized = normalizePublisherMedia(media);
  return { ...normalized, blob: new Blob([normalized.buffer], { type: normalized.contentType }) };
}

async function readJsonResponse(response, code = 'PROVIDER_HTTP_ERROR') {
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!response.ok) {
    const error = new Error(body?.error?.error_msg || body?.error?.message || body?.message || `Provider HTTP ${response.status}`);
    error.code = body?.error?.error_code ? `${code}_${body.error.error_code}` : code;
    error.status = response.status;
    throw error;
  }
  return body;
}

module.exports = { normalizePublisherMedia, toBlob, readJsonResponse };
