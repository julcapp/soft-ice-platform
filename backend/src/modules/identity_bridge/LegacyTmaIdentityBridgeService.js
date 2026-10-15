const { ApiError } = require('../../platform/errors/ApiError');
const { sha256 } = require('../../platform/security/hash');

class LegacyTmaIdentityBridgeService {
  constructor({ prisma, customerRepository, clubAccountRuntime, auditRepository, clock = () => new Date() }) {
    this.prisma = prisma;
    this.customerRepository = customerRepository;
    this.clubAccountRuntime = clubAccountRuntime;
    this.auditRepository = auditRepository;
    this.clock = clock;
  }

  async resolve(input = {}, context = {}) {
    const provider = normalizeProvider(input.provider);
    const subject = normalizeSubject(input.subject);
    const username = clean(input.username, 128);
    const displayName = clean(input.displayName, 160);
    const now = this.clock();
    const hashes = identityHashes(provider, subject);

    const identities = await this.prisma.customerIdentity.findMany({
      where: {
        provider,
        externalSubjectHash: { in: [...new Set(hashes.all)] },
        revokedAt: null,
      },
      include: { customer: true },
    });

    const customerIds = [...new Set(identities.map((row) => row.customerId))];
    if (customerIds.length > 1) {
      await this.auditRepository.record({
        eventType: 'IdentityBridge.Conflict',
        subjectType: 'user_alias',
        subjectId: null,
        targetType: 'CustomerIdentity',
        targetId: identities[0]?.id || null,
        action: 'resolve',
        decision: 'deny',
        reasonCode: 'identity_hashes_bound_to_multiple_customers',
        authMethod: 'legacy_tma_hmac_bridge',
        sourceChannel: 'legacy_tma',
        correlationId: context.correlationId,
        metadata: { provider, identity_count: identities.length, customer_count: customerIds.length },
      });
      throw new ApiError({
        statusCode: 409,
        code: 'IDENTITY_BRIDGE_CONFLICT',
        message: 'Verified messenger identity is linked to multiple customer profiles.',
        source: 'runtime',
      });
    }

    let customer;
    let identity;
    let created = false;

    if (identities.length) {
      identity = choosePreferredIdentity(identities, hashes.canonical);
      await this.prisma.customerIdentity.update({
        where: { id: identity.id },
        data: {
          externalUsername: username ?? identity.externalUsername,
          displayName: displayName ?? identity.displayName,
          lastSeenAt: now,
          status: 'active',
        },
      });
      customer = await this.customerRepository.findById(identity.customerId);
    } else {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const createdCustomer = await tx.customer.create({
            data: {
              name: displayName,
              status: 'active',
              primaryIdentityProvider: provider,
              ...(provider === 'telegram' ? { telegramUsername: username } : {}),
            },
          });
          const createdIdentity = await tx.customerIdentity.create({
            data: {
              customerId: createdCustomer.id,
              provider,
              externalSubjectHash: hashes.canonical,
              externalUsername: username,
              displayName,
              verificationMethod: 'legacy_tma_' + provider + '_verified_init_data',
              sourceChannel: provider === 'telegram' ? 'telegram_mini_app_legacy' : 'max_mini_app_legacy',
              verifiedAt: now,
              linkedAt: now,
              lastSeenAt: now,
              status: 'active',
            },
          });
          return { customer: createdCustomer, identity: createdIdentity };
        });
        created = true;
        identity = result.identity;
        customer = await this.customerRepository.findById(result.customer.id);
      } catch (error) {
        if (error?.code !== 'P2002') throw error;
        const retry = await this.prisma.customerIdentity.findFirst({
          where: { provider, externalSubjectHash: { in: [...new Set(hashes.all)] }, revokedAt: null },
        });
        if (!retry) throw error;
        identity = retry;
        customer = await this.customerRepository.findById(retry.customerId);
      }
    }

    if (!customer) {
      throw new ApiError({ statusCode: 404, code: 'IDENTITY_BRIDGE_CUSTOMER_NOT_FOUND', message: 'Customer profile was not found.', source: 'runtime' });
    }

    const club = await this.clubAccountRuntime.ensureAccountForCustomer(customer, {
      correlationId: context.correlationId,
      sourceChannel: provider === 'telegram' ? 'telegram_mini_app_legacy' : 'max_mini_app_legacy',
      authMethod: 'legacy_tma_hmac_bridge',
    });

    await this.auditRepository.record({
      eventType: created ? 'IdentityBridge.CustomerCreated' : 'IdentityBridge.CustomerResolved',
      subjectType: 'user',
      subjectId: customer.id,
      targetType: 'CustomerIdentity',
      targetId: identity.id,
      action: 'resolve',
      decision: 'success',
      reasonCode: created ? 'verified_identity_created' : 'verified_identity_resolved',
      authMethod: 'legacy_tma_hmac_bridge',
      sourceChannel: 'legacy_tma',
      correlationId: context.correlationId,
      metadata: {
        provider,
        identity_format: identity.externalSubjectHash === hashes.canonical ? 'canonical' : 'legacy_compatible',
        club_account_created: Boolean(club.created),
      },
    });

    return {
      customerId: customer.id,
      identityId: identity.id,
      provider,
      created,
      clubAccountId: club.clubAccount?.id || null,
      identityFormat: identity.externalSubjectHash === hashes.canonical ? 'canonical' : 'legacy_compatible',
    };
  }
}

function identityHashes(provider, subject) {
  if (provider === 'telegram') {
    const canonical = sha256('telegram:' + subject);
    return { canonical, all: [canonical, sha256(subject)] };
  }
  const canonical = sha256(subject);
  return { canonical, all: [canonical, sha256('max:' + subject)] };
}

function choosePreferredIdentity(rows, canonical) {
  return rows.find((row) => row.externalSubjectHash === canonical) || rows[0];
}

function normalizeProvider(value) {
  const provider = String(value || '').trim().toLowerCase();
  if (!['telegram', 'max'].includes(provider)) {
    throw new ApiError({ statusCode: 400, code: 'IDENTITY_BRIDGE_PROVIDER_INVALID', message: 'Provider must be telegram or max.', source: 'runtime' });
  }
  return provider;
}

function normalizeSubject(value) {
  const subject = String(value ?? '').trim();
  if (!/^\d{1,30}$/.test(subject)) {
    throw new ApiError({ statusCode: 400, code: 'IDENTITY_BRIDGE_SUBJECT_INVALID', message: 'Messenger subject is invalid.', source: 'runtime' });
  }
  return subject;
}

function clean(value, max) {
  const result = typeof value === 'string' ? value.trim() : '';
  return result ? result.slice(0, max) : null;
}

module.exports = { LegacyTmaIdentityBridgeService, identityHashes };
