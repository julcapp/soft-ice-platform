import {
  createConfigurationEntity,
  isValidConfigurationEntity,
} from './ConfigurationEntity.js';
import { ConfigurationRepository } from './ConfigurationRepository.js';

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

const hasAllowedId = (allowedIds, selectedId) =>
  Array.isArray(allowedIds) &&
  allowedIds.length > 0 &&
  allowedIds.includes(selectedId);

const hasBlockedCombination = (rule, configurationDraft) =>
  rule.blockedCombinations.some((blockedCombination) => {
    const checks = [
      ['flavorId', configurationDraft.flavorId],
      ['sizeId', configurationDraft.sizeId],
      ['syrupId', configurationDraft.syrupId],
      ['toppingId', configurationDraft.toppingId],
    ];

    const idsMatch = checks.every(([key, selectedId]) => {
      const blockedId = blockedCombination[key];

      return !blockedId || blockedId === selectedId;
    });

    if (!idsMatch) {
      return false;
    }

    return blockedCombination.extraIds.every((extraId) =>
      configurationDraft.extras.includes(extraId),
    );
  });

export class ConfigurationValidationError extends Error {
  constructor(errors) {
    super('Invalid product configuration');
    this.name = 'ConfigurationValidationError';
    this.errors = errors;
  }
}

export class ConfigurationService {
  constructor(repository = new ConfigurationRepository()) {
    this.repository = repository;
  }

  getConfigurationRules() {
    return this.repository.getConfigurationRules();
  }

  getRulesForProduct(productId) {
    return this.repository.getRulesForProduct(productId);
  }

  validateConfiguration(configurationDraft) {
    const draft = isRecord(configurationDraft) ? configurationDraft : {};
    const productId = isNonEmptyString(draft.productId) ? draft.productId : '';
    const errors = [];

    if (!productId) {
      errors.push({
        code: 'configuration.product_required',
        field: 'productId',
        message: 'Product ID is required.',
      });

      return {
        valid: false,
        errors,
      };
    }

    const rule = this.repository.getRulesForProduct(productId);

    if (!rule) {
      errors.push({
        code: 'configuration.product_not_configurable',
        field: 'productId',
        message: 'Product has no configuration rules.',
      });

      return {
        valid: false,
        errors,
      };
    }

    const normalizedDraft = this.createDraftFromRule(draft, rule);

    this.validateRequiredSelections(normalizedDraft, errors);
    this.validateAllowedSelections(normalizedDraft, rule, errors);
    this.validateBlockedCombinations(normalizedDraft, rule, errors);
    this.validateEngineReferences(rule, errors);

    const configuration = createConfigurationEntity({
      ...normalizedDraft,
      recipeId: rule.recipeId,
      mediaId: rule.mediaId,
    });

    if (!isValidConfigurationEntity(configuration)) {
      errors.push({
        code: 'configuration.entity_invalid',
        field: 'configuration',
        message: 'Configuration entity is incomplete.',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  buildConfiguration(configurationDraft) {
    const validation = this.validateConfiguration(configurationDraft);

    if (!validation.valid) {
      throw new ConfigurationValidationError(validation.errors);
    }

    const draft = isRecord(configurationDraft) ? configurationDraft : {};
    const rule = this.repository.getRulesForProduct(draft.productId);
    const normalizedDraft = this.createDraftFromRule(draft, rule);

    return createConfigurationEntity({
      ...normalizedDraft,
      recipeId: rule.recipeId,
      mediaId: rule.mediaId,
    });
  }

  createDraftFromRule(draft, rule) {
    return {
      productId: isNonEmptyString(draft.productId) ? draft.productId : '',
      flavorId: isNonEmptyString(draft.flavorId)
        ? draft.flavorId
        : rule.defaultFlavorId,
      sizeId: isNonEmptyString(draft.sizeId)
        ? draft.sizeId
        : rule.defaultSizeId,
      syrupId: isNonEmptyString(draft.syrupId) ? draft.syrupId : '',
      toppingId: isNonEmptyString(draft.toppingId) ? draft.toppingId : '',
      extras: createIdList(draft.extras),
    };
  }

  validateRequiredSelections(configurationDraft, errors) {
    [
      'productId',
      'flavorId',
      'sizeId',
      'syrupId',
      'toppingId',
    ].forEach((field) => {
      if (!isNonEmptyString(configurationDraft[field])) {
        errors.push({
          code: `configuration.${field}_required`,
          field,
          message: `${field} is required.`,
        });
      }
    });
  }

  validateAllowedSelections(configurationDraft, rule, errors) {
    [
      ['flavorId', rule.allowedFlavorIds],
      ['sizeId', rule.allowedSizeIds],
      ['syrupId', rule.allowedSyrupIds],
      ['toppingId', rule.allowedToppingIds],
    ].forEach(([field, allowedIds]) => {
      if (
        isNonEmptyString(configurationDraft[field]) &&
        !hasAllowedId(allowedIds, configurationDraft[field])
      ) {
        errors.push({
          code: `configuration.${field}_not_allowed`,
          field,
          message: `${field} is not allowed for this product.`,
        });
      }
    });

    configurationDraft.extras.forEach((extraId) => {
      if (!rule.allowedExtraIds.includes(extraId)) {
        errors.push({
          code: 'configuration.extra_not_allowed',
          field: 'extras',
          message: `Extra ${extraId} is not allowed for this product.`,
        });
      }
    });
  }

  validateBlockedCombinations(configurationDraft, rule, errors) {
    if (hasBlockedCombination(rule, configurationDraft)) {
      errors.push({
        code: 'configuration.combination_blocked',
        field: 'configuration',
        message: 'Selected product combination is blocked by configuration rules.',
      });
    }
  }

  validateEngineReferences(rule, errors) {
    [
      ['recipeId', rule.recipeId],
      ['mediaId', rule.mediaId],
    ].forEach(([field, value]) => {
      if (!isNonEmptyString(value)) {
        errors.push({
          code: `configuration.${field}_required`,
          field,
          message: `${field} is required.`,
        });
      }
    });
  }
}
