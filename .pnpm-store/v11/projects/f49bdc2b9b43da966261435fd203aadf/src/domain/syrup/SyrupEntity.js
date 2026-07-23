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

export const createSyrupEntity = (rawSyrup) => {
  const syrup = isRecord(rawSyrup) ? rawSyrup : {};

  return {
    id: isNonEmptyString(syrup.id) ? syrup.id : '',
    name: createLocalizedName(syrup.name),
  };
};

export const hasLocalizedSyrupName = (syrup) =>
  isRecord(syrup) &&
  isRecord(syrup.name) &&
  Object.values(syrup.name).some((value) => isNonEmptyString(value));

export const isValidSyrupEntity = (syrup) =>
  isRecord(syrup) && isNonEmptyString(syrup.id) && hasLocalizedSyrupName(syrup);
