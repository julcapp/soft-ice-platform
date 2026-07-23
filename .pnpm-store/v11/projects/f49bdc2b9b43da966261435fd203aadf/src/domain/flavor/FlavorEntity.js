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

export const createFlavorEntity = (rawFlavor) => {
  const flavor = isRecord(rawFlavor) ? rawFlavor : {};

  return {
    id: isNonEmptyString(flavor.id) ? flavor.id : '',
    name: createLocalizedName(flavor.name),
  };
};

export const hasLocalizedFlavorName = (flavor) =>
  isRecord(flavor) &&
  isRecord(flavor.name) &&
  Object.values(flavor.name).some((value) => isNonEmptyString(value));

export const isValidFlavorEntity = (flavor) =>
  isRecord(flavor) && isNonEmptyString(flavor.id) && hasLocalizedFlavorName(flavor);
