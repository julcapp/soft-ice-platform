const CHANNELS = ['VK', 'TELEGRAM', 'MAX'];

class PhotoPublicationReadModel {
  constructor({ repository }) {
    if (!repository) throw new Error('repository is required');
    this.repository = repository;
  }

  async listForCustomer(customerId) {
    if (!customerId) throw new Error('customerId is required');
    const rows = await this.repository.listCustomerPhotoHistory(customerId);
    return rows.map((row) => {
      const publications = Object.fromEntries(CHANNELS.map((channel) => [channel, {
        status: 'pending',
        publicationUrl: null,
        publishedAt: null,
      }]));
      for (const publication of row.publications || []) {
        if (publications[publication.channel]) publications[publication.channel] = publication;
      }
      return {
        photoChallengeId: row.photoChallengeId,
        createdAt: row.createdAt,
        moderationStatus: row.moderationStatus,
        publications,
        allRequiredPublished: CHANNELS.every((channel) => publications[channel].status === 'confirmed'),
        sourceFileDeleted: row.sourceFileStatus === 'deleted',
      };
    });
  }
}

module.exports = { PhotoPublicationReadModel, CHANNELS };
