const { randomUUID } = require('crypto');

class PrivateChannelAccessService {
  constructor({ prisma, adapter = null, adapters = null, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
    this.adapters = adapters || (adapter ? { TELEGRAM: adapter } : {});
    this.clock = clock;
  }

  isConfigured(channelType = 'TELEGRAM') {
    return Boolean(this.adapters[String(channelType).toUpperCase()]?.isConfigured?.());
  }

  async grantForPaidPeriod({ subscriptionId, customerId, channelType = 'TELEGRAM', validFrom, validUntil }) {
    const normalizedChannel = String(channelType || 'TELEGRAM').toUpperCase();
    const adapter = this.#adapter(normalizedChannel);
    const existing = await this.prisma.$queryRawUnsafe(
      'SELECT * FROM "PrivateChannelAccessGrant" WHERE "subscriptionId"=$1 AND "channelType"=$2 AND "validUntil"=$3 AND "status"=\'ACTIVE\' LIMIT 1',
      subscriptionId, normalizedChannel, validUntil,
    );
    if (existing[0]) return { ...existing[0], idempotentReplay: true };

    const id = randomUUID();
    const now = this.clock();
    const provider = normalizedChannel === 'MAX' ? 'MAX_BOT_API' : 'TELEGRAM_BOT_API';
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO "PrivateChannelAccessGrant" ("id","subscriptionId","customerId","channelType","provider","status","validFrom","validUntil","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,\'PENDING\',$6,$7,$8,$8)',
      id, subscriptionId, customerId, normalizedChannel, provider, validFrom, validUntil, now,
    );
    try {
      const access = await adapter.createAccess({ customerId, validUntil });
      await this.prisma.$executeRawUnsafe(
        'UPDATE "PrivateChannelAccessGrant" SET "status"=\'ACTIVE\', "providerChatRef"=$2, "inviteLink"=$3, "grantedAt"=$4, "updatedAt"=$4 WHERE "id"=$1',
        id, access.providerChatRef, access.inviteLink, now,
      );
      return { id, subscriptionId, customerId, channelType: normalizedChannel, status: 'ACTIVE', inviteLink: access.inviteLink, validFrom, validUntil, grantedAt: now, deliveryMode: access.deliveryMode || null };
    } catch (error) {
      await this.prisma.$executeRawUnsafe(
        'UPDATE "PrivateChannelAccessGrant" SET "status"=\'FAILED\', "failureReason"=$2, "updatedAt"=$3 WHERE "id"=$1',
        id, String(error.code || error.message || 'UNKNOWN').slice(0, 500), now,
      );
      throw error;
    }
  }

  async listCustomerAccess(customerId) {
    return this.prisma.$queryRawUnsafe(
      'SELECT "id","subscriptionId","channelType","provider","status","providerChatRef","inviteLink","validFrom","validUntil","grantedAt","revokedAt","failureReason" FROM "PrivateChannelAccessGrant" WHERE "customerId"=$1 ORDER BY "createdAt" DESC',
      customerId,
    );
  }

  async expireSubscriptionAccess({ subscriptionId, channelType }) {
    const normalizedChannel = String(channelType || 'TELEGRAM').toUpperCase();
    const now = this.clock();
    const rows = await this.prisma.$queryRawUnsafe(
      'SELECT * FROM "PrivateChannelAccessGrant" WHERE "subscriptionId"=$1 AND "channelType"=$2 AND "status"=\'ACTIVE\' ORDER BY "createdAt" DESC',
      subscriptionId, normalizedChannel,
    );
    const adapter = this.adapters[normalizedChannel];
    const results = [];
    for (const row of rows) {
      let inviteRevoked = false;
      let providerError = null;
      if (adapter?.revokeAccess && row.inviteLink) {
        try {
          const outcome = await adapter.revokeAccess(row.inviteLink);
          inviteRevoked = Boolean(outcome?.revoked);
        } catch (error) {
          providerError = error.code || error.message;
        }
      }
      // Revoking an invite link does not prove that an already joined subscriber
      // was removed. Until a verified provider identity/removal flow exists, keep
      // the evidence conservative and mark the grant EXPIRED rather than REMOVED.
      const reason = providerError
        ? `PROVIDER_EXPIRY_FAILED:${providerError}`
        : inviteRevoked
          ? 'INVITE_REVOKED_MEMBERSHIP_REMOVAL_NOT_CONFIRMED'
          : 'MEMBERSHIP_REMOVAL_NOT_CONFIRMED';
      await this.prisma.$executeRawUnsafe(
        'UPDATE "PrivateChannelAccessGrant" SET "status"=\'EXPIRED\', "revokedAt"=$2, "failureReason"=$3, "updatedAt"=$2 WHERE "id"=$1',
        row.id, now, reason.slice(0, 500),
      );
      results.push({ id: row.id, channelType: normalizedChannel, expired: true, inviteRevoked, membershipRemovalConfirmed: false, providerError });
    }
    return { subscriptionId, channelType: normalizedChannel, results };
  }

  async revokeExpired() {
    const now = this.clock();
    const rows = await this.prisma.$queryRawUnsafe(
      'SELECT DISTINCT "subscriptionId","channelType" FROM "PrivateChannelAccessGrant" WHERE "status"=\'ACTIVE\' AND "validUntil" <= $1 ORDER BY "subscriptionId" LIMIT 100',
      now,
    );
    const results = [];
    for (const row of rows) results.push(await this.expireSubscriptionAccess(row));
    return results;
  }

  #adapter(channelType) {
    const adapter = this.adapters[channelType];
    if (!adapter) throw new Error(`Private channel access adapter is required for ${channelType}`);
    return adapter;
  }
}

module.exports = { PrivateChannelAccessService };
