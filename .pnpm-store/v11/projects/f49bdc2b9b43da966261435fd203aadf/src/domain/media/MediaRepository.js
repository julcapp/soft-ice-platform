import { NotImplementedError } from '../../shared/errors/index.js';

export class MediaRepository {
  async listMediaAssets() {
    throw new NotImplementedError();
  }

  async getMediaAssetById(mediaAssetId) {
    throw new NotImplementedError();
  }

  async findProductImage(configuration) {
    throw new NotImplementedError();
  }
}
