'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DEFAULT_PRODUCT_TYPES = Object.freeze({
  product_soft_ice_vanilla_cup: 'ICE_CREAM',
});

class ServerProductPricingResolver {
  constructor({
    pricingModulePath = path.resolve(__dirname, '../../../../frontend/miniapp/src/domain/pricing/PricingRepository.js'),
    productTypes = DEFAULT_PRODUCT_TYPES,
  } = {}) {
    this.pricingModulePath = pricingModulePath;
    this.productTypes = { ...productTypes };
    this.repositoryPromise = null;
  }

  async resolveItems(items = []) {
    if (!Array.isArray(items) || items.length === 0) throw this._error('SERVER_PRODUCT_ITEMS_REQUIRED', 'At least one product item is required.', 400);
    const repository = await this._repository();
    return items.map((item, index) => {
      const productId = String(item?.productId || item?.sku || '').trim();
      if (!productId) throw this._error('SERVER_PRODUCT_ID_REQUIRED', `productId is required at items[${index}].`, 400);
      const rule = repository.getPricingRuleForProduct(productId);
      if (!rule || rule.status !== 'active') throw this._error('SERVER_PRODUCT_NOT_SALEABLE', `Product ${productId} has no active server pricing rule.`, 409);
      const quantity = Number(item?.quantity ?? 1);
      if (!Number.isInteger(quantity) || quantity <= 0) throw this._error('SERVER_PRODUCT_QUANTITY_INVALID', `Invalid quantity at items[${index}].`, 400);
      return {
        id: item?.id || `${productId}:${index}`,
        sku: productId,
        productId,
        name: item?.name || null,
        quantity,
        unitPrice: Number(rule.basePrice),
        currency: 'RUB',
        serverProductType: this.productTypes[productId] || 'PRODUCT',
        serverPriceModelId: rule.priceModelId,
      };
    });
  }

  async _repository() {
    if (!this.repositoryPromise) {
      this.repositoryPromise = import(pathToFileURL(this.pricingModulePath).href).then(({ PricingRepository }) => new PricingRepository());
    }
    return this.repositoryPromise;
  }

  _error(code, message, statusCode) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    error.source = 'server_product_pricing';
    return error;
  }
}

module.exports = { ServerProductPricingResolver, DEFAULT_PRODUCT_TYPES };
