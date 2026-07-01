import { MediaRepository } from './MediaRepository.js';

export class MediaService {
  constructor(repository = new MediaRepository()) {
    this.repository = repository;
  }

  listMediaAssets() {
    return this.repository.listMediaAssets();
  }

  getMediaAssetById(mediaAssetId) {
    return this.repository.getMediaAssetById(mediaAssetId);
  }

  findProductImage(configuration) {
    return this.repository.findProductImage(configuration);
  }
}
