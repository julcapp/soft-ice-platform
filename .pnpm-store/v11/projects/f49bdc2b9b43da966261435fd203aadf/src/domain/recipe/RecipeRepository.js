const defaultRecipeDefinitions = [
  {
    id: 'recipe_soft_ice_vanilla_cup',
    productId: 'product_soft_ice_vanilla_cup',
    status: 'active',
    version: 1,
    allowedFlavorIds: ['flavor_vanilla'],
    allowedSizeIds: ['size_cup_standard'],
    allowedSyrupIds: [
      'syrup_strawberry',
      'syrup_chocolate',
      'syrup_caramel',
    ],
    allowedToppingIds: [
      'topping_oreo',
      'topping_rainbow_sprinkles',
      'topping_chocolate_chips',
    ],
    allowedExtraIds: [],
    ingredients: {
      base: {
        id: 'ingredient_soft_ice_mix_vanilla',
        role: 'base_mix',
        sourceId: 'flavor_vanilla',
        quantity: {
          value: 120,
          unit: 'ml',
        },
      },
      syrups: {
        syrup_strawberry: {
          id: 'ingredient_syrup_strawberry',
          role: 'syrup',
          sourceId: 'syrup_strawberry',
          quantity: {
            value: 15,
            unit: 'ml',
          },
        },
        syrup_chocolate: {
          id: 'ingredient_syrup_chocolate',
          role: 'syrup',
          sourceId: 'syrup_chocolate',
          quantity: {
            value: 15,
            unit: 'ml',
          },
        },
        syrup_caramel: {
          id: 'ingredient_syrup_caramel',
          role: 'syrup',
          sourceId: 'syrup_caramel',
          quantity: {
            value: 15,
            unit: 'ml',
          },
        },
      },
      toppings: {
        topping_oreo: {
          id: 'ingredient_topping_oreo',
          role: 'topping',
          sourceId: 'topping_oreo',
          quantity: {
            value: 8,
            unit: 'g',
          },
        },
        topping_rainbow_sprinkles: {
          id: 'ingredient_topping_rainbow_sprinkles',
          role: 'topping',
          sourceId: 'topping_rainbow_sprinkles',
          quantity: {
            value: 8,
            unit: 'g',
          },
        },
        topping_chocolate_chips: {
          id: 'ingredient_topping_chocolate_chips',
          role: 'topping',
          sourceId: 'topping_chocolate_chips',
          quantity: {
            value: 8,
            unit: 'g',
          },
        },
      },
      extras: {},
    },
  },
];

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

const isPositiveNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const createIdList = (ids) => {
  if (!Array.isArray(ids)) {
    return [];
  }

  return ids.filter((id) => isNonEmptyString(id));
};

const createQuantity = (rawQuantity) => {
  const quantity = isRecord(rawQuantity) ? rawQuantity : {};

  return {
    value: isPositiveNumber(quantity.value) ? quantity.value : 0,
    unit: isNonEmptyString(quantity.unit) ? quantity.unit : '',
  };
};

const createIngredientDefinition = (rawIngredient) => {
  const ingredient = isRecord(rawIngredient) ? rawIngredient : {};

  return {
    id: isNonEmptyString(ingredient.id) ? ingredient.id : '',
    role: isNonEmptyString(ingredient.role) ? ingredient.role : '',
    sourceId: isNonEmptyString(ingredient.sourceId)
      ? ingredient.sourceId
      : '',
    quantity: createQuantity(ingredient.quantity),
  };
};

const createIngredientMap = (rawIngredientMap) => {
  if (!isRecord(rawIngredientMap)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(rawIngredientMap)
      .filter(([ingredientSourceId, ingredient]) =>
        isNonEmptyString(ingredientSourceId) && isRecord(ingredient),
      )
      .map(([ingredientSourceId, ingredient]) => [
        ingredientSourceId,
        createIngredientDefinition(ingredient),
      ]),
  );
};

const createRecipeDefinition = (rawRecipeDefinition) => {
  const recipeDefinition = isRecord(rawRecipeDefinition)
    ? rawRecipeDefinition
    : {};
  const ingredients = isRecord(recipeDefinition.ingredients)
    ? recipeDefinition.ingredients
    : {};

  return {
    id: isNonEmptyString(recipeDefinition.id) ? recipeDefinition.id : '',
    productId: isNonEmptyString(recipeDefinition.productId)
      ? recipeDefinition.productId
      : '',
    status: isNonEmptyString(recipeDefinition.status)
      ? recipeDefinition.status
      : '',
    version:
      Number.isInteger(recipeDefinition.version) &&
      recipeDefinition.version > 0
        ? recipeDefinition.version
        : 1,
    allowedFlavorIds: createIdList(recipeDefinition.allowedFlavorIds),
    allowedSizeIds: createIdList(recipeDefinition.allowedSizeIds),
    allowedSyrupIds: createIdList(recipeDefinition.allowedSyrupIds),
    allowedToppingIds: createIdList(recipeDefinition.allowedToppingIds),
    allowedExtraIds: createIdList(recipeDefinition.allowedExtraIds),
    ingredients: {
      base: createIngredientDefinition(ingredients.base),
      syrups: createIngredientMap(ingredients.syrups),
      toppings: createIngredientMap(ingredients.toppings),
      extras: createIngredientMap(ingredients.extras),
    },
  };
};

export class RecipeRepository {
  constructor(recipeDefinitions = defaultRecipeDefinitions) {
    this.recipeDefinitions = Array.isArray(recipeDefinitions)
      ? recipeDefinitions.map((recipeDefinition) =>
          createRecipeDefinition(recipeDefinition),
        )
      : [];
  }

  listRecipes() {
    return this.recipeDefinitions.map((recipeDefinition) =>
      createRecipeDefinition(recipeDefinition),
    );
  }

  listRecipeDefinitions() {
    return this.listRecipes();
  }

  getRecipeById(recipeId) {
    const recipeDefinition = this.recipeDefinitions.find(
      (recipe) => recipe.id === recipeId,
    );

    return recipeDefinition ? createRecipeDefinition(recipeDefinition) : null;
  }

  getRecipeDefinitionById(recipeId) {
    return this.getRecipeById(recipeId);
  }

  findRecipeForConfiguration(configuration) {
    if (!isRecord(configuration) || !isNonEmptyString(configuration.recipeId)) {
      return null;
    }

    const recipeDefinition = this.getRecipeById(configuration.recipeId);

    if (!recipeDefinition || recipeDefinition.productId !== configuration.productId) {
      return null;
    }

    return recipeDefinition;
  }
}
