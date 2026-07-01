import { RecipeRepository } from './RecipeRepository.js';

export class RecipeEngine {
  constructor(repository = new RecipeRepository()) {
    this.repository = repository;
  }

  listRecipes() {
    return this.repository.listRecipes();
  }

  getRecipeById(recipeId) {
    return this.repository.getRecipeById(recipeId);
  }

  findRecipeForConfiguration(configuration) {
    return this.repository.findRecipeForConfiguration(configuration);
  }
}
