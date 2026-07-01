import { NotImplementedError } from '../../shared/errors/index.js';

export class RecipeRepository {
  async listRecipes() {
    throw new NotImplementedError();
  }

  async getRecipeById(recipeId) {
    throw new NotImplementedError();
  }

  async findRecipeForConfiguration(configuration) {
    throw new NotImplementedError();
  }
}
