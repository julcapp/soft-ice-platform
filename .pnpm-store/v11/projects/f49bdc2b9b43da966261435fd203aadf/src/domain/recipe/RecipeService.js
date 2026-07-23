import { isValidConfigurationEntity } from '../configuration/ConfigurationEntity.js';
import {
  createRecipeEntity,
  isValidRecipeEntity,
} from './RecipeEntity.js';
import { RecipeRepository } from './RecipeRepository.js';

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

const hasAllowedId = (allowedIds, selectedId) =>
  Array.isArray(allowedIds) &&
  allowedIds.length > 0 &&
  allowedIds.includes(selectedId);

const hasIngredientDefinition = (ingredient) =>
  isRecord(ingredient) &&
  isNonEmptyString(ingredient.id) &&
  isNonEmptyString(ingredient.role) &&
  isNonEmptyString(ingredient.sourceId) &&
  isRecord(ingredient.quantity) &&
  typeof ingredient.quantity.value === 'number' &&
  Number.isFinite(ingredient.quantity.value) &&
  ingredient.quantity.value > 0 &&
  isNonEmptyString(ingredient.quantity.unit);

export class RecipeValidationError extends Error {
  constructor(errors) {
    super('Invalid recipe configuration');
    this.name = 'RecipeValidationError';
    this.errors = errors;
  }
}

export class RecipeService {
  constructor(repository = new RecipeRepository()) {
    this.repository = repository;
  }

  listRecipes() {
    return this.repository.listRecipes();
  }

  getRecipeById(recipeId) {
    return this.repository.getRecipeById(recipeId);
  }

  validateRecipeCompatibility(configuration) {
    const errors = [];

    if (!isValidConfigurationEntity(configuration)) {
      errors.push({
        code: 'recipe.configuration_invalid',
        field: 'configuration',
        message: 'A valid ConfigurationEntity is required.',
      });

      return {
        valid: false,
        errors,
      };
    }

    const recipeDefinition = this.repository.getRecipeById(
      configuration.recipeId,
    );

    if (!recipeDefinition) {
      errors.push({
        code: 'recipe.not_found',
        field: 'recipeId',
        message: 'Recipe definition was not found.',
      });

      return {
        valid: false,
        errors,
      };
    }

    this.validateRecipeDefinition(recipeDefinition, configuration, errors);

    if (errors.length === 0) {
      const recipe = this.createRecipeFromDefinition(
        recipeDefinition,
        configuration,
      );

      if (!isValidRecipeEntity(recipe)) {
        errors.push({
          code: 'recipe.entity_invalid',
          field: 'recipe',
          message: 'Recipe entity is incomplete.',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  buildRecipe(configuration) {
    const validation = this.validateRecipeCompatibility(configuration);

    if (!validation.valid) {
      throw new RecipeValidationError(validation.errors);
    }

    const recipeDefinition = this.repository.getRecipeById(
      configuration.recipeId,
    );

    return this.createRecipeFromDefinition(recipeDefinition, configuration);
  }

  findRecipeForConfiguration(configuration) {
    const validation = this.validateRecipeCompatibility(configuration);

    if (!validation.valid) {
      return null;
    }

    return this.buildRecipe(configuration);
  }

  validateRecipeDefinition(recipeDefinition, configuration, errors) {
    if (recipeDefinition.status !== 'active') {
      errors.push({
        code: 'recipe.not_active',
        field: 'recipeId',
        message: 'Recipe definition is not active.',
      });
    }

    if (recipeDefinition.productId !== configuration.productId) {
      errors.push({
        code: 'recipe.product_mismatch',
        field: 'productId',
        message: 'Recipe does not match the configured product.',
      });
    }

    [
      ['flavorId', 'allowedFlavorIds'],
      ['sizeId', 'allowedSizeIds'],
      ['syrupId', 'allowedSyrupIds'],
      ['toppingId', 'allowedToppingIds'],
    ].forEach(([field, allowedField]) => {
      if (!hasAllowedId(recipeDefinition[allowedField], configuration[field])) {
        errors.push({
          code: `recipe.${field}_not_supported`,
          field,
          message: `${field} is not supported by this recipe.`,
        });
      }
    });

    configuration.extras.forEach((extraId) => {
      if (!recipeDefinition.allowedExtraIds.includes(extraId)) {
        errors.push({
          code: 'recipe.extra_not_supported',
          field: 'extras',
          message: `Extra ${extraId} is not supported by this recipe.`,
        });
      }
    });

    this.validateIngredientDefinitions(recipeDefinition, configuration, errors);
  }

  validateIngredientDefinitions(recipeDefinition, configuration, errors) {
    const baseIngredient = recipeDefinition.ingredients.base;
    const syrupIngredient =
      recipeDefinition.ingredients.syrups[configuration.syrupId];
    const toppingIngredient =
      recipeDefinition.ingredients.toppings[configuration.toppingId];

    [
      ['ingredients.base', baseIngredient],
      [`ingredients.syrups.${configuration.syrupId}`, syrupIngredient],
      [`ingredients.toppings.${configuration.toppingId}`, toppingIngredient],
    ].forEach(([field, ingredient]) => {
      if (!hasIngredientDefinition(ingredient)) {
        errors.push({
          code: 'recipe.ingredient_missing',
          field,
          message: `${field} is missing from the recipe definition.`,
        });
      }
    });

    configuration.extras.forEach((extraId) => {
      const extraIngredient = recipeDefinition.ingredients.extras[extraId];

      if (!hasIngredientDefinition(extraIngredient)) {
        errors.push({
          code: 'recipe.extra_ingredient_missing',
          field: `ingredients.extras.${extraId}`,
          message: `Extra ingredient ${extraId} is missing from the recipe definition.`,
        });
      }
    });
  }

  createRecipeFromDefinition(recipeDefinition, configuration) {
    const ingredients = [
      recipeDefinition.ingredients.base,
      recipeDefinition.ingredients.syrups[configuration.syrupId],
      recipeDefinition.ingredients.toppings[configuration.toppingId],
      ...configuration.extras.map(
        (extraId) => recipeDefinition.ingredients.extras[extraId],
      ),
    ];

    return createRecipeEntity({
      id: recipeDefinition.id,
      productId: configuration.productId,
      flavorId: configuration.flavorId,
      sizeId: configuration.sizeId,
      syrupId: configuration.syrupId,
      toppingId: configuration.toppingId,
      extras: configuration.extras,
      ingredients,
      status: recipeDefinition.status,
      version: recipeDefinition.version,
    });
  }
}
