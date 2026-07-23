const { ApiError } = require('../../platform/errors/ApiError');
const { sha256 } = require('../../platform/security/hash');
const {
  IDENTITY_PROVIDER,
  SUPPORTED_EXTERNAL_IDENTITY_PROVIDERS,
  normalizePhone,
} = require('./CustomerEntity');

class CustomerService {
  constructor({ customerRepository, auditRepository, identityProviderRegistry, clock = () => new Date() }) {
    this.customerRepository = customerRepository;
    this.auditRepository = auditRepository;
    this.identityProviderRegistry = identityProviderRegistry;
    this.clock = clock;
  }

  async resolveOrCreateTelegramCustomer(telegramIdentity, context) {
    const displayName = buildDisplayName(telegramIdentity.user);
    const existing = await this.customerRepository.findByIdentity(
      IDENTITY_PROVIDER.TELEGRAM,
      telegramIdentity.subjectHash,
    );

    if (existing) {
      const updated = await this.customerRepository.updateExternalIdentitySeen(existing.identity.id, {
        displayName,
        username: telegramIdentity.user.username,
        seenAt: this.clock(),
      });
      return { customer: updated.customer, created: false };
    }

    const created = await this.customerRepository.createTelegramCustomer({
      telegramIdentity,
      displayName,
      sourceChannel: context.sourceChannel,
      now: this.clock(),
    });
    await this.recordIdentityAudit(created.customer.id, created.identity, context, 'telegram_init_data');
    return { customer: created.customer, created: true };
  }

  async getOwnProfile(customerId) {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new ApiError({ statusCode: 404, code: 'RESOURCE_NOT_FOUND', message: 'Customer was not found.', source: 'runtime' });
    }
    return customer;
  }

  async verifyOwnPhone(customerId, request, context) {
    const phone = normalizePhone(request && request.phone);
    if (!phone || !request || typeof request.verification_token !== 'string' || !request.verification_token) {
      throw new ApiError({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Phone and verification_token are required.',
        details: [{ field: 'phone', issue: 'must be a valid E.164 phone number' }],
      });
    }

    const verified = await this.identityProviderRegistry.get(IDENTITY_PROVIDER.PHONE).verify({
      phone,
      verificationToken: request.verification_token,
      customerId,
      correlationId: context.correlationId,
    });
    if (!verified || verified.phone !== phone) {
      throw new ApiError({ statusCode: 401, code: 'PHONE_VERIFICATION_FAILED', message: 'Phone verification failed.', source: 'adapter' });
    }

    const result = await this.customerRepository.setVerifiedPhone(customerId, {
      phone,
      verifiedAt: verified.verifiedAt || this.clock(),
      verificationMethod: verified.verificationMethod || 'phone_otp',
    });
    if (!result) {
      throw new ApiError({ statusCode: 404, code: 'RESOURCE_NOT_FOUND', message: 'Customer was not found.', source: 'runtime' });
    }
    await this.auditRepository.record({
      eventType: 'Customers.PhoneVerified', subjectType: 'user', subjectId: customerId,
      targetType: 'Customer', targetId: customerId, action: 'verify_phone', decision: 'success',
      reasonCode: 'verified_identifier_bound', authMethod: context.authMethod,
      sourceChannel: context.sourceChannel, correlationId: context.correlationId,
      metadata: { verification_method: verified.verificationMethod || 'phone_otp' },
    });
    return result;
  }

  async linkVerifiedExternalIdentity(customerId, provider, providerRequest, context) {
    if (!SUPPORTED_EXTERNAL_IDENTITY_PROVIDERS.includes(provider) || provider === IDENTITY_PROVIDER.TELEGRAM) {
      throw new ApiError({ statusCode: 400, code: 'IDENTITY_PROVIDER_UNSUPPORTED', message: 'Identity provider is unsupported.' });
    }
    const verified = await this.identityProviderRegistry.get(provider).verify(providerRequest);
    if (!verified || !verified.subject) {
      throw new ApiError({ statusCode: 401, code: 'IDENTITY_VERIFICATION_FAILED', message: 'Identity verification failed.', source: 'adapter' });
    }
    const identity = await this.customerRepository.linkExternalIdentity(customerId, {
      provider,
      externalSubjectHash: sha256(String(verified.subject)),
      externalUsername: verified.username || null,
      displayName: verified.displayName || null,
      verificationMethod: verified.verificationMethod || `${provider}_verified_token`,
      sourceChannel: context.sourceChannel,
      now: verified.verifiedAt || this.clock(),
    });
    await this.recordIdentityAudit(customerId, identity, context, identity.verificationMethod);
    return identity;
  }

  async listOwnIdentities(customerId) {
    await this.getOwnProfile(customerId);
    return this.customerRepository.findIdentitiesByCustomerId(customerId);
  }

  async recordIdentityAudit(customerId, identity, context, verificationMethod) {
    await this.auditRepository.record({
      eventType: 'Customers.ExternalIdentityLinked', subjectType: 'user', subjectId: customerId,
      targetType: 'CustomerIdentity', targetId: identity.id, action: 'link', decision: 'success',
      reasonCode: `${identity.provider}_identity_verified`, authMethod: verificationMethod,
      sourceChannel: context.sourceChannel, correlationId: context.correlationId,
      metadata: { provider: identity.provider },
    });
  }
}

function buildDisplayName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || null;
}

module.exports = { CustomerService, buildDisplayName };
