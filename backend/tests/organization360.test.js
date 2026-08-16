const assert = require('node:assert/strict');
const { test } = require('node:test');
const { OrganizationService } = require('../src/modules/organization');
const { createApp } = require('../src/main');

function fixture() {
  let sequence = 0;
  const maps = Object.fromEntries(['organizations','units','members','roles','locations','assignments','responsibilities'].map((key) => [key, new Map()]));
  const save = (map, value) => { const item = { id: value.id || `${map}_${++sequence}`, createdAt: new Date(), updatedAt: new Date(), ...value }; maps[map].set(item.id, item); return item; };
  const repository = {
    list: async (where) => [...maps.organizations.values()].filter((item) => !where.id || item.id === where.id),
    findById: async (id) => maps.organizations.get(id) || null, create: async (v) => save('organizations', { status: 'ACTIVE', ...v }), update: async (id,v) => Object.assign(maps.organizations.get(id),v),
    listUnits: async (id) => [...maps.units.values()].filter((v) => v.organizationId === id), findUnit: async (id) => maps.units.get(id), createUnit: async (v) => save('units',v), updateUnit: async (id,v) => Object.assign(maps.units.get(id),v),
    listMembers: async (id) => [...maps.members.values()].filter((v) => v.organizationId === id), findMember: async (id) => maps.members.get(id), createMember: async (v) => save('members',{ status:'ACTIVE',...v }), updateMember: async (id,v) => Object.assign(maps.members.get(id),v),
    createRole: async (v) => save('roles',v), findRole: async (id) => maps.roles.get(id), revokeRole: async (id,revokedAt) => Object.assign(maps.roles.get(id),{revokedAt}),
    listLocations: async (id) => [...maps.locations.values()].filter((v) => v.organizationId === id), findLocation: async (id) => maps.locations.get(id), createLocation: async (v) => save('locations',{ status:'ACTIVE',...v }), updateLocation: async (id,v) => Object.assign(maps.locations.get(id),v),
    findMachine: async (id) => id === 'machine-1' ? { id, status:'ONLINE' } : null, findActiveMachineAssignment: async (id) => [...maps.assignments.values()].find((v) => v.machineId === id && !v.unassignedAt), createMachineAssignment: async (v) => save('assignments',v), unassignMachine: async (id,unassignedAt) => Object.assign(maps.assignments.get(id),{unassignedAt}), listMachines: async (id) => [...maps.assignments.values()].filter((v) => v.organizationId === id && !v.unassignedAt),
    createResponsibility: async (v) => save('responsibilities',v), findResponsibility: async (id) => maps.responsibilities.get(id), revokeResponsibility: async (id,revokedAt) => Object.assign(maps.responsibilities.get(id),{revokedAt}), listResponsibilities: async (id) => [...maps.responsibilities.values()].filter((v) => v.organizationId === id && !v.revokedAt),
    overview: async (id) => ({ units: [...maps.units.values()].filter(v=>v.organizationId===id).length, members:[...maps.members.values()].filter(v=>v.organizationId===id&&v.status==='ACTIVE').length, locations:[...maps.locations.values()].filter(v=>v.organizationId===id).length, machines:[...maps.assignments.values()].filter(v=>v.organizationId===id&&!v.unassignedAt).length, online:[...maps.assignments.values()].filter(v=>v.organizationId===id&&!v.unassignedAt).length, incidents:0, maintenance:0, sales:0, revenueRub:0, customers:0 }),
  };
  const events=[]; const audits=[];
  const service = new OrganizationService({ repository, eventPublisher:{ publish: async (event) => events.push(event) }, auditRepository:{ record: async (event) => audits.push(event) }, clock:()=>new Date('2026-08-16T00:00:00Z') });
  return { service, maps, events, audits };
}
const context = { actorType:'ADMINISTRATOR', actorId:'owner-1', authMethod:'test', sourceChannel:'ADMIN_API', correlationId:'corr-1' };

