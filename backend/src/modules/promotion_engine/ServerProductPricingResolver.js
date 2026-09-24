'use strict';

class ServerProductPricingResolver {
  constructor({ catalogService } = {}) {
    if (!catalogService) throw new Error('Catalog service is required for authoritative server pricing.');
    this.catalogService = catalogService;
  }

  resolveItems(items = [], { machineId } = {}) {
    return this.catalogService.resolvePricedItems(machineId, items);
  }
}

module.exports = { ServerProductPricingResolver };
