const crypto = require('node:crypto');
const { ApiError } = require('../../platform/errors/ApiError');
const { ServiceAccountAccess } = require('./ServiceAccountAccess');
const { AuditRepository } = require('../../platform/audit/AuditRepository');
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
const fail = (code, message, statusCode = 403) => new ApiError({ code, message, statusCode });
function deviceInput(input) {
  const metadata = {};
  for (const field of ['manufacturer', 'model', 'androidVersion', 'appVersion']) {
    const value = input?.[field];
    if (typeof value !== 'string' || !value.trim() || value.length > 120) throw fail('SERVICE_DEVICE_INVALID', 'Укажите модель смартфона и версии системы/приложения.', 422);
    metadata[field] = value.trim();
  }
  let key;
  try {
    if (typeof input.publicKey !== 'string' || input.publicKey.length > 4096) throw Error();
    key = crypto.createPublicKey(input.publicKey);
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails.namedCurve !== 'prime256v1') throw Error();
  } catch (_) { throw fail('SERVICE_DEVICE_KEY_INVALID', 'Некорректный ключ устройства.', 422); }
  const publicKey = key.export({ type: 'spki', format: 'pem' });
  return { ...metadata, publicKey, keyFingerprint: hash(key.export({ type: 'spki', format: 'der' })) };
}
class ServiceDeviceBinding {
  constructor({ prisma, clock = () => new Date() }) { this.prisma = prisma; this.clock = clock; this.access = new ServiceAccountAccess({ prisma }); }
  async register(memberId, input, context) {
    const data = deviceInput(input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const scope = await this.access.scope(context, tx);
        const members = await tx.$queryRawUnsafe(`SELECT m."id",m."organizationId" FROM "OrganizationMember" m JOIN "Organization" o ON o."id"=m."organizationId" WHERE m."id"=$1 AND m."status"='ACTIVE' AND m."archivedAt" IS NULL AND o."status"='ACTIVE' AND o."archivedAt" IS NULL FOR UPDATE OF m`, memberId);
        if (!members[0] || (scope && !scope.includes(members[0].organizationId))) throw fail('SERVICE_DEVICE_SCOPE_DENIED', 'Нет прав на привязку смартфона этого сотрудника.');
        const id = crypto.randomUUID();
        await tx.$executeRawUnsafe(`INSERT INTO "ServiceDeviceBinding" ("id","memberId","manufacturer","model","androidVersion","appVersion","publicKey","keyFingerprint","createdBy") VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9::uuid)`, id, memberId, data.manufacturer, data.model, data.androidVersion, data.appVersion, data.publicKey, data.keyFingerprint, context.subject_id);
        await audit(tx, context, id, 'bind_service_device', { member_id: memberId, key_fingerprint: data.keyFingerprint });
        return { id, memberId, manufacturer: data.manufacturer, model: data.model };
      });
    } catch (error) {
      if (error.code === 'P2002' || error.meta?.code === '23505') throw fail('SERVICE_DEVICE_ALREADY_BOUND', 'У сотрудника уже есть привязанный смартфон. Сначала отзовите прежнюю привязку.', 409);
      throw error;
    }
  }
  async revoke(bindingId, reason, context) {
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) throw fail('SERVICE_DEVICE_REASON_REQUIRED', 'Укажите причину замены или отвязки смартфона.', 422);
    return this.prisma.$transaction(async (tx) => {
      const scope = await this.access.scope(context, tx);
      const rows = await tx.$queryRawUnsafe(`SELECT b.*,m."organizationId" FROM "ServiceDeviceBinding" b JOIN "OrganizationMember" m ON m."id"=b."memberId" WHERE b."id"=$1::uuid FOR UPDATE OF b`, bindingId);
      if (!rows[0] || (scope && !scope.includes(rows[0].organizationId))) throw fail('SERVICE_DEVICE_SCOPE_DENIED', 'Нет прав на изменение привязки.');
      await tx.$executeRawUnsafe('UPDATE "ServiceDeviceBinding" SET "revokedAt"=COALESCE("revokedAt",NOW()),"revokedBy"=$2::uuid,"revokeReason"=$3 WHERE "id"=$1::uuid', bindingId, context.subject_id, reason.trim());
      await audit(tx, context, bindingId, 'revoke_service_device', { reason: reason.trim() });
      return { revoked: true };
    });
  }
  async challenge(memberId, { sessionId = null, requestHash = null } = {}) {
    const nonce = crypto.randomBytes(32).toString('base64url'), id = crypto.randomUUID();
    const rows = await this.prisma.$queryRawUnsafe('INSERT INTO "ServiceDeviceProofChallenge" ("id","bindingId","nonceHash","expiresAt","sessionId","requestHash") SELECT $1::uuid,"id",$2,$3,$5::uuid,$6 FROM "ServiceDeviceBinding" WHERE "memberId"=$4 AND "revokedAt" IS NULL RETURNING "bindingId"', id, hash(nonce), new Date(this.clock().getTime() + 60000), memberId, sessionId, requestHash);
    if (!rows.length) throw fail('SERVICE_DEVICE_NOT_BOUND', 'Смартфон сотрудника не зарегистрирован.');
    return { challengeId: id, nonce, signingPayload: `softice-service-device-v1\n${id}\n${nonce}`, expiresInSeconds: 60 };
  }
  async verify(memberId, { challengeId, nonce, signature } = {}, { sessionId = null, requestHash = null } = {}) {
    if (typeof nonce !== 'string' || nonce.length > 100 || typeof signature !== 'string' || signature.length > 256 || !/^[0-9a-f-]{36}$/i.test(challengeId || '')) throw fail('SERVICE_DEVICE_PROOF_INVALID', 'Не удалось подтвердить смартфон.');
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe(`SELECT c.*,b."publicKey",b."memberId",b."revokedAt" FROM "ServiceDeviceProofChallenge" c JOIN "ServiceDeviceBinding" b ON b."id"=c."bindingId" WHERE c."id"=$1::uuid FOR UPDATE OF c,b`, challengeId);
      const proof = rows[0];
      if (!proof || (proof.sessionId || null) !== sessionId || (proof.requestHash || null) !== requestHash || proof.memberId !== memberId || proof.revokedAt || proof.consumedAt || new Date(proof.expiresAt) <= this.clock() || proof.nonceHash !== hash(nonce)) throw fail('SERVICE_DEVICE_PROOF_INVALID', 'Подтверждение смартфона недействительно или истекло.');
      let valid = false;
      try { valid = crypto.verify('sha256', Buffer.from(`softice-service-device-v1\n${challengeId}\n${nonce}`), proof.publicKey, Buffer.from(signature, 'base64')); } catch (_) {}
      if (!valid) throw fail('SERVICE_DEVICE_PROOF_INVALID', 'Подпись смартфона не подтверждена.');
      await tx.$executeRawUnsafe('UPDATE "ServiceDeviceProofChallenge" SET "consumedAt"=NOW() WHERE "id"=$1::uuid', challengeId);
      return { bindingId: proof.bindingId, memberId };
    });
  }
}
function audit(tx, context, targetId, action, metadata) { return new AuditRepository(tx).record({ eventType: 'Admin.ServiceDeviceChanged', subjectType: 'administrator', subjectId: context.subject_id, targetType: 'ServiceDeviceBinding', targetId, action, decision: 'success', authMethod: context.auth_method, sourceChannel: 'admin_console', correlationId: context.correlation_id || crypto.randomUUID(), metadata }); }
module.exports = { ServiceDeviceBinding, deviceInput };
