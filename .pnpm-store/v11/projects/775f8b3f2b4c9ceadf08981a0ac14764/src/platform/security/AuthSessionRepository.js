class AuthSessionRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async createCustomerSession({
    customerId,
    accessTokenHash,
    authMethod,
    consumerType,
    expiresAt,
    correlationId,
  }) {
    return this.prisma.authSession.create({
      data: {
        subjectType: 'user',
        customerId,
        accessTokenHash,
        authMethod,
        consumerType,
        expiresAt,
        correlationId,
      },
    });
  }

  async findValidByAccessTokenHash(accessTokenHash, now = new Date()) {
    return this.prisma.authSession.findFirst({
      where: {
        accessTokenHash,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      include: {
        customer: true,
      },
    });
  }

  async touch(sessionId) {
    return this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        lastSeenAt: new Date(),
      },
    });
  }
}

module.exports = {
  AuthSessionRepository,
};
