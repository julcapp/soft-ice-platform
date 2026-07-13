class CustomerRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async findById(customerId) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        identities: true,
        clubAccount: true,
      },
    });

    return customer ? markTelegramLinked(customer) : null;
  }

  async findByIdentity(provider, externalSubjectHash) {
    const identity = await this.prisma.customerIdentity.findUnique({
      where: {
        provider_externalSubjectHash: {
          provider,
          externalSubjectHash,
        },
      },
      include: {
        customer: {
          include: {
            identities: true,
            clubAccount: true,
          },
        },
      },
    });

    if (!identity || identity.revokedAt) {
      return null;
    }

    return {
      identity,
      customer: markTelegramLinked(identity.customer),
    };
  }

  async createTelegramCustomer({ telegramIdentity, displayName, sourceChannel }) {
    const now = new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          name: displayName || null,
          status: 'active',
        },
      });

      const identity = await tx.customerIdentity.create({
        data: {
          customerId: customer.id,
          provider: 'telegram',
          externalSubjectHash: telegramIdentity.subjectHash,
          externalUsername: telegramIdentity.user.username,
          displayName,
          verificationMethod: 'telegram_init_data',
          status: 'active',
          verifiedAt: now,
          linkedAt: now,
          lastSeenAt: now,
          sourceChannel,
        },
      });

      return {
        customer,
        identity,
      };
    });

    return {
      ...created,
      customer: markTelegramLinked({
        ...created.customer,
        identities: [created.identity],
      }),
    };
  }

  async updateTelegramIdentitySeen(identityId, { displayName, username }) {
    const identity = await this.prisma.customerIdentity.update({
      where: { id: identityId },
      data: {
        displayName,
        externalUsername: username,
        lastSeenAt: new Date(),
      },
      include: {
        customer: {
          include: {
            identities: true,
            clubAccount: true,
          },
        },
      },
    });

    return {
      identity,
      customer: markTelegramLinked(identity.customer),
    };
  }
}

function markTelegramLinked(customer) {
  return {
    ...customer,
    telegramLinked: Boolean(
      customer.identities &&
        customer.identities.some(
          (identity) => identity.provider === 'telegram' && !identity.revokedAt,
        ),
    ),
  };
}

module.exports = {
  CustomerRepository,
};
