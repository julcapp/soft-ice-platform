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

export const createToppingEntity = (rawTopping) => {
  const topping = isRecord(rawTopping) ? rawTopping : {};

  return {
    id: isNonEmptyString(topping.id) ? topping.id : '',
    name: createLocalizedName(topping.name),
  };
};

export const hasLocalizedToppingName = (topping) =>
  isRecord(topping) &&
  isRecord(topping.name) &&
  Object.values(topping.name).some((value) => isNonEmptyString(value));

export const isValidToppingEntity = (topping) =>
  isRecord(topping) &&
  isNonEmptyString(topping.id) &&
  hasLocalizedToppingName(topping);
