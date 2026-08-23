class CustomerRoleContextService {
  constructor({ prisma }) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
  }

  async getForCustomer(customerId) {
    const id = String(customerId || '').trim();
    if (!id) throw badRequest('CUSTOMER_ID_REQUIRED', 'customerId is required');

    const customers = await this.prisma.$queryRawUnsafe(
      `SELECT "id","name","phone","email","status" FROM "Customer" WHERE "id"=$1 LIMIT 1`, id,
    );
    const customer = customers[0];
    if (!customer) throw notFound('CUSTOMER_NOT_FOUND', 'Customer was not found');

    const members = await this.prisma.$queryRawUnsafe(
      `SELECT m."id",m."fullName",m."position",m."status",
              EXISTS(SELECT 1 FROM "OrganizationMachineAssignment" a WHERE a."serviceSpecialistId"=m."id" AND a."unassignedAt" IS NULL) AS "isServiceSpecialist",
              EXISTS(SELECT 1 FROM "OrganizationMachineAssignment" a WHERE a."responsibleMemberId"=m."id" AND a."unassignedAt" IS NULL) AS "isMachineResponsible"
       FROM "OrganizationMember" m
       WHERE m."platformUserId"=$1 AND m."status"='ACTIVE'
       ORDER BY m."updatedAt" DESC`, id,
    );

    const roles = new Set(['CUSTOMER']);
    for (const member of members) {
      if (member.isServiceSpecialist) roles.add('SERVICE_SPECIALIST');
      if (member.isMachineResponsible) roles.add('MACHINE_RESPONSIBLE');
    }

    const contexts = [customerContext()];
    if (roles.has('SERVICE_SPECIALIST') || roles.has('MACHINE_RESPONSIBLE')) contexts.push(serviceContext(roles));

    return {
      identity: {
        customerId: customer.id,
        displayName: customer.name || members[0]?.fullName || 'Пользователь',
        phone: customer.phone || null,
        email: customer.email || null,
      },
      roles: [...roles],
      contexts,
      defaultContext: 'CUSTOMER',
      canSwitchContext: contexts.length > 1,
      rule: 'ONE_IDENTITY_MULTIPLE_CONTEXTS',
    };
  }
}

function customerContext() {
  return {
    code: 'CUSTOMER',
    label: 'Мой профиль',
    description: 'Покупки, Клуб Тимоши, бонусы, подарки и клиентские настройки.',
    surface: 'MINI_APP_OR_BOT',
    route: '#account',
    permissions: ['CUSTOMER_PROFILE', 'CUSTOMER_ORDERS', 'CLUB', 'BONUSES', 'GIFTS'],
  };
}

function serviceContext(roles) {
  const permissions = ['SERVICE_PROFILE', 'SERVICE_ASSIGNED_MACHINES', 'SERVICE_INCIDENTS', 'SERVICE_SLA'];
  if (roles.has('SERVICE_SPECIALIST')) permissions.push('SERVICE_MAINTENANCE');
  if (roles.has('MACHINE_RESPONSIBLE')) permissions.push('SERVICE_LOCATION_RESPONSIBILITY');
  return {
    code: 'SERVICE',
    label: 'Рабочий кабинет',
    description: 'Закреплённые аппараты, инциденты, сервисные задачи, SLA и эскалации.',
    surface: 'MINI_APP_OR_BOT',
    route: '#service-workspace',
    permissions,
  };
}

function badRequest(code, message) { const error = new Error(message); error.code = code; error.statusCode = 400; return error; }
function notFound(code, message) { const error = new Error(message); error.code = code; error.statusCode = 404; return error; }

module.exports = { CustomerRoleContextService };
