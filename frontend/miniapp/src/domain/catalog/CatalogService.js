import { CatalogRepository } from './CatalogRepository.js';

export class CatalogService {
  constructor(repository = new CatalogRepository()) {
    this.repository = repository;
  }

  listProducts() {
    return this.repository.listProducts();
  }

  getProductById(productId) {
    return this.repository.getProductById(productId);
  }

  listSyrups() {
    return this.repository.listSyrups();
  }

  listToppings() {
    return this.repository.listToppings();
  }
}
