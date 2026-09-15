import { TERMINAL_CATALOG } from '../data/catalog.js';

const copy = value => JSON.parse(JSON.stringify(value));

export const CatalogService = {
  getSnapshot() {
    const data = copy(TERMINAL_CATALOG);
    data.syrups = data.syrups.filter(item => item.available !== false);
    data.toppings = data.toppings.filter(item => item.available !== false);
    return data;
  }
};
