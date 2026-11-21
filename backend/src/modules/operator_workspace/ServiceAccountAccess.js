const crypto = require('node:crypto');
const { ApiError } = require('../../platform/errors/ApiError');
const { AuditRepository } = require('../../platform/audit/AuditRepository');
const { hashPassword } = require('../../platform/security/AdminAuthService');
const { normalizePersonName } = require('../../platform/validation/personName');
const STAFF = ['SERVICE_SPECIALIST', 'MACHINE_RESPONSIBLE'];
class ServiceAccountAccess {
  constructor({ prisma }) { this.prisma = prisma; }
  async scope(context, db = this.prisma) {
    if (context?.auth_method !== 'password') throw denied();
    const users = await db.$queryRawUnsafe('SELECT "roles","organizationMemberId" FROM "AdminUser" WHERE "id"=$1::uuid AND "status"=\'ACTIVE\'', context.subject_id);
    const user = users[0];
    if (!user) throw denied();
    if (user.roles.some((role) => ['PLATFORM_OWNER', 'ADMIN'].includes(role))) return null;
    if (!user.organizationMemberId || !user.roles.includes('ORGANIZATION_ADMIN')) throw denied();
    const orgs = await db.$queryRawUnsafe(`SELECT DISTINCT m."organizationId" FROM "OrganizationMember" m JOIN "OrganizationRoleAssignment" r ON r."memberId"=m."id" AND r."organizationId"=m."organizationId" JOIN "Organization" o ON o."id"=m."organizationId" WHERE m."id"=$1 AND m."status"='ACTIVE' AND m."archivedAt" IS NULL AND o."status"='ACTIVE' AND o."archivedAt" IS NULL AND r."revokedAt" IS NULL AND r."role" IN ('OWNER','ADMINISTRATOR')`, user.organizationMemberId);
    if (!orgs.length) throw denied();
    return orgs.map((org) => org.organizationId);
  }
  async list(context) {
    const scope = await this.scope(context);
    const orgs = await this.prisma.$queryRawUnsafe(`SELECT "id","shortName" FROM "Organization" WHERE "status"='ACTIVE' AND "archivedAt" IS NULL AND ($1::text[] IS NULL OR "id"=ANY($1::text[])) ORDER BY "shortName"`, scope);
    const ids = orgs.map((org) => org.id);
    const users = await this.prisma.$queryRawUnsafe(`SELECT u."id",u."login",u."displayName",u."roles",u."organizationMemberId" FROM "AdminUser" u LEFT JOIN "OrganizationMember" m ON m."id"=u."organizationMemberId" WHERE u."status"='ACTIVE' AND cardinality(u."roles")=1 AND u."roles"<@ARRAY['SERVICE_SPECIALIST','MACHINE_RESPONSIBLE']::text[] AND ($1::boolean OR m."organizationId"=ANY($2::text[])) ORDER BY u."login"`, scope === null, ids);
    const members = await this.prisma.$queryRawUnsafe(`SELECT m."id",m."fullName",m."organizationId",ARRAY(SELECT DISTINCT r."role"::text FROM "OrganizationRoleAssignment" r WHERE r."memberId"=m."id" AND r."organizationId"=m."organizationId" AND r."revokedAt" IS NULL AND r."role" IN ('SERVICE_SPECIALIST','MACHINE_RESPONSIBLE')) AS roles FROM "OrganizationMember" m WHERE m."organizationId"=ANY($1::text[]) AND m."status"='ACTIVE' AND m."archivedAt" IS NULL ORDER BY m."fullName"`, ids);
    const assignments = await this.prisma.$queryRawUnsafe(`SELECT a."id",a."organizationId",a."machineId",a."serviceSpecialistId",a."responsibleMemberId",m."machineCode",m."name" FROM "OrganizationMachineAssignment" a JOIN "Machine" m ON m."id"=a."machineId" WHERE a."organizationId"=ANY($1::text[]) AND a."unassignedAt" IS NULL ORDER BY m."machineCode"`, ids);
    return { organizations: orgs, users, members, assignments };
  }
  async createStaff(input, context) {
    await this.scope(context);
    const { organizationId, role, userId, memberId } = input || {};
    const fullName = normalizePersonName(typeof input?.fullName === 'string' ? input.fullName : '');
    const login = String(input?.login || '').trim().toLowerCase();
    if (!STAFF.includes(role) || (!memberId && (!fullName || fullName.length > 200)) || !organizationId || (!userId && (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(login) || typeof input.password !== 'string' || input.password.length < 9 || input.password.length > 128))) {
      throw new ApiError({ statusCode: 422, code: 'SERVICE_STAFF_INVALID', message: 'Укажите организацию, ФИО, роль, логин (3–64 латинских символа) и пароль (9–128 символов).' });
    }
    const passwordHash = userId ? null : await hashPassword(input.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const scope = await this.scope(context, tx);
        if (scope && !scope.includes(organizationId)) throw denied();
        const org = await tx.organization.findFirst({ where: { id: organizationId, status: 'ACTIVE', archivedAt: null } });
        if (!org) throw denied();
        let user;
        if (userId) {
          const rows = await tx.$queryRawUnsafe('SELECT "id","roles","organizationMemberId" FROM "AdminUser" WHERE "id"=$1::uuid AND "status"=\'ACTIVE\' FOR UPDATE', userId);
          user = rows[0];
          if (scope || !user || user.organizationMemberId || user.roles.length !== 1 || user.roles[0] !== role) throw denied();
        }
        let member;
        if (memberId) {
          const rows = await tx.$queryRawUnsafe('SELECT "id","organizationId","fullName" FROM "OrganizationMember" WHERE "id"=$1 AND "status"=\'ACTIVE\' AND "archivedAt" IS NULL FOR UPDATE', memberId);
          member = rows[0];
          if (!member || member.organizationId !== organizationId) throw denied();
        }
        if (!userId) {
          const duplicate = await tx.$queryRawUnsafe('SELECT "id" FROM "AdminUser" WHERE lower("login")=$1', login);
          if (duplicate.length) throw new ApiError({ statusCode: 409, code: 'SERVICE_LOGIN_EXISTS', message: 'Этот логин уже занят. Укажите другой.' });
          const rows = await tx.$queryRawUnsafe('INSERT INTO "AdminUser" ("login","displayName","passwordHash","roles","status") VALUES ($1,$2,$3,ARRAY[$4]::text[],\'ACTIVE\') RETURNING "id"', login, member?.fullName || fullName, passwordHash, role);
          user = rows[0];
        }
        if (!member) member = await tx.organizationMember.create({ data: { organizationId, fullName, position: role === 'SERVICE_SPECIALIST' ? 'Техник' : 'Мастер' } });
        await ensureStaffRole(tx, member, role, context);
        await tx.$executeRawUnsafe('UPDATE "AdminUser" SET "organizationMemberId"=$2,"updatedAt"=NOW() WHERE "id"=$1::uuid', user.id, member.id);
        await record(tx, context, user.id, 'create_service_employee', { organization_id: organizationId, member_id: member.id, role });
        return { userId: user.id, memberId: member.id };
      });
    } catch (error) {
      if (error.code === 'P2002' || error.meta?.code === '23505') throw new ApiError({ statusCode: 409, code: 'SERVICE_LOGIN_EXISTS', message: 'Логин уже занят. Данные не сохранены.' });
      throw error;
    }
  }
  async bind(userId, memberId, context, { grantRole = false } = {}) {
    return this.prisma.$transaction(async (tx) => {
      const scope = await this.scope(context, tx);
      const users = await tx.$queryRawUnsafe('SELECT "id","roles","organizationMemberId" FROM "AdminUser" WHERE "id"=$1::uuid AND "status"=\'ACTIVE\' FOR UPDATE', userId);
      const user = users[0];
      if (!user || user.roles.length !== 1 || !STAFF.includes(user.roles[0])) throw denied();
      const members = await tx.$queryRawUnsafe(`SELECT m."id",m."organizationId" FROM "OrganizationMember" m JOIN "Organization" o ON o."id"=m."organizationId" WHERE m."id"=$1 AND m."status"='ACTIVE' AND m."archivedAt" IS NULL AND o."status"='ACTIVE' AND o."archivedAt" IS NULL FOR UPDATE OF m`, memberId);
      const member = members[0], orgId = member?.organizationId;
      if (!orgId || (scope && !scope.includes(orgId))) throw denied();
      if (scope) {
        const old = await tx.$queryRawUnsafe('SELECT "organizationId" FROM "OrganizationMember" WHERE "id"=$1', user.organizationMemberId);
        if (!old[0] || !scope.includes(old[0].organizationId)) throw denied();
      }
      const role = await tx.organizationRoleAssignment.findFirst({ where: { memberId, organizationId: orgId, role: user.roles[0], revokedAt: null } });
      if (!role && grantRole !== true) throw denied();
      if (!role) await ensureStaffRole(tx, member, user.roles[0], context);
      await tx.$executeRawUnsafe('UPDATE "AdminUser" SET "organizationMemberId"=$2,"updatedAt"=NOW() WHERE "id"=$1::uuid', userId, memberId);
      await record(tx, context, userId, 'bind_service_account', { organization_id: orgId, member_id: memberId, role: user.roles[0], role_granted: !role });
      return { updated: true };
    });
  }
  async assign(userId, assignmentId, assigned, context) {
    if (typeof assigned !== 'boolean') throw denied();
    return this.prisma.$transaction(async (tx) => {
      const scope = await this.scope(context, tx);
      const users = await tx.$queryRawUnsafe('SELECT "roles","organizationMemberId" FROM "AdminUser" WHERE "id"=$1::uuid AND "status"=\'ACTIVE\' FOR UPDATE', userId);
      const user = users[0];
      if (!user || user.roles.length !== 1 || !STAFF.includes(user.roles[0]) || !user.organizationMemberId) throw denied();
      const members = await tx.$queryRawUnsafe(`SELECT m."organizationId" FROM "OrganizationMember" m JOIN "OrganizationRoleAssignment" r ON r."memberId"=m."id" AND r."organizationId"=m."organizationId" WHERE m."id"=$1 AND m."status"='ACTIVE' AND m."archivedAt" IS NULL AND r."role"::text=$2 AND r."revokedAt" IS NULL`, user.organizationMemberId, user.roles[0]);
      const assignments = await tx.$queryRawUnsafe('SELECT * FROM "OrganizationMachineAssignment" WHERE "id"=$1 AND "unassignedAt" IS NULL FOR UPDATE', assignmentId);
      const a = assignments[0], orgId = members[0]?.organizationId;
      if (!a || a.organizationId !== orgId || (scope && !scope.includes(orgId))) throw denied();
      const field = user.roles[0] === 'SERVICE_SPECIALIST' ? 'serviceSpecialistId' : 'responsibleMemberId';
      if (assigned && a[field] && a[field] !== user.organizationMemberId) throw new ApiError({ statusCode: 409, code: 'SERVICE_ASSIGNMENT_BUSY', message: 'У аппарата уже назначен другой сотрудник этой роли. Сначала отзовите его назначение.' });
      if (!assigned && a[field] !== user.organizationMemberId) throw denied();
      await tx.$executeRawUnsafe(`UPDATE "OrganizationMachineAssignment" SET "${field}"=$2 WHERE "id"=$1`, assignmentId, assigned ? user.organizationMemberId : null);
      await record(tx, context, userId, assigned ? 'assign_service_machine' : 'revoke_service_machine', { machine_id: a.machineId, organization_id: orgId });
      return { updated: true };
    });
  }
}
async function ensureStaffRole(tx, member, role, context) {
  if (!await tx.organizationRoleAssignment.findFirst({ where: { organizationId: member.organizationId, memberId: member.id, role, revokedAt: null } })) {
    await tx.organizationRoleAssignment.create({ data: { organizationId: member.organizationId, memberId: member.id, role, grantedBy: context.subject_id } });
    await record(tx, context, member.id, 'grant_service_role', { organization_id: member.organizationId, member_id: member.id, role });
  }
}
function denied() { return new ApiError({ statusCode: 403, code: 'SERVICE_ACCOUNT_ACCESS_DENIED', message: 'Недостаточно полномочий для изменения служебного доступа.' }); }
function record(tx, context, targetId, action, metadata) { return new AuditRepository(tx).record({ eventType: 'Admin.ServiceAccessChanged', subjectType: 'administrator', subjectId: context.subject_id, targetType: 'AdminUser', targetId, action, decision: 'success', authMethod: context.auth_method, sourceChannel: 'admin_console', correlationId: context.correlation_id || crypto.randomUUID(), metadata }); }
module.exports = { ServiceAccountAccess };
