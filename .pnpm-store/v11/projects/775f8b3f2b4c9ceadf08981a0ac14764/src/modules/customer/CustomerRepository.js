const { toCustomerIdentityState } = require('./CustomerEntity');

class CustomerRepository {
  constructor(prisma) { this.prisma = prisma; }

  async findById(customerId) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { identities: true, clubAccount: true },
    });
    return customer ? toCustomerIdentityState(customer) : null;
  }

  async findByIdentity(provider, externalSubjectHash) {
    const identity = await this.prisma.customerIdentity.findUnique({
      where: { provider_externalSubjectHash: { provider, externalSubjectHash } },
      include: { customer: { include: { identities: true, clubAccount: true } } },
    });
    if (!identity || identity.revokedAt) return null;
    return { identity, customer: toCustomerIdentityState(identity.customer) };
  }

  async createTelegramCustomer({ telegramIdentity, displayName, sourceChannel, now = new Date() }) {
    const created = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({ data: { name: displayName || null, status: 'active' } });
      const identity = await tx.customerIdentity.create({
        data: {
          customerId: customer.id, provider: 'telegram', externalSubjectHash: telegramIdentity.subjectHash,
          externalUsername: telegramIdentity.user.username, displayName, verificationMethod: 'telegram_init_data',
          status: 'active', verifiedAt: now, linkedAt: now, lastSeenAt: now, sourceChannel,
        },
      });
      return { customer, identity };
    });
    return { ...created, customer: toCustomerIdentityState({ ...created.customer, identities: [created.identity] }) };
  }

  async updateExternalIdentitySeen(identityId, { displayName, username, seenAt = new Date() }) {
    const identity = await this.prisma.customerIdentity.update({
      where: { id: identityId }, data: { displayName, externalUsername: username, lastSeenAt: seenAt },
      include: { customer: { include: { identities: true, clubAccount: true } } },
    });
    return { identity, customer: toCustomerIdentityState(identity.customer) };
  }

  async setVerifiedPhone(customerId, { phone, verifiedAt }) {
    try {
      const customer = await this.prisma.customer.update({
        where: { id: customerId },
        data: { phone, phoneVerifiedAt: verifiedAt, primaryIdentityProvider: 'phone' },
        include: { identities: true, clubAccount: true },
      });
      return toCustomerIdentityState(customer);
    } catch (error) {
      if (error.code === 'P2002') throw identityConflict('Phone is already bound to another customer.');
      if (error.code === 'P2025') return null;
      throw error;
    }
  }

  async linkExternalIdentity(customerId, identityData) {
    try {
      return await this.prisma.customerIdentity.create({
        data: {
          customerId, provider: identityData.provider, externalSubjectHash: identityData.externalSubjectHash,
          externalUsername: identityData.externalUsername, displayName: identityData.displayName,
          verificationMethod: identityData.verificationMethod, sourceChannel: identityData.sourceChannel,
          verifiedAt: identityData.now, linkedAt: identityData.now, lastSeenAt: identityData.now,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') throw identityConflict('External identity is already bound.');
      throw error;
    }
  }

  findIdentitiesByCustomerId(customerId) {
    return this.prisma.customerIdentity.findMany({
      where: { customerId, revokedAt: null }, orderBy: [{ provider: 'asc' }, { linkedAt: 'asc' }],
    });
  }

}

function identityConflict(message) {
  const error = new Error(message);
  error.statusCode = 409; error.code = 'IDENTITY_CONFLICT'; error.source = 'runtime';
  return error;
}

module.exports = { CustomerRepository };
