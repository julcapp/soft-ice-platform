const defaultPricingRules = {
  currency: 'RUB',
  products: [
    {
      productId: 'product_soft_ice_vanilla_cup',
      priceModelId: 'price_model_soft_ice_vanilla_cup_mvp',
      basePrice: 130,
      includedComponentIds: ['syrup', 'topping'],
      bonus: {
        allowed: true,
        nominalRate: 1,
        maxPercent: 80,
      },
      status: 'active',
    },
  ],
};

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

const isNonNegativeNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isPositiveNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const createIdList = (ids) => {
  if (!Array.isArray(ids)) {
    return [];
  }

  return ids.filter((id) => isNonEmptyString(id));
};

const createBonusRule = (rawBonusRule) => {
  const bonusRule = isRecord(rawBonusRule) ? rawBonusRule : {};

  return {
    allowed: Boolean(bonusRule.allowed),
    nominalRate: isPositiveNumber(bonusRule.nominalRate)
      ? bonusRule.nominalRate
      : 1,
    maxPercent: isNonNegativeNumber(bonusRule.maxPercent)
      ? bonusRule.maxPercent
      : 0,
  };
};

const createProductPricingRule = (rawProductRule) => {
  const productRule = isRecord(rawProductRule) ? rawProductRule : {};

  return {
    productId: isNonEmptyString(productRule.productId)
      ? productRule.productId
      : '',
    priceModelId: isNonEmptyString(productRule.priceModelId)
      ? productRule.priceModelId
      : '',
    basePrice: isNonNegativeNumber(productRule.basePrice)
      ? productRule.basePrice
      : 0,
    includedComponentIds: createIdList(productRule.includedComponentIds),
    bonus: createBonusRule(productRule.bonus),
    status: isNonEmptyString(productRule.status) ? productRule.status : '',
  };
};

export class PricingRepository {
  constructor(pricingRules = defaultPricingRules) {
    const rules = isRecord(pricingRules) ? pricingRules : {};

    this.pricingRules = {
      currency: isNonEmptyString(rules.currency) ? rules.currency : 'RUB',
      products: Array.isArray(rules.products)
        ? rules.products.map((productRule) =>
            createProductPricingRule(productRule),
          )
        : [],
    };
  }

  getPriceList() {
    return this.pricingRules.products.map((productRule) =>
      createProductPricingRule(productRule),
    );
  }

  getPricingRules() {
    return {
      currency: this.pricingRules.currency,
      products: this.getPriceList(),
    };
  }

  getPriceModelById(priceModelId) {
    const priceModel = this.pricingRules.products.find(
      (productRule) => productRule.priceModelId === priceModelId,
    );

    return priceModel ? createProductPricingRule(priceModel) : null;
  }

  getPricingRuleForProduct(productId) {
    const productRule = this.pricingRules.products.find(
      (rule) => rule.productId === productId,
    );

    return productRule ? createProductPricingRule(productRule) : null;
  }
}
