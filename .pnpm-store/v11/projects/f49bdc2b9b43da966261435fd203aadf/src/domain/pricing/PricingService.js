import {
  isActiveProduct,
  isValidProductEntity,
} from '../product/ProductEntity.js';
import { isValidConfigurationEntity } from '../configuration/ConfigurationEntity.js';
import { isValidRecipeEntity } from '../recipe/RecipeEntity.js';
import {
  createPricingEntity,
  isValidPricingEntity,
} from './PricingEntity.js';
import { PricingRepository } from './PricingRepository.js';

const sameExtras = (leftExtras, rightExtras) => {
  if (!Array.isArray(leftExtras) || !Array.isArray(rightExtras)) {
    return false;
  }

  if (leftExtras.length !== rightExtras.length) {
    return false;
  }

  return leftExtras.every((extraId) => rightExtras.includes(extraId));
};

export class PricingValidationError extends Error {
  constructor(errors) {
    super('Invalid pricing input');
    this.name = 'PricingValidationError';
    this.errors = errors;
  }
}

export class PricingService {
  constructor(repository = new PricingRepository()) {
    this.repository = repository;
  }

  getPriceList() {
    return this.repository.getPriceList();
  }

  getPricingRules() {
    return this.repository.getPricingRules();
  }

  getPriceModelById(priceModelId) {
    return this.repository.getPriceModelById(priceModelId);
  }

  validatePricingInput(product, configuration, recipe) {
    const errors = [];

    if (!isValidProductEntity(product)) {
      errors.push({
        code: 'pricing.product_invalid',
        field: 'product',
        message: 'A valid ProductEntity is required.',
      });
    } else if (!isActiveProduct(product)) {
      errors.push({
        code: 'pricing.product_inactive',
        field: 'product',
        message: 'Product must be active before pricing.',
      });
    }

    if (!isValidConfigurationEntity(configuration)) {
      errors.push({
        code: 'pricing.configuration_invalid',
        field: 'configuration',
        message: 'A valid ConfigurationEntity is required.',
      });
    }

    if (!isValidRecipeEntity(recipe)) {
      errors.push({
        code: 'pricing.recipe_invalid',
        field: 'recipe',
        message: 'A valid RecipeEntity is required.',
      });
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors,
      };
    }

    this.validateDomainConsistency(product, configuration, recipe, errors);
    this.validatePricingRule(product, errors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  calculatePricing(product, configuration, recipe) {
    const validation = this.validatePricingInput(product, configuration, recipe);

    if (!validation.valid) {
      throw new PricingValidationError(validation.errors);
    }

    const pricingRule = this.repository.getPricingRuleForProduct(product.id);
    const discounts = [];
    const discountTotal = discounts.reduce(
      (total, discount) => total + discount.amount,
      0,
    );
    const finalPrice = Math.max(pricingRule.basePrice - discountTotal, 0);
    const bonusLimit = pricingRule.bonus.allowed
      ? Math.floor((finalPrice * pricingRule.bonus.maxPercent) / 100)
      : 0;

    const pricing = createPricingEntity({
      basePrice: pricingRule.basePrice,
      discounts,
      bonusAllowed: pricingRule.bonus.allowed,
      bonusLimit,
      bonusNominalRate: pricingRule.bonus.nominalRate,
      currency: this.repository.getPricingRules().currency,
      finalPrice,
    });

    if (!isValidPricingEntity(pricing)) {
      throw new PricingValidationError([
        {
          code: 'pricing.entity_invalid',
          field: 'pricing',
          message: 'Pricing entity is incomplete.',
        },
      ]);
    }

    return pricing;
  }

  calculatePrice(product, configuration, recipe) {
    return this.calculatePricing(product, configuration, recipe);
  }

  validateDomainConsistency(product, configuration, recipe, errors) {
    if (configuration.productId !== product.id) {
      errors.push({
        code: 'pricing.product_configuration_mismatch',
        field: 'configuration.productId',
        message: 'Configuration does not match the product being priced.',
      });
    }

    if (recipe.productId !== product.id) {
      errors.push({
        code: 'pricing.product_recipe_mismatch',
        field: 'recipe.productId',
        message: 'Recipe does not match the product being priced.',
      });
    }

    [
      'flavorId',
      'sizeId',
      'syrupId',
      'toppingId',
    ].forEach((field) => {
      if (recipe[field] !== configuration[field]) {
        errors.push({
          code: `pricing.${field}_mismatch`,
          field,
          message: `${field} differs between configuration and recipe.`,
        });
      }
    });

    if (!sameExtras(recipe.extras, configuration.extras)) {
      errors.push({
        code: 'pricing.extras_mismatch',
        field: 'extras',
        message: 'Extras differ between configuration and recipe.',
      });
    }
  }

  validatePricingRule(product, errors) {
    const pricingRule = this.repository.getPricingRuleForProduct(product.id);

    if (!pricingRule) {
      errors.push({
        code: 'pricing.rule_not_found',
        field: 'product.id',
        message: 'Pricing rule was not found for this product.',
      });

      return;
    }

    if (pricingRule.status !== 'active') {
      errors.push({
        code: 'pricing.rule_inactive',
        field: 'pricingRule.status',
        message: 'Pricing rule must be active.',
      });
    }
  }
}
