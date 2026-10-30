class CustomerRuntime {
  constructor({ customerService, customerRepository, auditRepository, identityProviderRegistry, clock }) {
    this.customerService = customerService || new (require('./CustomerService').CustomerService)({
      customerRepository, auditRepository, identityProviderRegistry, clock,
    });
  }

  resolveOrCreateTelegramCustomer(identity, context) { return this.customerService.resolveOrCreateTelegramCustomer(identity, context); }
  lookupTerminalCustomerByVerifiedPhone(request) { return this.customerService.lookupTerminalCustomerByVerifiedPhone(request); }
  getOwnProfile(customerId) { return this.customerService.getOwnProfile(customerId); }
  verifyOwnPhone(customerId, request, context) { return this.customerService.verifyOwnPhone(customerId, request, context); }
  verifyTelegramBotPhone(customerId, request, context) { return this.customerService.verifyTelegramBotPhone(customerId, request, context); }
  linkVerifiedExternalIdentity(customerId, provider, request, context) { return this.customerService.linkVerifiedExternalIdentity(customerId, provider, request, context); }
  listOwnIdentities(customerId) { return this.customerService.listOwnIdentities(customerId); }
}

module.exports = { CustomerRuntime };
