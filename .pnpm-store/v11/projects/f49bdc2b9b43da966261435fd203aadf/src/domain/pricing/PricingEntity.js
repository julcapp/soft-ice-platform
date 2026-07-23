const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isNonNegativeNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isPositiveNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

const createDiscount = (rawDiscount) => {
  const discount = isRecord(rawDiscount) ? rawDiscount : {};

  return {
    id: isNonEmptyString(discount.id) ? discount.id : '',
    type: isNonEmptyString(discount.type) ? discount.type : '',
    amount: isNonNegativeNumber(discount.amount) ? discount.amount : 0,
  };
};

export const createPricingEntity = (rawPricing) => {
  const pricing = isRecord(rawPricing) ? rawPricing : {};

  return {
    basePrice: isNonNegativeNumber(pricing.basePrice)
      ? pricing.basePrice
      : 0,
    discounts: Array.isArray(pricing.discounts)
      ? pricing.discounts.map((discount) => createDiscount(discount))
      : [],
    bonusAllowed: Boolean(pricing.bonusAllowed),
    bonusLimit: isNonNegativeNumber(pricing.bonusLimit)
      ? pricing.bonusLimit
      : 0,
    bonusNominalRate: isPositiveNumber(pricing.bonusNominalRate)
      ? pricing.bonusNominalRate
      : 1,
    currency: isNonEmptyString(pricing.currency) ? pricing.currency : '',
    finalPrice: isNonNegativeNumber(pricing.finalPrice)
      ? pricing.finalPrice
      : 0,
  };
};

export const isValidDiscount = (discount) =>
  isRecord(discount) &&
  isNonEmptyString(discount.id) &&
  isNonEmptyString(discount.type) &&
  isNonNegativeNumber(discount.amount);

export const isValidPricingEntity = (pricing) =>
  isRecord(pricing) &&
  isNonNegativeNumber(pricing.basePrice) &&
  Array.isArray(pricing.discounts) &&
  pricing.discounts.every((discount) => isValidDiscount(discount)) &&
  typeof pricing.bonusAllowed === 'boolean' &&
  isNonNegativeNumber(pricing.bonusLimit) &&
  isPositiveNumber(pricing.bonusNominalRate) &&
  isNonEmptyString(pricing.currency) &&
  isNonNegativeNumber(pricing.finalPrice);
