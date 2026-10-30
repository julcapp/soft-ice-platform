const { ApiError } = require('../../platform/errors/ApiError');
const STAFF_ROLES = ['SERVICE_SPECIALIST', 'MACHINE_RESPONSIBLE'];

class ServiceAccessPolicy {
  constructor({ prisma }) { this.prisma = prisma; }

  async machines(context, db = this.prisma) {
    if (context?.subject_type !== 'administrator' || !context.subject_id) throw denied(401);
    if ((context.roles || []).includes('PLATFORM_OWNER')) {
      return db.$queryRawUnsafe('SELECT "id","machineCode","name","location","status" FROM "Machine" ORDER BY "machineCode"');
    }
    const roles = STAFF_ROLES.filter((role) => context.roles?.includes(role));
    if (!context.organization_member_id || !roles.length) throw denied();
    return db.$queryRawUnsafe(`SELECT DISTINCT machine."id",machine."machineCode",machine."name",machine."location",machine."status"
      FROM "OrganizationMember" member
      JOIN "Organization" org ON org."id"=member."organizationId" AND org."status"='ACTIVE' AND org."archivedAt" IS NULL
      JOIN "OrganizationRoleAssignment" role ON role."memberId"=member."id" AND role."organizationId"=org."id" AND role."revokedAt" IS NULL
      JOIN "OrganizationMachineAssignment" assignment ON assignment."organizationId"=org."id" AND assignment."unassignedAt" IS NULL
      JOIN "Machine" machine ON machine."id"=assignment."machineId"
      WHERE member."id"=$1 AND member."status"='ACTIVE' AND member."archivedAt" IS NULL AND role."role"::text=ANY($2::text[])
        AND ((role."role"='SERVICE_SPECIALIST' AND assignment."serviceSpecialistId"=member."id")
          OR (role."role"='MACHINE_RESPONSIBLE' AND assignment."responsibleMemberId"=member."id"))
      ORDER BY machine."machineCode"`, context.organization_member_id, roles);
  }

  async requireMachine(machineId, context, db = this.prisma) {
    const machine = (await this.machines(context, db)).find((item) => item.id === machineId);
    if (!machine) throw denied();
    return machine;
  }
}
function denied(statusCode = 403) { return new ApiError({ statusCode, code: 'SERVICE_ACCESS_DENIED', message: statusCode === 401 ? 'Войдите в служебную панель.' : 'Нет действующих полномочий на обслуживание этого аппарата.' }); }
module.exports = { ServiceAccessPolicy };
