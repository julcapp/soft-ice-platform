'use strict';

const CATEGORIES = Object.freeze(['ICE_CREAM', 'SPRINKLE', 'TOPPING']);

class CatalogService {
  constructor({ repository } = {}) {
    if (!repository) throw new Error('Catalog repository is required.');
    this.repository = repository;
  }

  async listAll() {
    const items = await this.repository.listAll();
    return items.map((item) => this._present(item));
  }

  listMachines() {
    return this.repository.listMachines();
  }

  async getMachineCatalog(machineId) {
    if (!machineId) throw this._error('CATALOG_MACHINE_REQUIRED', 'machineId is required.', 400);
    const result = await this.repository.listMachineCatalog(machineId);
    if (!result) throw this._error('CATALOG_MACHINE_NOT_FOUND', 'Machine was not found.', 404);
    const items = result.assignments.map((row) => this._present(row.catalogItem, row));
    const currentFlavor = items.find((item) => item.category === 'ICE_CREAM' && item.isCurrentFlavor);
    if (!currentFlavor) throw this._error('CATALOG_CURRENT_FLAVOR_MISSING', 'Machine has no active current flavor.', 409);
    const invalid = items.find((item) => item.basePrice == null || item.basePrice < 0);
    if (invalid) throw this._error('CATALOG_PRICE_INVALID', `Catalog item ${invalid.sku} has no valid price.`, 409);
    return {
      machine: result.machine,
      currentFlavor,
      items,
      sprinkles: items.filter((item) => item.category === 'SPRINKLE'),
      toppings: items.filter((item) => item.category === 'TOPPING'),
      currency: currentFlavor.currency,
    };
  }

  async resolvePricedItems(machineId, requested = []) {
    const catalog = await this.getMachineCatalog(machineId);
    if (!Array.isArray(requested) || requested.length === 0) throw this._error('SERVER_PRODUCT_ITEMS_REQUIRED', 'At least one product item is required.', 400);
    const available = new Map(catalog.items.map((item) => [item.sku, item]));
    return requested.map((request, index) => {
      const sku = String(request?.productId || request?.sku || '').trim();
      const item = available.get(sku);
      if (!item) throw this._error('SERVER_PRODUCT_NOT_SALEABLE', `Item ${sku || index} is not available for this machine.`, 409);
      const quantity = Number(request?.quantity ?? 1);
      if (!Number.isInteger(quantity) || quantity <= 0) throw this._error('SERVER_PRODUCT_QUANTITY_INVALID', `Invalid quantity at items[${index}].`, 400);
      return {
        id: request.id || `${sku}:${index}`,
        sku,
        productId: sku,
        name: item.nameRu,
        quantity,
        unitPrice: item.basePrice,
        currency: item.currency,
        serverProductType: item.category,
        serverPriceModelId: `catalog:${item.id}:${new Date(item.updatedAt).toISOString()}`,
      };
    });
  }

  createItem(input, context) {
    const data = this._validatedItem(input, { creating: true });
    return this.repository.createItem(data, context).then((item) => this._present(item));
  }

  async updateItem(id, patch, context) {
    const existing = await this._required(id);
    if (existing.systemItem && patch.active === false) throw this._error('CATALOG_SYSTEM_ITEM_PROTECTED', 'System no-option items cannot be deactivated.', 409);
    if (existing.systemItem && patch.systemItem === false) throw this._error('CATALOG_SYSTEM_ITEM_PROTECTED', 'System no-option marker cannot be removed.', 409);
    if (existing.systemItem && patch.sku !== undefined && patch.sku !== existing.sku) throw this._error('CATALOG_SYSTEM_ITEM_PROTECTED', 'System no-option SKU cannot be changed.', 409);
    if (existing.systemItem && patch.category !== undefined && String(patch.category).toUpperCase() !== existing.category) throw this._error('CATALOG_SYSTEM_ITEM_PROTECTED', 'System no-option category cannot be changed.', 409);
    if (patch.active === false && existing.category === 'ICE_CREAM' && await this.repository.hasCurrentFlavorAssignments?.(existing.id)) {
      throw this._error('CATALOG_CURRENT_FLAVOR_DEACTIVATION_BLOCKED', 'Select another current flavor before deactivating this item.', 409);
    }
    const data = this._validatedItem({ ...existing, ...patch }, { creating: false, patch });
    return this.repository.updateItem(id, data, context).then((item) => this._present(item));
  }

  async updatePrice(id, { basePrice, currency }, context) {
    const item = await this._required(id);
    const normalized = this._price(basePrice, item.systemItem, item.freeItem);
    const requestedCurrency = String(currency || item.currency).toUpperCase();
    if (item.systemItem && requestedCurrency !== 'RUB') throw this._error('CATALOG_SYSTEM_PRICE_INVALID', 'System no-option item must remain explicitly priced at 0 RUB.', 400);
    const normalizedCurrency = this._currency(requestedCurrency);
    return this.repository.updateItem(id, { basePrice: normalized, currency: normalizedCurrency }, context, 'CATALOG_PRICE_UPDATED').then((value) => this._present(value));
  }

  async updatePrices(changes, context) {
    if (!Array.isArray(changes) || changes.length === 0) throw this._error('CATALOG_PRICE_CHANGES_REQUIRED', 'At least one price change is required.', 400);
    const ids = changes.map((change) => String(change?.id || '').trim());
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw this._error('CATALOG_PRICE_CHANGES_INVALID', 'Price changes require unique item ids.', 400);
    const normalized = [];
    for (let index = 0; index < changes.length; index += 1) {
      const item = await this._required(ids[index]);
      normalized.push({ id: item.id, basePrice: this._price(changes[index].basePrice, item.systemItem, item.freeItem, item.active), currency: this._currency(changes[index].currency || item.currency) });
    }
    const items = await this.repository.updatePrices(normalized, context);
    return items.map((item) => this._present(item));
  }

