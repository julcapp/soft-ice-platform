import catalogData from './catalogData.js';
import { createFlavorEntity } from '../flavor/index.js';
import { createProductEntity } from '../product/index.js';
import { createSyrupEntity } from '../syrup/index.js';
import { createToppingEntity } from '../topping/index.js';

export class CatalogRepository {
  getProducts() {
    return catalogData.products.map((product) => createProductEntity(product));
  }

  getProductById(productId) {
    const product = catalogData.products.find(
      (catalogProduct) => catalogProduct.id === productId,
    );

    return product ? createProductEntity(product) : null;
  }

  getFlavors() {
    return catalogData.flavors.map((flavor) => createFlavorEntity(flavor));
  }

  getFlavorById(flavorId) {
    const flavor = catalogData.flavors.find(
      (catalogFlavor) => catalogFlavor.id === flavorId,
    );

    return flavor ? createFlavorEntity(flavor) : null;
  }

  getSyrups() {
    return catalogData.syrups.map((syrup) => createSyrupEntity(syrup));
  }

  getSyrupById(syrupId) {
    const syrup = catalogData.syrups.find(
      (catalogSyrup) => catalogSyrup.id === syrupId,
    );

    return syrup ? createSyrupEntity(syrup) : null;
  }

  getToppings() {
    return catalogData.toppings.map((topping) => createToppingEntity(topping));
  }

  getToppingById(toppingId) {
    const topping = catalogData.toppings.find(
      (catalogTopping) => catalogTopping.id === toppingId,
    );

    return topping ? createToppingEntity(topping) : null;
  }
}
