'use strict';
const { createHash, randomUUID } = require('node:crypto');
const { createReferralCode } = require('../referral/ReferralService');
const hash = value => createHash('sha256').update(String(value)).digest('hex');
class BotReferralAttributionService {
  constructor({ prisma, scopes = {} }) { this.prisma = prisma; this.scopes = scopes; }
  async getInviteProfile(customerId) {
    if (!customerId) throw Object.assign(new Error('Откройте приглашения после подтверждения профиля.'),{code:'REFERRAL_PROFILE_REQUIRED'});
    const code = createReferralCode(customerId);
    // An untrusted start payload cannot register itself as an invite owner.
    await this.prisma.$executeRawUnsafe('INSERT INTO "BotReferralInvite" ("code","customerId") SELECT $1,"id" FROM "Customer" WHERE "id"=$2 AND "status"=\'active\' AND "phoneVerifiedAt" IS NOT NULL ON CONFLICT DO NOTHING', code, customerId);
    const rows = await this.prisma.$queryRawUnsafe('SELECT "code" FROM "BotReferralInvite" WHERE "customerId"=$1 AND "code"=$2',customerId,code);
    if (!rows.length) throw Object.assign(new Error('Сначала подтвердите профиль, чтобы приглашать друзей.'),{code:'REFERRAL_PROFILE_REQUIRED'});
    return {referralCode:code,startPayload:`ref_${code}`};
  }
  async observe({channel,inbound,identity,startCode=null}) {
    if (!inbound?.externalUserId || !this.scopes[channel]) return;
    if (channel==='telegram' && inbound.metadata?.chatType!=='private') return;
    const scope=channel+':'+hash(this.scopes[channel]);const subjectHash=hash(inbound.externalUserId);
    if (startCode && /^[A-Za-z0-9_-]{1,64}$/.test(startCode)) {
      await this.prisma.$executeRawUnsafe('INSERT INTO "BotReferralIntent" ("scope","subjectHash","code") SELECT $1,$2,"code" FROM "BotReferralInvite" WHERE "code"=$3 ON CONFLICT DO NOTHING',scope,subjectHash,startCode);
    }
    if (!identity?.customerId) return;
    return this.prisma.$transaction(async tx=>{
      await tx.$queryRawUnsafe('SELECT 1 FROM pg_advisory_xact_lock(hashtext($1))','bot-referral:'+identity.customerId);
      const rows=await tx.$queryRawUnsafe('SELECT i."code",l."customerId" AS "referrerId" FROM "BotReferralIntent" i JOIN "BotReferralInvite" l ON l."code"=i."code" JOIN "Customer" c ON c."id"=l."customerId" WHERE i."scope"=$1 AND i."subjectHash"=$2 AND i."appliedAt" IS NULL AND c."status"=\'active\' AND c."phoneVerifiedAt" IS NOT NULL',scope,subjectHash);
      if (!rows.length) return;
      const customer=await tx.customer.findUnique({where:{id:identity.customerId},select:{id:true,status:true,phoneVerifiedAt:true}});
      if (!customer?.phoneVerifiedAt || customer.status!=='active') return;
      const row=rows[0];
      if (row.referrerId!==customer.id) {
        await tx.$executeRawUnsafe('INSERT INTO "Referral" ("id","referrerCustomerId","referredCustomerId","referralCode","status") VALUES ($1,$2,$3,$4,\'registered\') ON CONFLICT ("referredCustomerId") DO NOTHING',randomUUID(),row.referrerId,customer.id,row.code);
      }
      await tx.$executeRawUnsafe('UPDATE "BotReferralIntent" SET "appliedAt"=CURRENT_TIMESTAMP WHERE "scope"=$1 AND "subjectHash"=$2 AND "appliedAt" IS NULL',scope,subjectHash);
    });
  }
}
module.exports={BotReferralAttributionService};
