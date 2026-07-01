import { NotImplementedError } from '../../shared/errors/index.js';

export class CatalogRepository {
  async listProducts() {
    throw new NotImplementedError();
  }

  async getProductById(productId) {
    throw new NotImplementedError();
  }

  async listSyrups() {
    throw new NotImplementedError();
  }

  async listToppings() {
    throw new NotImplementedError();
  }
}
