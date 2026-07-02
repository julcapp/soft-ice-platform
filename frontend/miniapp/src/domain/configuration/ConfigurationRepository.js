const defaultConfigurationRules = {
  products: [
    {
      productId: 'product_soft_ice_vanilla_cup',
      defaultFlavorId: 'flavor_vanilla',
      defaultSizeId: 'size_cup_standard',
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
      blockedCombinations: [],
      recipeId: 'recipe_soft_ice_vanilla_cup',
      mediaId: 'media_soft_ice_vanilla_cup',
    },
  ],
};

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

const createBlockedCombinations = (blockedCombinations) => {
  if (!Array.isArray(blockedCombinations)) {
    return [];
  }

  return blockedCombinations
    .filter((combination) => isRecord(combination))
    .map((combination) => ({
      flavorId: isNonEmptyString(combination.flavorId)
        ? combination.flavorId
        : '',
      sizeId: isNonEmptyString(combination.sizeId) ? combination.sizeId : '',
      syrupId: isNonEmptyString(combination.syrupId)
        ? combination.syrupId
        : '',
      toppingId: isNonEmptyString(combination.toppingId)
        ? combination.toppingId
        : '',
      extraIds: createIdList(combination.extraIds),
      reason: isNonEmptyString(combination.reason) ? combination.reason : '',
    }));
};

const createProductRule = (rawRule) => {
  const rule = isRecord(rawRule) ? rawRule : {};

  return {
    productId: isNonEmptyString(rule.productId) ? rule.productId : '',
    defaultFlavorId: isNonEmptyString(rule.defaultFlavorId)
      ? rule.defaultFlavorId
      : '',
    defaultSizeId: isNonEmptyString(rule.defaultSizeId)
      ? rule.defaultSizeId
      : '',
    allowedFlavorIds: createIdList(rule.allowedFlavorIds),
    allowedSizeIds: createIdList(rule.allowedSizeIds),
    allowedSyrupIds: createIdList(rule.allowedSyrupIds),
    allowedToppingIds: createIdList(rule.allowedToppingIds),
    allowedExtraIds: createIdList(rule.allowedExtraIds),
    blockedCombinations: createBlockedCombinations(rule.blockedCombinations),
    recipeId: isNonEmptyString(rule.recipeId) ? rule.recipeId : '',
    mediaId: isNonEmptyString(rule.mediaId) ? rule.mediaId : '',
  };
};

export class ConfigurationRepository {
  constructor(configurationRules = defaultConfigurationRules) {
    const rules = isRecord(configurationRules) ? configurationRules : {};

    this.configurationRules = {
      products: Array.isArray(rules.products)
        ? rules.products.map((productRule) => createProductRule(productRule))
        : [],
    };
  }

  getConfigurationRules() {
    return {
      products: this.configurationRules.products.map((productRule) =>
        createProductRule(productRule),
      ),
    };
  }

  getRulesForProduct(productId) {
    const productRule = this.configurationRules.products.find(
      (rule) => rule.productId === productId,
    );

    return productRule ? createProductRule(productRule) : null;
  }
}

