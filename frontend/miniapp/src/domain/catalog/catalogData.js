import { createFlavorEntity } from '../flavor/index.js';
import { createProductEntity } from '../product/index.js';
import { createSyrupEntity } from '../syrup/index.js';
import { createToppingEntity } from '../topping/index.js';

const catalogData = {
  products: [
    createProductEntity({
      id: 'product_soft_ice_vanilla_cup',
      name: {
        ru: 'Ванильное мягкое мороженое',
      },
      category: 'soft_ice',
      status: 'active',
      defaultFlavor: 'flavor_vanilla',
      allowedSyrups: [
        'syrup_strawberry',
        'syrup_chocolate',
        'syrup_caramel',
      ],
      allowedToppings: [
        'topping_oreo',
        'topping_rainbow_sprinkles',
        'topping_chocolate_chips',
      ],
      recipeId: 'recipe_soft_ice_vanilla_cup',
      mediaId: 'media_soft_ice_vanilla_cup',
    }),
  ],
  flavors: [
    createFlavorEntity({
      id: 'flavor_vanilla',
      name: {
        ru: 'Ваниль',
      },
    }),
  ],
  syrups: [
    createSyrupEntity({
      id: 'syrup_strawberry',
      name: {
        ru: 'Клубника',
      },
    }),
    createSyrupEntity({
      id: 'syrup_chocolate',
      name: {
        ru: 'Шоколад',
      },
    }),
    createSyrupEntity({
      id: 'syrup_caramel',
      name: {
        ru: 'Карамель',
      },
    }),
  ],
  toppings: [
    createToppingEntity({
      id: 'topping_oreo',
      name: {
        ru: 'Oreo',
      },
    }),
    createToppingEntity({
      id: 'topping_rainbow_sprinkles',
      name: {
        ru: 'Радужная посыпка',
      },
    }),
    createToppingEntity({
      id: 'topping_chocolate_chips',
      name: {
        ru: 'Шоколадная крошка',
      },
    }),
  ],
};

export default catalogData;
