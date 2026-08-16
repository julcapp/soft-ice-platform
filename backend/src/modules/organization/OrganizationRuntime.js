class OrganizationRuntime {
  constructor({ service, eventCenterRuntime }) { this.service = service; this.eventCenterRuntime = eventCenterRuntime; }
  list(scope) { return this.service.list(scope); }
  get(id) { return this.service.get(id); }
  create(input, context) { return this.service.create(input, context); }
  update(id, input, context) { return this.service.update(id, input, context); }
  listUnits(id) { return this.service.listUnits(id); }
  createUnit(id, input, context) { return this.service.createUnit(id, input, context); }
  updateUnit(id, unitId, input, context) { return this.service.updateUnit(id, unitId, input, context); }
  listMembers(id) { return this.service.listMembers(id); }
  createMember(id, input, context) { return this.service.createMember(id, input, context); }
  updateMember(id, memberId, input, context) { return this.service.updateMember(id, memberId, input, context); }
  assignRole(id, memberId, input, context) { return this.service.assignRole(id, memberId, input, context); }
  revokeRole(id, roleId, context) { return this.service.revokeRole(id, roleId, context); }
  listLocations(id) { return this.service.listLocations(id); }
  createLocation(id, input, context) { return this.service.createLocation(id, input, context); }
  updateLocation(id, locationId, input, context) { return this.service.updateLocation(id, locationId, input, context); }
  listMachines(id) { return this.service.listMachines(id); }
  assignMachine(id, input, context) { return this.service.assignMachine(id, input, context); }
  unassignMachine(id, machineId, context) { return this.service.unassignMachine(id, machineId, context); }
  listResponsibilities(id) { return this.service.listResponsibilities(id); }
  assignResponsibility(id, input, context) { return this.service.assignResponsibility(id, input, context); }
  revokeResponsibility(id, responsibilityId, context) { return this.service.revokeResponsibility(id, responsibilityId, context); }
  metrics(id) { return this.service.metrics(id); }
  events(id, query, context) { return this.eventCenterRuntime ? this.eventCenterRuntime.list({ ...query, organizationId: id }, context) : { items: [], total: 0, status: 'FOUNDATION_ONLY' }; }
}
module.exports = { OrganizationRuntime };
