const { toBlob, readJsonResponse } = require('./publisherMedia');

class VkPhotoPublisher {
  constructor({ accessToken = process.env.VK_ACCESS_TOKEN, apiVersion = process.env.VK_API_VERSION || '5.199', fetchImpl = global.fetch } = {}) {
    this.accessToken = accessToken || null;
    this.apiVersion = apiVersion;
    this.fetch = fetchImpl;
  }

  async publish({ targetId, media, caption = '' }) {
    if (!this.accessToken) throw configuredError('VK_ACCESS_TOKEN_NOT_CONFIGURED');
    if (!targetId) throw configuredError('VK_TARGET_NOT_CONFIGURED');
    const groupId = String(targetId).replace(/^club/, '').replace(/^-/, '');

    const uploadServer = await this.#method('photos.getWallUploadServer', { group_id: groupId });
    if (!uploadServer?.upload_url) throw configuredError('VK_UPLOAD_SERVER_NOT_RETURNED');

    const { blob, filename } = toBlob(media);
    const form = new FormData();
    form.set('photo', blob, filename);
    const uploadResponse = await this.fetch(uploadServer.upload_url, { method: 'POST', body: form });
    const uploaded = await readJsonResponse(uploadResponse, 'VK_UPLOAD_FAILED');

    const saved = await this.#method('photos.saveWallPhoto', {
      group_id: groupId,
      server: uploaded.server,
      photo: uploaded.photo,
      hash: uploaded.hash,
    });
    const photo = Array.isArray(saved) ? saved[0] : null;
    if (!photo?.id || photo.owner_id == null) throw configuredError('VK_SAVE_PHOTO_NOT_CONFIRMED');

    const post = await this.#method('wall.post', {
      owner_id: `-${groupId}`,
      from_group: 1,
      message: caption || '',
      attachments: `photo${photo.owner_id}_${photo.id}`,
    });
    const postId = String(post?.post_id || post?.id || '');
    if (!postId) throw configuredError('VK_WALL_POST_NOT_CONFIRMED');
    return {
      externalPublicationId: postId,
      publicationUrl: `https://vk.com/wall-${groupId}_${postId}`,
      publishedAt: new Date(),
      confirmedAt: new Date(),
    };
  }

  async #method(method, params) {
    const body = new URLSearchParams({ ...stringify(params), access_token: this.accessToken, v: this.apiVersion });
    const response = await this.fetch(`https://api.vk.com/method/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    const payload = await readJsonResponse(response, 'VK_API_FAILED');
    if (payload.error) {
      const error = new Error(payload.error.error_msg || `VK API error ${payload.error.error_code}`);
      error.code = `VK_API_${payload.error.error_code || 'ERROR'}`;
      throw error;
    }
    return payload.response;
  }
}

function stringify(input) { return Object.fromEntries(Object.entries(input).filter(([, value]) => value != null).map(([key, value]) => [key, String(value)])); }
function configuredError(code) { const error = new Error(code); error.code = code; return error; }
module.exports = { VkPhotoPublisher };
