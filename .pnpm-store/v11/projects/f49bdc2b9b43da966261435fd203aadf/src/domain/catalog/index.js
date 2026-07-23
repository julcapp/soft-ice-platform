export { CatalogRepository } from './CatalogRepository.js';
export { CatalogService } from './CatalogService.js';

import { CatalogService } from './CatalogService.js';

const catalogService = new CatalogService();

export { catalogService };
export default catalogService;
