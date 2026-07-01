import { createMediaReference } from '../media/MediaReference.js';
import { createRecipeReference } from '../recipe/RecipeReference.js';

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

const createLocalizedName = (name) => {
  if (!isRecord(name)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(name).filter(
      ([locale, value]) => isNonEmptyString(locale) && isNonEmptyString(value),
    ),
  );
};

const createIdList = (ids) => {
  if (!Array.isArray(ids)) {
    return [];
  }

  return ids.filter((id) => isNonEmptyString(id));
};

export const createProductEntity = (rawProduct) => {
  const product = isRecord(rawProduct) ? rawProduct : {};
  const recipeReference = createRecipeReference(product.recipeId);
  const mediaReference = createMediaReference(product.mediaId);

  return {
    id: isNonEmptyString(product.id) ? product.id : '',
    name: createLocalizedName(product.name),
    category: isNonEmptyString(product.category) ? product.category : '',
    status: isNonEmptyString(product.status) ? product.status : '',
    defaultFlavor: isNonEmptyString(product.defaultFlavor)
      ? product.defaultFlavor
      : '',
    allowedSyrups: createIdList(product.allowedSyrups),
    allowedToppings: createIdList(product.allowedToppings),
    recipeId: recipeReference.id,
    mediaId: mediaReference.id,
    recipeReference,
    mediaReference,
  };
};

export const hasLocalizedProductName = (product) =>
  isRecord(product) &&
  isRecord(product.name) &&
  Object.values(product.name).some((value) => isNonEmptyString(value));

export const isValidProductEntity = (product) =>
  isRecord(product) &&
  isNonEmptyString(product.id) &&
  hasLocalizedProductName(product) &&
  isNonEmptyString(product.category) &&
  isNonEmptyString(product.status) &&
  isNonEmptyString(product.defaultFlavor) &&
  Array.isArray(product.allowedSyrups) &&
  Array.isArray(product.allowedToppings) &&
  isNonEmptyString(product.recipeId) &&
  isNonEmptyString(product.mediaId);

export const isActiveProduct = (product) =>
  isValidProductEntity(product) && product.status === 'active';
