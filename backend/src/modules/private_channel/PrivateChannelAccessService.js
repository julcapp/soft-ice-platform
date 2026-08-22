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

  async revokeExpired() {
    const now = this.clock();
    const rows = await this.prisma.$queryRawUnsafe(
      'SELECT * FROM "PrivateChannelAccessGrant" WHERE "status"=\'ACTIVE\' AND "validUntil" <= $1 ORDER BY "validUntil" ASC LIMIT 100',
      now,
    );
    const results = [];
    for (const row of rows) {
      const adapter = this.adapters[String(row.channelType).toUpperCase()];
      if (!adapter) { results.push({ id: row.id, revoked: false, error: 'ACCESS_ADAPTER_NOT_CONFIGURED' }); continue; }
      try {
        // Telegram can revoke the invite link itself. MAX requires a known MAX user id
        // to remove an already joined subscriber; until identity binding exists we only
        // expire our own grant and keep an operational follow-up marker.
        if (String(row.channelType).toUpperCase() === 'MAX') {
          await this.prisma.$executeRawUnsafe('UPDATE "PrivateChannelAccessGrant" SET "status"=\'EXPIRED\', "updatedAt"=$2 WHERE "id"=$1', row.id, now);
          results.push({ id: row.id, revoked: false, expired: true, requiresProviderIdentity: true });
          continue;
        }
        await adapter.revokeAccess(row.inviteLink);
        await this.prisma.$executeRawUnsafe('UPDATE "PrivateChannelAccessGrant" SET "status"=\'REVOKED\', "revokedAt"=$2, "updatedAt"=$2 WHERE "id"=$1', row.id, now);
        results.push({ id: row.id, revoked: true });
      } catch (error) {
        results.push({ id: row.id, revoked: false, error: error.code || error.message });
      }
    }
    return results;
  }

  #adapter(channelType) {
    const adapter = this.adapters[channelType];
    if (!adapter) throw new Error(`Private channel access adapter is required for ${channelType}`);
    return adapter;
  }
}

module.exports = { PrivateChannelAccessService };
