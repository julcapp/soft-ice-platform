const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

const createIdList = (ids) => {
  if (!Array.isArray(ids)) {
    return [];
  }

  return ids.filter((id) => isNonEmptyString(id));
};

export const createConfigurationEntity = (rawConfiguration) => {
  const configuration = isRecord(rawConfiguration) ? rawConfiguration : {};

  return {
    productId: isNonEmptyString(configuration.productId)
      ? configuration.productId
      : '',
    flavorId: isNonEmptyString(configuration.flavorId)
      ? configuration.flavorId
      : '',
    sizeId: isNonEmptyString(configuration.sizeId) ? configuration.sizeId : '',
    syrupId: isNonEmptyString(configuration.syrupId)
      ? configuration.syrupId
      : '',
    toppingId: isNonEmptyString(configuration.toppingId)
      ? configuration.toppingId
      : '',
    extras: createIdList(configuration.extras),
    recipeId: isNonEmptyString(configuration.recipeId)
      ? configuration.recipeId
      : '',
    mediaId: isNonEmptyString(configuration.mediaId)
      ? configuration.mediaId
      : '',
  };
};

export const isValidConfigurationEntity = (configuration) =>
  isRecord(configuration) &&
  isNonEmptyString(configuration.productId) &&
  isNonEmptyString(configuration.flavorId) &&
  isNonEmptyString(configuration.sizeId) &&
  isNonEmptyString(configuration.syrupId) &&
  isNonEmptyString(configuration.toppingId) &&
  Array.isArray(configuration.extras) &&
  configuration.extras.every((extraId) => isNonEmptyString(extraId)) &&
  isNonEmptyString(configuration.recipeId) &&
  isNonEmptyString(configuration.mediaId);

