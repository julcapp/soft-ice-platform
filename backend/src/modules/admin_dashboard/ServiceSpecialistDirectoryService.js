class ServiceSpecialistDirectoryService {
  constructor({ prisma }) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
  }

  async getByMemberId(memberId) {
    const id = String(memberId || '').trim();
    if (!id) return null;
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT m."id" AS "memberId",m."fullName",m."position",m."phone",m."email",m."status",m."platformUserId",
              c."telegramId",c."telegramUsername",c."vkProfile"
       FROM "OrganizationMember" m
       LEFT JOIN "Customer" c ON c."id"=m."platformUserId"
       WHERE m."id"=$1 LIMIT 1`, id,
    );
    const row = rows[0];
    if (!row) return null;
    const channels = row.platformUserId
      ? await this.prisma.$queryRawUnsafe(
        `SELECT "channelType","externalUserId","username","profileUrl","displayName","isVerified","status","lastCheckedAt"
         FROM "CustomerExternalProfile" WHERE "customerId"=$1 ORDER BY "channelType","updatedAt" DESC`, row.platformUserId,
      ) : [];
    return specialistCard(row, channels);
  }

  async getBySubject(subject) {
    const value = String(subject || '').trim();
    if (!value) return null;
    const memberId = value.startsWith('organization-member:') ? value.slice('organization-member:'.length) : null;
    if (memberId) return this.getByMemberId(memberId);
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT "id" FROM "OrganizationMember" WHERE "platformUserId"=$1 AND "status"='ACTIVE' ORDER BY "updatedAt" DESC LIMIT 1`, value,
    );
    return rows[0] ? this.getByMemberId(rows[0].id) : null;
  }
}

function specialistCard(row, externalProfiles = []) {
  const byChannel = new Map();
  for (const profile of externalProfiles) if (!byChannel.has(String(profile.channelType || '').toUpperCase())) byChannel.set(String(profile.channelType || '').toUpperCase(), profile);
  const telegram = byChannel.get('TELEGRAM');
  const max = byChannel.get('MAX');
  const vk = byChannel.get('VK');
  return {
    memberId: row.memberId,
    platformUserId: row.platformUserId || null,
    fullName: row.fullName,
    position: row.position || 'Сервисный специалист / техник-мастер',
    phone: row.phone || null,
    email: row.email || null,
    status: row.status,
    channels: {
      telegram: channelCard(telegram, row.telegramId, row.telegramUsername),
      max: channelCard(max),
      vk: channelCard(vk, null, null, row.vkProfile),
    },
  };
}

function channelCard(profile, fallbackId = null, fallbackUsername = null, fallbackUrl = null) {
  return {
    userId: profile?.externalUserId || fallbackId || null,
    username: profile?.username || fallbackUsername || null,
    profileUrl: profile?.profileUrl || fallbackUrl || null,
    displayName: profile?.displayName || null,
    verified: Boolean(profile?.isVerified),
    status: profile?.status || (fallbackId || fallbackUsername || fallbackUrl ? 'KNOWN' : 'NOT_LINKED'),
    lastCheckedAt: profile?.lastCheckedAt || null,
  };
}

module.exports = { ServiceSpecialistDirectoryService, specialistCard };
