const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

export const createRecipeReference = (recipeId) => ({
  id: isNonEmptyString(recipeId) ? recipeId : '',
});

export const isValidRecipeReference = (recipeReference) =>
  recipeReference !== null &&
  typeof recipeReference === 'object' &&
  !Array.isArray(recipeReference) &&
  isNonEmptyString(recipeReference.id);