test('Organization 360 создаёт организацию, вложенную структуру, сотрудника, роль и точку', async () => {
  const { service, events, audits } = fixture();
  const org = await service.create({ id:'org-1', fullName:'ООО «У Тимоши»', shortName:'У Тимоши', organizationType:'ООО', inn:'7000000000' }, context);
  const parent = await service.createUnit(org.id,{ name:'Эксплуатация',code:'operations' },context);
  const child = await service.createUnit(org.id,{ name:'Томск',code:'tomsk',parentId:parent.id },context);
  const member = await service.createMember(org.id,{ fullName:'Иван Иванов',position:'Оператор',unitId:child.id },context);
  await service.assignRole(org.id,member.id,{ role:'OPERATOR' },context);
  await service.createLocation(org.id,{ name:'ТЦ Лето',address:'г. Томск',responsibleMemberId:member.id },context);
  assert.equal((await service.listUnits(org.id)).length,2); assert.equal((await service.listMembers(org.id)).length,1); assert.equal(events.length,6); assert.equal(audits.length,6);
  assert.deepEqual(Object.keys(events[0]).sort(), ['actorId','actorType','aggregateId','aggregateType','correlationId','eventId','eventType','eventVersion','metadata','occurredAt','payload','sourceChannel'].sort());
  assert.equal(events[0].metadata.tenantId, org.id);
});

test('Organization 360 связывает существующий аппарат и меняет ответственность без копирования Machine', async () => {
  const { service } = fixture(); await service.create({ id:'org-1',fullName:'Организация',shortName:'Орг',organizationType:'ООО' },context);
  const member=await service.createMember('org-1',{fullName:'Специалист',position:'Инженер'},context); const location=await service.createLocation('org-1',{name:'Точка',address:'Адрес'},context);
  await service.assignMachine('org-1',{machineId:'machine-1',locationId:location.id,responsibleMemberId:member.id},context);
  const responsibility=await service.assignResponsibility('org-1',{memberId:member.id,scope:'MACHINE',machineId:'machine-1'},context);
  assert.equal((await service.listMachines('org-1'))[0].machineId,'machine-1'); await service.revokeResponsibility('org-1',responsibility.id,context); assert.equal((await service.listResponsibilities('org-1')).length,0);
});

test('Organization 360 отклоняет цикл в дереве подразделений', async () => {
  const { service } = fixture(); await service.create({ id:'org-1',fullName:'Организация',shortName:'Орг',organizationType:'ООО' },context);
  const parent=await service.createUnit('org-1',{name:'Головное',code:'root'},context); const child=await service.createUnit('org-1',{name:'Дочернее',code:'child',parentId:parent.id},context);
  await assert.rejects(service.updateUnit('org-1',parent.id,{parentId:child.id},context),{code:'ORGANIZATION_UNIT_CYCLE'});
});

test('Organization 360 проверяет объект scope и межорганизационное назначение аппарата', async () => {
  const { service } = fixture();
  await service.create({id:'org-1',fullName:'Первая',shortName:'Первая',organizationType:'ООО'},context); await service.create({id:'org-2',fullName:'Вторая',shortName:'Вторая',organizationType:'ООО'},context);
  const member=await service.createMember('org-1',{fullName:'Специалист',position:'Инженер'},context);
  await assert.rejects(service.assignResponsibility('org-1',{memberId:member.id,scope:'MACHINE'},context),{code:'ORGANIZATION_RESPONSIBILITY_TARGET_REQUIRED'});
  await assert.rejects(service.assignMachine('org-1',{machineId:'machine-1',ownerOrganizationId:'org-2'},context),{code:'ORGANIZATION_SCOPE_VIOLATION'});
});

test('API изолирует организационного администратора и оставляет PLATFORM_OWNER глобальный доступ', async () => {
  const calls=[]; const runtime={ list:async(scope)=>scope, get:async(id)=>{calls.push(id);return{id}}, metrics:async()=>({}), listUnits:async()=>[], listMembers:async()=>[], listLocations:async()=>[], listMachines:async()=>[], listResponsibilities:async()=>[], events:async()=>({items:[]}) };
  const dependencies={ organizationRuntime:runtime };
  const app=createApp({ dependencies, config:{ logging:{level:'silent'}, features:{}, environment:'test' }, logger:{ child(){return this}, info(){}, error(){}, warn(){}, flush:async()=>{} }, metrics:{increment(){}} });
  const server=app.listen(0); const base=`http://127.0.0.1:${server.address().port}/api/v1/organizations`;
  try {
    const denied=await fetch(`${base}/org-2`,{headers:{'X-Admin-Role':'ORGANIZATION_ADMIN','X-Organization-Id':'org-1'}}); assert.equal(denied.status,403);
    const own=await fetch(`${base}/org-1`,{headers:{'X-Admin-Role':'ORGANIZATION_ADMIN','X-Organization-Id':'org-1'}}); assert.equal(own.status,200);
    const global=await fetch(`${base}/org-2`,{headers:{'X-Admin-Role':'PLATFORM_OWNER'}}); assert.equal(global.status,200); assert.deepEqual(calls,['org-1','org-2']);
  } finally { await new Promise((resolve)=>server.close(resolve)); }
});