  async setAvailability(machineId, catalogItemId, available, context) {
    const item = await this._required(catalogItemId);
    if (item.systemItem && available === false) throw this._error('CATALOG_SYSTEM_ITEM_PROTECTED', 'System no-option items cannot be removed from machine availability.', 409);
    return this.repository.setAvailability({ machineId, catalogItemId, available: Boolean(available) }, context);
  }

  async setCurrentFlavor(machineId, catalogItemId, context) {
    const item = await this._required(catalogItemId);
    if (item.category !== 'ICE_CREAM' || !item.active || item.basePrice == null) {
      throw this._error('CATALOG_CURRENT_FLAVOR_INVALID', 'Current flavor must be an active ICE_CREAM item with a valid price.', 409);
    }
    return this.repository.setCurrentFlavor({ machineId, catalogItemId }, context);
  }

  async _required(id) {
    const item = await this.repository.getItem(id);
    if (!item) throw this._error('CATALOG_ITEM_NOT_FOUND', 'Catalog item was not found.', 404);
    return item;
  }

  _validatedItem(input, { creating, patch = input }) {
    const category = String(input.category || '').toUpperCase();
    if (!CATEGORIES.includes(category)) throw this._error('CATALOG_CATEGORY_INVALID', 'Unsupported catalog category.', 400);
    const sku = String(input.sku || '').trim();
    const nameRu = String(input.nameRu || '').trim();
    if (!sku || !nameRu) throw this._error('CATALOG_REQUIRED_FIELDS', 'sku and nameRu are required.', 400);
    const systemItem = Boolean(input.systemItem);
    const freeItem = Boolean(input.freeItem);
    const active = input.active !== false;
    const basePrice = this._price(input.basePrice, systemItem, freeItem, active);
    const currency = this._currency(input.currency || 'RUB');
    if (systemItem && currency !== 'RUB') throw this._error('CATALOG_SYSTEM_PRICE_INVALID', 'System no-option item must be explicitly priced at 0 RUB.', 400);
    const all = {
      sku, category, nameRu,
      descriptionRu: input.descriptionRu ? String(input.descriptionRu).trim() : null,
      basePrice,
      currency,
      active, systemItem, freeItem,
      sortOrder: Number.isInteger(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
      mediaPath: input.mediaPath ? String(input.mediaPath).trim() : null,
    };
    if (creating) return all;
    const allowed = Object.keys(all).filter((key) => Object.prototype.hasOwnProperty.call(patch, key));
    return Object.fromEntries(allowed.map((key) => [key, all[key]]));
  }

  _price(value, systemItem, freeItem, active = true) {
    if (value === null || value === undefined || value === '') {
      if (active) throw this._error('CATALOG_PRICE_REQUIRED', 'Active catalog item requires an explicit price.', 400);
      return null;
    }
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) throw this._error('CATALOG_PRICE_INVALID', 'Price must be nonnegative.', 400);
    if (systemItem && price !== 0) throw this._error('CATALOG_SYSTEM_PRICE_INVALID', 'System no-option item must have an explicit zero price.', 400);
    if (price === 0 && !systemItem && !freeItem) throw this._error('CATALOG_ZERO_PRICE_REQUIRES_REASON', 'Zero price requires a system or deliberately free item.', 400);
    return Math.round((price + Number.EPSILON) * 100) / 100;
  }

  _currency(value) {
    const currency = String(value || '').toUpperCase();
    if (currency !== 'RUB') throw this._error('CATALOG_CURRENCY_UNSUPPORTED', 'Catalog pricing currently supports RUB only.', 400);
    return currency;
  }

  _present(item, assignment = null) {
    const { status: configurationStatus, issues: configurationIssues } = this._configurationStatus(item);
    return {
      ...item,
      basePrice: item.basePrice == null ? null : Number(item.basePrice),
      configurationStatus,
      configurationIssues,
      available: assignment ? assignment.available : undefined,
      isCurrentFlavor: assignment ? assignment.isCurrentFlavor : undefined,
    };
  }

  _configurationStatus(item) {
    const price = item.basePrice == null ? null : Number(item.basePrice);
    if (price === null || !Number.isFinite(price) || price < 0) return { status: 'MISSING_PRICE', issues: ['У позиции отсутствует корректная базовая цена.'] };
    const issues = [];
    if (item.currency !== 'RUB') issues.push('Поддерживается только валюта RUB.');
    if (price === 0 && !item.systemItem && !item.freeItem) issues.push('Нулевая цена требует признака системной или бесплатной позиции.');
    if (item.systemItem && price !== 0) issues.push('Системная позиция должна иметь цену 0 RUB.');
    if ((item.machines || []).some((entry) => entry.isCurrentFlavor && (!entry.available || item.category !== 'ICE_CREAM' || !item.active))) issues.push('Текущий вкус назначен с несовместимой конфигурацией.');
    if (issues.length) return { status: 'CONFIG_ERROR', issues };
    return { status: item.active ? 'ACTIVE' : 'INACTIVE', issues: [] };
  }

  _error(code, message, statusCode) {
    return Object.assign(new Error(message), { code, statusCode, source: 'catalog' });
  }
}

module.exports = { CatalogService, CATEGORIES };
