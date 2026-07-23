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

const createRecipeIngredient = (rawIngredient) => {
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

export const createRecipeEntity = (rawRecipe) => {
  const recipe = isRecord(rawRecipe) ? rawRecipe : {};

  return {
    id: isNonEmptyString(recipe.id) ? recipe.id : '',
    productId: isNonEmptyString(recipe.productId) ? recipe.productId : '',
    flavorId: isNonEmptyString(recipe.flavorId) ? recipe.flavorId : '',
    sizeId: isNonEmptyString(recipe.sizeId) ? recipe.sizeId : '',
    syrupId: isNonEmptyString(recipe.syrupId) ? recipe.syrupId : '',
    toppingId: isNonEmptyString(recipe.toppingId) ? recipe.toppingId : '',
    extras: createIdList(recipe.extras),
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map((ingredient) => createRecipeIngredient(ingredient))
      : [],
    status: isNonEmptyString(recipe.status) ? recipe.status : '',
    version:
      Number.isInteger(recipe.version) && recipe.version > 0
        ? recipe.version
        : 1,
  };
};

export const isValidRecipeIngredient = (ingredient) =>
  isRecord(ingredient) &&
  isNonEmptyString(ingredient.id) &&
  isNonEmptyString(ingredient.role) &&
  isNonEmptyString(ingredient.sourceId) &&
  isRecord(ingredient.quantity) &&
  isPositiveNumber(ingredient.quantity.value) &&
  isNonEmptyString(ingredient.quantity.unit);

export const isValidRecipeEntity = (recipe) =>
  isRecord(recipe) &&
  isNonEmptyString(recipe.id) &&
  isNonEmptyString(recipe.productId) &&
  isNonEmptyString(recipe.flavorId) &&
  isNonEmptyString(recipe.sizeId) &&
  isNonEmptyString(recipe.syrupId) &&
  isNonEmptyString(recipe.toppingId) &&
  Array.isArray(recipe.extras) &&
  recipe.extras.every((extraId) => isNonEmptyString(extraId)) &&
  Array.isArray(recipe.ingredients) &&
  recipe.ingredients.length > 0 &&
  recipe.ingredients.every((ingredient) => isValidRecipeIngredient(ingredient)) &&
  isNonEmptyString(recipe.status) &&
  Number.isInteger(recipe.version) &&
  recipe.version > 0;
