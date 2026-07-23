const { ApiError } = require('../../platform/errors/ApiError');

class CustomerIdentityProvider {
  constructor(provider) {
    this.provider = provider;
  }

  async verify() {
    throw new ApiError({
      statusCode: 503,
      code: 'IDENTITY_PROVIDER_UNAVAILABLE',
      message: `${this.provider} identity verification is not configured.`,
      source: 'adapter',
      retryable: false,
    });
  }
}

class CustomerIdentityProviderRegistry {
  constructor(providers = []) {
    this.providers = new Map(providers.map((provider) => [provider.provider, provider]));
  }

  get(providerName) {
    return this.providers.get(providerName) || new CustomerIdentityProvider(providerName);
  }
}

module.exports = {
  CustomerIdentityProvider,
  CustomerIdentityProviderRegistry,
};
