const DEFAULT_CHANNELS = Object.freeze(['VK', 'TELEGRAM', 'MAX']);
const COMPLETE_PUBLICATION_STATUSES = new Set(['published', 'confirmed']);

class PhotoPublicationReadModel {
  constructor({ repository }) {
    if (!repository) throw new Error('repository is required');
    this.repository = repository;
  }

  async listForCustomer(customerId) {
    if (!customerId) throw new Error('customerId is required');
    const [rows, settings] = await Promise.all([
      this.repository.listCustomerPhotoHistory(customerId),
      this.repository.getSettings ? this.repository.getSettings('default') : null,
    ]);
    const requiredChannels = normalizeChannels(settings?.requiredChannels, DEFAULT_CHANNELS);
    const displayChannels = [...new Set([...DEFAULT_CHANNELS, ...requiredChannels])];

    return rows.map((row) => {
      const publications = Object.fromEntries(displayChannels.map((channel) => [channel, {
        status: 'pending',
        publicationUrl: null,
        publishedAt: null,
      }]));
      for (const publication of row.publications || []) {
        if (publication?.channel) publications[publication.channel] = publication;
      }
      return {
        photoChallengeId: row.photoChallengeId,
        createdAt: row.createdAt,
        moderationStatus: row.moderationStatus,
        publications,
        requiredChannels,
        allRequiredPublished: requiredChannels.every((channel) => COMPLETE_PUBLICATION_STATUSES.has(publications[channel]?.status)),
        sourceFileDeleted: row.sourceFileStatus === 'deleted',
      };
    });
  }
}

function normalizeChannels(value, fallback = DEFAULT_CHANNELS) {
  let channels = value;
  if (typeof channels === 'string') {
    try { channels = JSON.parse(channels); } catch { channels = null; }
  }
  if (!Array.isArray(channels)) return [...fallback];
  const normalized = channels
    .map((channel) => String(channel || '').trim().toUpperCase())
    .filter(Boolean);
  return normalized.length ? [...new Set(normalized)] : [...fallback];
}

module.exports = { PhotoPublicationReadModel, DEFAULT_CHANNELS, COMPLETE_PUBLICATION_STATUSES, normalizeChannels };
