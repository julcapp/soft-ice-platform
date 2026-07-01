import { CatalogRepository } from './CatalogRepository.js';

export class CatalogService {
  constructor(repository = new CatalogRepository()) {
    this.repository = repository;
  }

  getProducts() {
    return this.repository.getProducts();
  }

  getProductById(productId) {
    return this.repository.getProductById(productId);
  }

  getFlavors() {
    return this.repository.getFlavors();
  }

  getFlavorById(flavorId) {
    return this.repository.getFlavorById(flavorId);
  }

  getSyrups() {
    return this.repository.getSyrups();
  }

  getSyrupById(syrupId) {
    return this.repository.getSyrupById(syrupId);
  }

  getToppings() {
    return this.repository.getToppings();
  }

  getToppingById(toppingId) {
    return this.repository.getToppingById(toppingId);
  }

  isFlavorAvailable(productId, flavorId) {
    const product = this.repository.getProductById(productId);
    const flavor = this.repository.getFlavorById(flavorId);

    return Boolean(product && flavor && product.defaultFlavor === flavorId);
  }

  isSyrupAllowed(productId, syrupId) {
    const product = this.repository.getProductById(productId);
    const syrup = this.repository.getSyrupById(syrupId);

    return Boolean(product && syrup && product.allowedSyrups.includes(syrupId));
  }

  isToppingAllowed(productId, toppingId) {
    const product = this.repository.getProductById(productId);
    const topping = this.repository.getToppingById(toppingId);

    return Boolean(
      product && topping && product.allowedToppings.includes(toppingId),
    );
  }
}
