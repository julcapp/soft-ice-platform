const crypto = require('crypto');

const STATUSES = ['ACTIVE', 'SUSPENDED', 'ARCHIVED', 'BLOCKED'];
const MEMBER_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];
const UNIT_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];
const LOCATION_STATUSES = ['ACTIVE', 'SUSPENDED', 'ARCHIVED'];
const ROLES = ['OWNER', 'ADMINISTRATOR', 'MANAGER', 'OPERATOR', 'SERVICE_SPECIALIST', 'MACHINE_RESPONSIBLE', 'LOCATION_RESPONSIBLE', 'FINANCIALLY_RESPONSIBLE'];
const SCOPES = ['ORGANIZATION', 'UNIT', 'LOCATION', 'MACHINE', 'FINANCE'];

function failure(code, message, statusCode = 422) { return Object.assign(new Error(message), { code, statusCode, source: 'runtime' }); }
function required(input, fields) { for (const field of fields) if (input[field] === undefined || input[field] === null || input[field] === '') throw failure('ORGANIZATION_VALIDATION_FAILED', `Обязательное поле не заполнено: ${field}.`); }
function pick(value, keys) { return Object.fromEntries(keys.filter((key) => value[key] !== undefined).map((key) => [key, value[key]])); }

class OrganizationService {
  constructor({ repository, eventPublisher, auditRepository, clock = () => new Date() }) { Object.assign(this, { repository, eventPublisher, auditRepository, clock }); }
  async ensure(id) { const organization = await this.repository.findById(id); if (!organization) throw failure('ORGANIZATION_NOT_FOUND', 'Организация не найдена.', 404); return organization; }
  async ensureOwned(organizationId, record, label) { if (!record || record.organizationId !== organizationId) throw failure('ORGANIZATION_SCOPE_VIOLATION', `${label} не найден в этой организации.`, 404); return record; }
  list(scope = {}) { return this.repository.list(scope.organizationId ? { id: scope.organizationId } : {}); }
  async get(id) { const organization = await this.ensure(id); const overview = await this.repository.overview(id); return { ...organization, overview: this.formatOverview(overview) }; }
  async create(input, context) {
    required(input, ['fullName', 'shortName', 'organizationType']);
    if (input.status && !STATUSES.includes(input.status)) throw failure('ORGANIZATION_STATUS_INVALID', 'Неизвестный статус организации.');
    const organization = await this.repository.create({ ...pick(input, ['id','fullName','shortName','organizationType','inn','kpp','ogrn','legalAddress','actualAddress','phone','email','website','status','foundedAt','cooperationStartedAt','note']) });
    await this.record('organization.created', organization.id, context, { shortName: organization.shortName }, 'CREATE');
    return organization;
  }
  async update(id, input, context) {
    const current = await this.ensure(id);
    if (input.status && !STATUSES.includes(input.status)) throw failure('ORGANIZATION_STATUS_INVALID', 'Неизвестный статус организации.');
    const data = pick(input, ['fullName','shortName','organizationType','inn','kpp','ogrn','legalAddress','actualAddress','phone','email','website','status','foundedAt','cooperationStartedAt','note']);
    if (data.status === 'ARCHIVED') data.archivedAt = this.clock();
    const organization = await this.repository.update(id, data);
    const type = input.status && input.status !== current.status ? 'organization.status_changed' : 'organization.updated';
    await this.record(type, id, context, { previousStatus: current.status, status: organization.status }, 'UPDATE');
    return organization;
  }
  async listUnits(id) { await this.ensure(id); return this.repository.listUnits(id); }
  async createUnit(id, input, context) {
    await this.ensure(id); required(input, ['name','code']);
    if (input.status && !UNIT_STATUSES.includes(input.status)) throw failure('ORGANIZATION_UNIT_STATUS_INVALID', 'Неизвестный статус подразделения.');
    if (input.parentId) await this.ensureOwned(id, await this.repository.findUnit(input.parentId), 'Родительское подразделение');
    const unit = await this.repository.createUnit({ ...pick(input, ['id','parentId','name','code','description','status']), organizationId: id });
    await this.record('organization.unit.created', id, context, { unitId: unit.id }, 'CREATE', 'organization_unit', unit.id); return unit;
  }
  async updateUnit(id, unitId, input, context) {
    const current = await this.ensureOwned(id, await this.repository.findUnit(unitId), 'Подразделение');
    if (input.status && !UNIT_STATUSES.includes(input.status)) throw failure('ORGANIZATION_UNIT_STATUS_INVALID', 'Неизвестный статус подразделения.');
    if (input.parentId) {
      let parent = await this.ensureOwned(id, await this.repository.findUnit(input.parentId), 'Родительское подразделение');
      while (parent) {
        if (parent.id === unitId) throw failure('ORGANIZATION_UNIT_CYCLE', 'Иерархия подразделений не может содержать цикл.');
        parent = parent.parentId ? await this.ensureOwned(id, await this.repository.findUnit(parent.parentId), 'Родительское подразделение') : null;
      }
    }
    const unit = await this.repository.updateUnit(current.id, pick(input, ['parentId','name','code','description','status']));
    await this.record('organization.unit.updated', id, context, { unitId }, 'UPDATE', 'organization_unit', unitId); return unit;
  }
  async listMembers(id) { await this.ensure(id); return this.repository.listMembers(id); }
  async createMember(id, input, context) {
    await this.ensure(id); required(input, ['fullName','position']);
    if (input.status && !MEMBER_STATUSES.includes(input.status)) throw failure('ORGANIZATION_MEMBER_STATUS_INVALID', 'Неизвестный статус сотрудника.');
    if (input.unitId) await this.ensureOwned(id, await this.repository.findUnit(input.unitId), 'Подразделение');
    const member = await this.repository.createMember({ ...pick(input, ['id','unitId','platformUserId','fullName','position','phone','email','status','employmentStartedAt','employmentEndedAt','responsibilityZone']), organizationId: id });
    await this.record('organization.member.created', id, context, { memberId: member.id }, 'CREATE', 'organization_member', member.id); return member;
  }
  async updateMember(id, memberId, input, context) {
    await this.ensureOwned(id, await this.repository.findMember(memberId), 'Сотрудник');
    if (input.status && !MEMBER_STATUSES.includes(input.status)) throw failure('ORGANIZATION_MEMBER_STATUS_INVALID', 'Неизвестный статус сотрудника.');
    if (input.unitId) await this.ensureOwned(id, await this.repository.findUnit(input.unitId), 'Подразделение');
    const data = pick(input, ['unitId','platformUserId','fullName','position','phone','email','status','employmentStartedAt','employmentEndedAt','responsibilityZone']);
    if (data.status === 'ARCHIVED') data.archivedAt = this.clock();
    const member = await this.repository.updateMember(memberId, data);
    await this.record(data.status === 'INACTIVE' || data.status === 'ARCHIVED' ? 'organization.member.deactivated' : 'organization.member.updated', id, context, { memberId, status: member.status }, 'UPDATE', 'organization_member', memberId); return member;
  }
  async assignRole(id, memberId, input, context) {
    await this.ensureOwned(id, await this.repository.findMember(memberId), 'Сотрудник'); required(input, ['role']);
    if (!ROLES.includes(input.role)) throw failure('ORGANIZATION_ROLE_INVALID', 'Неизвестная организационная роль.');
    const role = await this.repository.createRole({ organizationId: id, memberId, role: input.role, note: input.note, grantedBy: context.actorId });
    await this.record('organization.responsibility.assigned', id, context, { memberId, role: input.role, roleAssignmentId: role.id }, 'ASSIGN', 'organization_member', memberId); return role;
  }
  async revokeRole(id, roleId, context) { const role = await this.repository.findRole(roleId); if (!role || role.organizationId !== id) throw failure('ORGANIZATION_ROLE_NOT_FOUND', 'Назначение роли не найдено.', 404); const result = await this.repository.revokeRole(roleId, this.clock()); await this.record('organization.responsibility.revoked', id, context, { roleAssignmentId: roleId }, 'REVOKE', 'organization_role', roleId); return result; }
  async listLocations(id) { await this.ensure(id); return this.repository.listLocations(id); }
  async createLocation(id, input, context) {
    await this.ensure(id); required(input, ['name','address']); if (input.status && !LOCATION_STATUSES.includes(input.status)) throw failure('ORGANIZATION_LOCATION_STATUS_INVALID', 'Неизвестный статус точки.');
    if (input.responsibleUnitId) await this.ensureOwned(id, await this.repository.findUnit(input.responsibleUnitId), 'Подразделение');
    if (input.responsibleMemberId) await this.ensureOwned(id, await this.repository.findMember(input.responsibleMemberId), 'Сотрудник');
    const location = await this.repository.createLocation({ ...pick(input, ['id','responsibleUnitId','responsibleMemberId','name','address','latitude','longitude','openingHours','status']), organizationId: id });
    await this.record('organization.location.created', id, context, { locationId: location.id }, 'CREATE', 'organization_location', location.id); return location;
  }
  async updateLocation(id, locationId, input, context) {
    await this.ensureOwned(id, await this.repository.findLocation(locationId), 'Точка');
    if (input.status && !LOCATION_STATUSES.includes(input.status)) throw failure('ORGANIZATION_LOCATION_STATUS_INVALID', 'Неизвестный статус точки.');
    if (input.responsibleUnitId) await this.ensureOwned(id, await this.repository.findUnit(input.responsibleUnitId), 'Подразделение');
    if (input.responsibleMemberId) await this.ensureOwned(id, await this.repository.findMember(input.responsibleMemberId), 'Сотрудник');
    const location = await this.repository.updateLocation(locationId, pick(input, ['responsibleUnitId','responsibleMemberId','name','address','latitude','longitude','openingHours','status']));
    await this.record('organization.location.updated', id, context, { locationId }, 'UPDATE', 'organization_location', locationId); return location;
  }
  async listMachines(id) { await this.ensure(id); return this.repository.listMachines(id); }
  async assignMachine(id, input, context) {
    await this.ensure(id); required(input, ['machineId']); if (!await this.repository.findMachine(input.machineId)) throw failure('MACHINE_NOT_FOUND', 'Аппарат не найден.', 404);
    if (await this.repository.findActiveMachineAssignment(input.machineId)) throw failure('ORGANIZATION_MACHINE_ALREADY_ASSIGNED', 'Аппарат уже имеет активное организационное назначение.', 409);
    if (input.locationId) await this.ensureOwned(id, await this.repository.findLocation(input.locationId), 'Точка');
    for (const key of ['responsibleMemberId','serviceSpecialistId']) if (input[key]) await this.ensureOwned(id, await this.repository.findMember(input[key]), 'Сотрудник');
    const ownerOrganizationId = input.ownerOrganizationId || id;
    const operatorOrganizationId = input.operatorOrganizationId || id;
    if (!context.global && (ownerOrganizationId !== id || operatorOrganizationId !== id)) throw failure('ORGANIZATION_SCOPE_VIOLATION', 'Организационный администратор не может назначать владельца или оператора из другой организации.', 403);
    await this.ensure(ownerOrganizationId); await this.ensure(operatorOrganizationId);
    const assignment = await this.repository.createMachineAssignment({ ...pick(input, ['id','machineId','locationId','responsibleMemberId','serviceSpecialistId','note']), organizationId: id, ownerOrganizationId, operatorOrganizationId, assignedBy: context.actorId });
    await this.record('organization.machine.assigned', id, context, { assignmentId: assignment.id, machineId: input.machineId }, 'ASSIGN', 'machine', input.machineId); return assignment;
  }
  async unassignMachine(id, machineId, context) { const assignment = await this.repository.findActiveMachineAssignment(machineId); if (!assignment || assignment.organizationId !== id) throw failure('ORGANIZATION_MACHINE_NOT_ASSIGNED', 'Активная привязка аппарата не найдена.', 404); const result = await this.repository.unassignMachine(assignment.id, this.clock()); await this.record('organization.machine.unassigned', id, context, { assignmentId: assignment.id, machineId }, 'UNASSIGN', 'machine', machineId); return result; }
  async listResponsibilities(id) { await this.ensure(id); return this.repository.listResponsibilities(id); }
  async assignResponsibility(id, input, context) {
    await this.ensure(id); required(input, ['memberId','scope']); if (!SCOPES.includes(input.scope)) throw failure('ORGANIZATION_RESPONSIBILITY_SCOPE_INVALID', 'Неизвестная область ответственности.');
    await this.ensureOwned(id, await this.repository.findMember(input.memberId), 'Сотрудник');
    if (input.unitId) await this.ensureOwned(id, await this.repository.findUnit(input.unitId), 'Подразделение'); if (input.locationId) await this.ensureOwned(id, await this.repository.findLocation(input.locationId), 'Точка');
    if (input.machineId) { const assignment = await this.repository.findActiveMachineAssignment(input.machineId); if (!assignment || assignment.organizationId !== id) throw failure('ORGANIZATION_MACHINE_NOT_ASSIGNED', 'Аппарат не относится к организации.', 404); }
    const scopeField = { UNIT: 'unitId', LOCATION: 'locationId', MACHINE: 'machineId' }[input.scope];
    if (scopeField && !input[scopeField]) throw failure('ORGANIZATION_RESPONSIBILITY_TARGET_REQUIRED', `Для области ${input.scope} не указан объект ответственности.`);
    const unrelated = ['unitId', 'locationId', 'machineId'].filter((field) => field !== scopeField && input[field]);
    if (unrelated.length || (!scopeField && ['unitId', 'locationId', 'machineId'].some((field) => input[field]))) throw failure('ORGANIZATION_RESPONSIBILITY_SCOPE_MISMATCH', 'Объект ответственности не соответствует выбранной области.');
    const responsibility = await this.repository.createResponsibility({ ...pick(input, ['id','memberId','scope','unitId','locationId','machineId','description']), organizationId: id, assignedBy: context.actorId });
    await this.record('organization.responsibility.assigned', id, context, { responsibilityId: responsibility.id, memberId: input.memberId, scope: input.scope }, 'ASSIGN', 'organization_responsibility', responsibility.id); return responsibility;
  }
  async revokeResponsibility(id, responsibilityId, context) { const item = await this.repository.findResponsibility(responsibilityId); if (!item || item.organizationId !== id) throw failure('ORGANIZATION_RESPONSIBILITY_NOT_FOUND', 'Назначение ответственности не найдено.', 404); const result = await this.repository.revokeResponsibility(responsibilityId, this.clock()); await this.record('organization.responsibility.revoked', id, context, { responsibilityId }, 'REVOKE', 'organization_responsibility', responsibilityId); return result; }
  async metrics(id) { await this.ensure(id); return this.formatOverview(await this.repository.overview(id)); }
  formatOverview(value) { return { departments: value.units, employees: value.members, locations: value.locations, machines: value.machines, machinesOnline: value.online, machinesOffline: Math.max(0, value.machines - value.online), activeIncidents: value.incidents ?? null, machinesRequiringService: value.maintenance ?? null, sales: value.sales, revenueRub: value.revenueRub, customers: value.customers ?? null, serviceWorks: value.maintenance ?? null, sources: { organization: 'LIVE', machine: 'LIVE', orders: 'LIVE', customers: 'FOUNDATION_ONLY', incidents: 'FOUNDATION_ONLY', maintenance: 'FOUNDATION_ONLY' } }; }
  async record(eventType, organizationId, context, payload, action, targetType = 'organization', targetId = organizationId) {
    const occurredAt = this.clock();
    await this.auditRepository?.record({ eventType, subjectType: context.actorType, subjectId: context.actorId, targetType, targetId, action, decision: 'ALLOW', authMethod: context.authMethod, sourceChannel: context.sourceChannel, correlationId: context.correlationId, metadata: { organizationId, ...payload }, occurredAt });
    await this.eventPublisher?.publish({ eventId: `evt_${crypto.randomUUID()}`, eventType, eventVersion: 1, occurredAt, aggregateType: 'organization', aggregateId: organizationId, actorType: context.actorType, actorId: context.actorId, sourceChannel: context.sourceChannel, correlationId: context.correlationId, payload: { organizationId, ...payload }, metadata: { tenantId: organizationId, organizationId } });
  }
}

module.exports = { OrganizationService, ORGANIZATION_STATUSES: STATUSES, ORGANIZATION_ROLES: ROLES };
