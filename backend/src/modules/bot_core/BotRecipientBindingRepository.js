'use strict';

class BotRecipientBindingRepository {
  constructor(prisma) {
    if (!prisma) throw new Error('prisma is required.');
    this.prisma = prisma;
    this.persistenceMode = 'POSTGRESQL';
  }

  async upsert(value) {
    try {
      return await this.prisma.botRecipientBinding.upsert({
        where: { customerId_channel: { customerId: value.customerId, channel: value.channel } },
        create: value,
        update: {
          externalSubjectHash: value.externalSubjectHash,
          recipientCiphertext: value.recipientCiphertext,
          recipientType: value.recipientType,
          keyVersion: value.keyVersion,
          status: value.status,
          source: value.source,
          verifiedAt: value.verifiedAt,
          lastSeenAt: value.lastSeenAt,
        },
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        const conflict = new Error('Channel recipient is already bound to another customer.');
        conflict.code = 'BOT_RECIPIENT_BINDING_CONFLICT';
        conflict.statusCode = 409;
        throw conflict;
      }
      throw error;
    }
  }

  findActive(customerId, channel) {
    return this.prisma.botRecipientBinding.findFirst({
      where: { customerId, channel, status: 'ACTIVE' },
    });
  }
}

module.exports = { BotRecipientBindingRepository };
