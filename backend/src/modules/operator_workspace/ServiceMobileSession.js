const crypto = require('node:crypto');
const { ApiError } = require('../../platform/errors/ApiError');
const hash = (v) => crypto.createHash('sha256').update(v).digest('hex');
const { AuditRepository } = require('../../platform/audit/AuditRepository');
const STAFF = ['SERVICE_SPECIALIST', 'MACHINE_RESPONSIBLE'];
const denied = () => new ApiError({ statusCode: 401, code: 'MOBILE_SERVICE_DENIED', message: 'Войдите с зарегистрированного смартфона и выберите доступную роль.' });
const requestHash = (method, path, body = Buffer.alloc(0)) => hash(`${method.toUpperCase()}\n${path}\n${hash(body)}`);
class ServiceMobileSession {
  constructor({ prisma, adminAuthService, deviceBinding }) { Object.assign(this, { prisma, auth: adminAuthService, devices: deviceBinding }); }
  async login(input) {
    const login = await this.auth.login(input);
    let context;
    try { context = await this.auth.authenticate(login.token); }
    finally { await this.auth.logout(login.token, { correlationId: input.correlationId }); }
    if (!context.organization_member_id || !context.roles.length || context.roles.some((r) => !STAFF.includes(r))) throw denied();
    const token = crypto.randomBytes(32).toString('base64url');
    const rows = await this.prisma.$queryRawUnsafe(`INSERT INTO "ServiceMobileSession" ("id","adminUserId","bindingId","tokenHash","expiresAt") SELECT $1::uuid,$2::uuid,b."id",$3,NOW()+INTERVAL '8 hours' FROM "ServiceDeviceBinding" b WHERE b."memberId"=$4 AND b."revokedAt" IS NULL RETURNING "id"`, crypto.randomUUID(), context.subject_id, hash(token), context.organization_member_id);
    if (!rows.length) throw denied();
    const session = await this.session(token);
    return { token, roles: session.availableRoles, activeRole: null, requiresDeviceProof: true };
  }
  async session(token) {
    if (typeof token !== 'string' || token.length > 256 || !token) throw denied();
    const rows = await this.prisma.$queryRawUnsafe(`SELECT s.*,b."memberId",u."roles" AS "accountRoles",ARRAY(SELECT DISTINCT r."role"::text FROM "OrganizationRoleAssignment" r WHERE r."memberId"=m."id" AND r."organizationId"=m."organizationId" AND r."revokedAt" IS NULL AND r."role" IN ('SERVICE_SPECIALIST','MACHINE_RESPONSIBLE')) AS "availableRoles" FROM "ServiceMobileSession" s JOIN "ServiceDeviceBinding" b ON b."id"=s."bindingId" AND b."revokedAt" IS NULL JOIN "AdminUser" u ON u."id"=s."adminUserId" AND u."status"='ACTIVE' AND u."organizationMemberId"=b."memberId" JOIN "OrganizationMember" m ON m."id"=b."memberId" AND m."status"='ACTIVE' AND m."archivedAt" IS NULL JOIN "Organization" o ON o."id"=m."organizationId" AND o."status"='ACTIVE' AND o."archivedAt" IS NULL WHERE s."tokenHash"=$1 AND s."revokedAt" IS NULL AND s."expiresAt">NOW() AND (u."passwordChangedAt" IS NULL OR s."createdAt">=u."passwordChangedAt")`, hash(token));
    const s = rows[0];
    if (!s || !s.accountRoles?.length || s.accountRoles.some((r) => !STAFF.includes(r)) || !s.availableRoles?.length || (s.activeRole && !s.availableRoles.includes(s.activeRole))) throw denied();
    return s;
  }
  async challenge(token, { method, path, bodyHash }) {
    const session = await this.session(token);
    if (typeof method !== 'string' || !['GET','POST','PUT','DELETE'].includes(method.toUpperCase()) || typeof path !== 'string' || !path.startsWith('/api/v1/mobile-service/') || path.length > 2048 || !/^[a-f0-9]{64}$/.test(bodyHash || '')) throw denied();
    return this.devices.challenge(session.memberId, { sessionId: session.id, requestHash: hash(`${method.toUpperCase()}\n${path}\n${bodyHash}`) });
  }
  async authenticate(token, proof, method, path, body) {
    const s = await this.session(token);
    const device = await this.devices.verify(s.memberId, proof, { sessionId: s.id, requestHash: requestHash(method, path, body) });
    if (device.bindingId !== s.bindingId) throw denied();
    return { subject_type: 'administrator', subject_id: s.adminUserId, organization_member_id: s.memberId, auth_method: 'password', roles: s.activeRole ? [s.activeRole] : [], active_service_role: s.activeRole, mobile_session_id: s.id, device_binding_id: s.bindingId, available_roles: s.availableRoles };
  }
  async logout(context) {
    await this.prisma.$executeRawUnsafe('UPDATE "ServiceMobileSession" SET "revokedAt"=NOW() WHERE "id"=$1::uuid', context.mobile_session_id);
    return { loggedOut: true };
  }
  async selectRole(context, role) {
    if (!context.available_roles.includes(role)) throw denied();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('UPDATE "ServiceMobileSession" SET "activeRole"=$2 WHERE "id"=$1::uuid AND "revokedAt" IS NULL', context.mobile_session_id, role);
      await new AuditRepository(tx).record({ eventType:'Service.MobileRoleSelected', subjectType:'administrator', subjectId:context.subject_id, targetType:'ServiceMobileSession',targetId:context.mobile_session_id,action:'select_service_role',decision:'success',authMethod:'device_key',sourceChannel:'mobile_service',correlationId:context.correlation_id || crypto.randomUUID(),metadata:{role,binding_id:context.device_binding_id} });
    });
    return { activeRole: role };
  }
}
module.exports = { ServiceMobileSession, requestHash };
