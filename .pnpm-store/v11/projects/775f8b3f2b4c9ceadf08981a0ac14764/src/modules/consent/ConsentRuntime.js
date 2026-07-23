const { ConsentService } = require('./ConsentService');

class ConsentRuntime {
  constructor(options) { this.consentService = options.consentService || new ConsentService(options); }
  recordOwnConsent(customerId, request, context) { return this.consentService.record(customerId, request, context); }
  listOwnConsents(customerId) { return this.consentService.history(customerId); }
}

module.exports = { ConsentRuntime };
