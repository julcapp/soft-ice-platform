import { TERMINAL_CATALOG } from '../data/catalog.js';

const copy = value => JSON.parse(JSON.stringify(value));
const availableOnly = items => Array.isArray(items)
  ? items.filter(item => item.available !== false)
  : [];

export const CatalogService = {
  getSnapshot() {
    const data = copy(TERMINAL_CATALOG);
    data.sprinkles = availableOnly(data.sprinkles);
    data.sauces = availableOnly(data.sauces);
    return data;
  }
};
