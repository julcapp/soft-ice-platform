const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { MachineDispenseRepository, MachineDispenseService, MachineCommandWorker, MachineRecoveryWorker } = require('../src/modules/machine_dispense');
const { PrismaOutboxRepository } = require('../src/modules/transactional_outbox');
const { PostgresInventoryReservationService } = require('../src/modules/inventory');

const enabled = Boolean(process.env.DATABASE_URL);
const pg = enabled ? test : test.skip;
const prisma = enabled ? new PrismaClient() : null;
const uid = (prefix) => `${prefix}_${crypto.randomUUID()}`;

async function fixture(operationType = 'CUSTOMER_SALE') {
  const organizationId = uid('org');
  const machineId = uid('machine');
  const locationId = uid('location');
  const customerId = uid('customer');
  const orderId = operationType === 'CUSTOMER_SALE' ? uid('order') : null;
  const saleFlowId = operationType === 'CUSTOMER_SALE' ? uid('flow') : null;
  const correlationId = uid('correlation');
  await prisma.organization.create({ data: { id: organizationId, fullName: 'Machine PostgreSQL test', shortName: uid('short'), organizationType: 'OWNER' } });
  const actorId=uid('member');
  await prisma.organizationMember.create({data:{id:actorId,organizationId,fullName:'Machine test actor',position:'operator',status:'ACTIVE'}});
  await prisma.organizationRoleAssignment.create({data:{organizationId,memberId:actorId,role:operationType==='MAINTENANCE_TEST'?'SERVICE_SPECIALIST':'OPERATOR',grantedBy:'test'}});
  await prisma.machine.create({ data: { id: machineId, machineCode: uid('code'), name: 'Machine PostgreSQL test', status: 'ONLINE' } });
  await prisma.organizationLocation.create({ data: { id: locationId, organizationId, name: 'Test location', address: 'test' } });
  await prisma.organizationMachineAssignment.create({ data: { organizationId, machineId, locationId, ownerOrganizationId: organizationId, operatorOrganizationId: organizationId, assignedBy: 'test' } });
  await prisma.inventoryRuntimeLocation.create({ data: { id: locationId, code: locationId, name: 'Test stock', locationType: 'MACHINE', machineId } });
  const item = await prisma.inventoryRuntimeItem.create({ data: { id: uid('item'), sku: uid('sku'), name: 'portion', category: 'CONSUMABLE', baseUnit: 'portion' } });
  await prisma.inventoryRuntimeStock.create({ data: { organizationId, machineId, locationId, inventoryItemId: item.id, physicalQuantity: 10 } });
  if (orderId) {
    await prisma.customer.create({ data: { id: customerId } });
    await prisma.order.create({ data: { id: orderId, customerId, machineId, status: 'PAID', amount: 150 } });
    await prisma.saleFlow.create({ data: { flowId: saleFlowId, orderId, customerId, machineId, organizationId, locationId, correlationId, currentState: 'PAID' } });
    await prisma.payment.create({ data: { organizationId, orderId, saleFlowId, customerId, provider: 'TEST', idempotencyKey: uid('payment'), requestFingerprint: 'fixture', status: 'SUCCEEDED', amount: 150, succeededAt: new Date() } });
  }
  const inventory = new PostgresInventoryReservationService({ prisma });
  const reservation = (await inventory.reserve({ organizationId, machineId, locationId, orderId, saleFlowId, operationType, items: [{ inventoryItemId: item.id, ingredientType: 'CONSUMABLE', quantity: 1, unit: 'portion' }] }, { organizationId, actorType: 'OPERATOR', actorId: 'operator_pg', correlationId, idempotencyKey: uid('reserve') })).reservation;
  let dispatches = 0;
  const provider = { sendDispenseCommand: async ({ commandId }) => { dispatches += 1; return { providerCommandId: commandId }; }, reconcileCommand: async () => ({ status: 'UNKNOWN' }) };
  const repository = new MachineDispenseRepository(prisma);
  const orderDomain = { complete: (id, { transactionClient }) => transactionClient.order.update({ where: { id }, data: { status: 'COMPLETED' } }) };
  const service = new MachineDispenseService({ repository, inventory, orderDomain, provider });
  const request = { organizationId, machineId, locationId, orderId, saleFlowId, inventoryReservationId: reservation.reservationId, operationType, idempotencyKey: uid('dispense'), provider: 'TEST', ...(operationType !== 'CUSTOMER_SALE' && { operationReason: 'Проверка после обслуживания', serviceContext: { sessionId: uid('service') } }) };
  const context = { correlationId, securityContext: { subject_type: 'organization_member', subject_id: actorId, organization_id: organizationId, roles: ['CALLER_CONTROLLED_ROLE_IS_IGNORED'] } };
  return { organizationId, machineId, orderId, saleFlowId, reservation, repository, inventory, orderDomain, provider, service, request, context, dispatches: () => dispatches };
}

const create = (f) => f.request.operationType === 'CUSTOMER_SALE' ? f.service.createAuthorized(f.request, f.context) : f.service.createTestAuthorized(f.request, f.context);
async function sent(f) { const created = await create(f); await f.service.deliverCommand({ organizationId: f.organizationId, aggregateId: created.attempt.id }); return f.repository.get(f.organizationId, created.attempt.id); }
test.after(async () => { if (prisma) await prisma.$disconnect(); });

pg('20x CREATE: one durable attempt and stable commandId', async () => {
  const f = await fixture(); const results = await Promise.all(Array.from({ length: 20 }, () => create(f)));
  assert.equal(new Set(results.map((x) => x.attempt.id)).size, 1); assert.equal(new Set(results.map((x) => x.attempt.commandId)).size, 1);
});

pg('20x SEND: exactly one provider dispatch authorization', async () => {
  const f = await fixture(); const attempt = (await create(f)).attempt;
  await Promise.allSettled(Array.from({ length: 20 }, () => f.service.deliverCommand({ organizationId: f.organizationId, aggregateId: attempt.id })));
  assert.equal(f.dispatches(), 1); assert.equal((await f.repository.get(f.organizationId, attempt.id)).status, 'SENT');
});

pg('20x COMMAND CLAIM: one outbox lease and one physical dispatch authorization', async () => {
  const f=await fixture();const attempt=(await create(f)).attempt;const workers=Array.from({length:20},(_,i)=>new MachineCommandWorker({repository:new PrismaOutboxRepository(prisma),machineDispenseService:f.service,workerId:`command-worker-${i}`}));
  await Promise.all(workers.map(worker=>worker.runOnce({organizationId:f.organizationId})));
  assert.equal(f.dispatches(),1);assert.equal((await f.repository.get(f.organizationId,attempt.id)).status,'SENT');
  assert.equal(await prisma.transactionalOutboxEvent.count({where:{aggregateId:attempt.id,eventType:'MACHINE_COMMAND_QUEUED',status:'PUBLISHED'}}),1);
});

pg('failure matrix 3/12: crashed Outbox claim is reclaimed once after restart', async () => {
  const f = await fixture(); const attempt = (await create(f)).attempt; const outbox = new PrismaOutboxRepository(prisma);
  const [claimed] = await outbox.claimPendingEvents({ workerId: 'crashed-outbox-worker', organizationId: f.organizationId, eventTypes: ['MACHINE_COMMAND_QUEUED'] });
  assert.ok(claimed); await prisma.transactionalOutboxEvent.update({ where: { eventId: claimed.eventId }, data: { lockedAt: new Date(Date.now() - 120000) } });
  const restarted = new MachineCommandWorker({ repository: new PrismaOutboxRepository(prisma), machineDispenseService: f.service, workerId: 'restarted-outbox-worker', leaseMs: 60000 });
  await restarted.runOnce({ organizationId: f.organizationId });
  assert.equal(f.dispatches(), 1); assert.equal((await f.repository.get(f.organizationId, attempt.id)).status, 'SENT');
  assert.equal((await outbox.getByEventId(claimed.eventId, { organizationId: f.organizationId })).status, 'PUBLISHED');
});

pg('failure matrix 4/12: crash at provider send boundary never redispatches after restart', async () => {
  const f = await fixture(); const attempt = (await create(f)).attempt; let physicalCommands = 0;
  const crashing = new MachineDispenseService({ repository: f.repository, inventory: f.inventory, orderDomain: f.orderDomain, provider: { sendDispenseCommand: async () => { physicalCommands += 1; throw Object.assign(new Error('crash after send boundary'), { code: 'INJECT_SEND_BOUNDARY' }); }, reconcileCommand: async () => ({ status: 'UNKNOWN' }) } });
  await assert.rejects(() => crashing.deliverCommand({ organizationId: f.organizationId, aggregateId: attempt.id }), { code: 'INJECT_SEND_BOUNDARY' });
  const restarted = new MachineDispenseService({ repository: new MachineDispenseRepository(prisma), inventory: new PostgresInventoryReservationService({ prisma }), orderDomain: f.orderDomain, provider: { sendDispenseCommand: async () => { physicalCommands += 1; throw new Error('redispatch forbidden'); }, reconcileCommand: async () => ({ status: 'DISPENSED', providerEventId: uid('reconciled') }) } });
  await restarted.reconcileUnfinished(f.organizationId);
  assert.equal(physicalCommands, 1); assert.equal((await f.repository.get(f.organizationId, attempt.id)).status, 'DISPENSED');
  assert.equal(await prisma.inventoryRuntimeMovement.count({ where: { sourceId: f.reservation.reservationId, movementType: 'CONSUMPTION' } }), 1);
  assert.equal((await prisma.order.findUnique({ where: { id: f.orderId } })).status, 'COMPLETED');
  assert.equal((await prisma.saleFlow.findUnique({ where: { flowId: f.saleFlowId } })).currentState, 'COMPLETED');
  assert.equal(await prisma.transactionalOutboxEvent.count({ where: { aggregateId: attempt.id, eventType: 'MACHINE_DISPENSED' } }), 1);
});

pg('failure matrix 5/12: persisted RECEIVED callback is claimed and completed after restart', async () => {
  const f = await fixture(); const attempt = await sent(f); const providerEventId = uid('provider_event'); const payloadSafe = { status: 'DISPENSED' };
  const payloadFingerprint = crypto.createHash('sha256').update(JSON.stringify({ provider: 'TEST', providerEventId, providerCommandId: attempt.providerCommandId, machineId: f.machineId, status: 'DISPENSED', failureCode: null, payloadSafe })).digest('hex');
  await f.repository.inbox({ organizationId: f.organizationId, dispenseAttemptId: attempt.id, provider: 'TEST', providerEventId, machineId: f.machineId, providerCommandId: attempt.providerCommandId, payloadSafe, payloadFingerprint, callbackStatus: 'DISPENSED', correlationId: attempt.correlationId });
  const restarted = new MachineDispenseService({ repository: new MachineDispenseRepository(prisma), inventory: new PostgresInventoryReservationService({ prisma }), orderDomain: f.orderDomain, provider: f.provider });
  await new MachineRecoveryWorker({ repository: new MachineDispenseRepository(prisma), machineDispenseService: restarted, workerId: 'callback-persistence-restart' }).runOnce();
  assert.equal((await f.repository.findInbox('TEST', providerEventId)).status, 'PROCESSED');
  assert.equal((await f.repository.get(f.organizationId, attempt.id)).status, 'DISPENSED');
  assert.equal(await prisma.inventoryRuntimeMovement.count({ where: { sourceId: f.reservation.reservationId, movementType: 'CONSUMPTION' } }), 1);
});

pg('20x CALLBACK: all five terminal effects occur once', async () => {
  const f = await fixture(); const attempt = await sent(f); const providerEventId = uid('provider_event');
  const callback = { provider: 'TEST', providerEventId, providerCommandId: attempt.providerCommandId, machineId: f.machineId, status: 'DISPENSED', payload: { status: 'DISPENSED' } };
  await Promise.all(Array.from({ length: 20 }, () => f.service.receiveCallback(callback)));
  assert.equal((await f.repository.get(f.organizationId, attempt.id)).status, 'DISPENSED');
  assert.equal(await prisma.inventoryRuntimeMovement.count({ where: { sourceId: f.reservation.reservationId, movementType: 'CONSUMPTION' } }), 1);
  assert.equal((await prisma.order.findUnique({ where: { id: f.orderId } })).status, 'COMPLETED');
  assert.equal((await prisma.saleFlow.findUnique({ where: { flowId: f.saleFlowId } })).currentState, 'COMPLETED');
  assert.equal(await prisma.transactionalOutboxEvent.count({ where: { aggregateId: attempt.id, eventType: 'MACHINE_DISPENSED' } }), 1);
});

pg('expired PROCESSING callback is reclaimed by 20 workers and finalized once',async()=>{
  const f=await fixture();const attempt=await sent(f);const providerEventId=uid('provider_event');
  const payloadSafe={status:'DISPENSED'};const callback={provider:'TEST',providerEventId,providerCommandId:attempt.providerCommandId,machineId:f.machineId,status:'DISPENSED',payload:payloadSafe};
  const cryptoHash=crypto.createHash('sha256').update(JSON.stringify({provider:'TEST',providerEventId,providerCommandId:attempt.providerCommandId,machineId:f.machineId,status:'DISPENSED',failureCode:null,payloadSafe})).digest('hex');
  const crashedAt=new Date(Date.now()-120000);await prisma.machineCallbackInbox.create({data:{organizationId:f.organizationId,dispenseAttemptId:attempt.id,provider:'TEST',providerEventId,machineId:f.machineId,providerCommandId:attempt.providerCommandId,payloadSafe,payloadFingerprint:cryptoHash,callbackStatus:'DISPENSED',status:'PROCESSING',processingStartedAt:crashedAt,processingLockedAt:crashedAt,processingLockedBy:'crashed-worker',correlationId:attempt.correlationId}});
  const workers=Array.from({length:20},(_,i)=>new MachineRecoveryWorker({repository:new MachineDispenseRepository(prisma),machineDispenseService:f.service,workerId:`callback-recovery-${i}`,leaseMs:60000}));
  await Promise.all(workers.map(worker=>worker.runOnce()));
  await Promise.all(Array.from({length:20},()=>f.service.receiveCallback(callback)));
  const inbox=await f.repository.findInbox('TEST',providerEventId);assert.equal(inbox.status,'PROCESSED');assert.ok(inbox.attemptCount>=1);
  assert.equal((await f.repository.get(f.organizationId,attempt.id)).status,'DISPENSED');
  assert.equal(await prisma.inventoryRuntimeMovement.count({where:{sourceId:f.reservation.reservationId,movementType:'CONSUMPTION'}}),1);
  assert.equal(await prisma.transactionalOutboxEvent.count({where:{aggregateId:attempt.id,eventType:'MACHINE_DISPENSED'}}),1);
});

pg('callback finalization failure remains recoverable without repeating business effects',async()=>{
  const f=await fixture();const attempt=await sent(f);const providerEventId=uid('provider_event');let failed=false;
  const injected=new MachineDispenseService({repository:f.repository,inventory:f.inventory,orderDomain:f.orderDomain,provider:f.provider,failureInjector:async(point)=>{if(point==='CALLBACK_FINALIZATION'&&!failed){failed=true;throw Object.assign(new Error('crash before inbox finalization'),{code:'INJECT_CALLBACK_FINALIZATION'});}}});
  const callback={provider:'TEST',providerEventId,providerCommandId:attempt.providerCommandId,machineId:f.machineId,status:'DISPENSED',payload:{status:'DISPENSED'}};
  await assert.rejects(()=>injected.receiveCallback(callback),{code:'INJECT_CALLBACK_FINALIZATION'});
  await prisma.machineCallbackInbox.update({where:{provider_providerEventId:{provider:'TEST',providerEventId}},data:{status:'PROCESSING',processingLockedAt:new Date(Date.now()-120000),processingLockedBy:'crashed-worker'}});
  const restarted=new MachineDispenseService({repository:new MachineDispenseRepository(prisma),inventory:new PostgresInventoryReservationService({prisma}),orderDomain:f.orderDomain,provider:f.provider});
  await new MachineRecoveryWorker({repository:new MachineDispenseRepository(prisma),machineDispenseService:restarted,workerId:'restart-worker'}).runOnce();
  assert.equal((await f.repository.findInbox('TEST',providerEventId)).status,'PROCESSED');
  assert.equal(await prisma.inventoryRuntimeMovement.count({where:{sourceId:f.reservation.reservationId,movementType:'CONSUMPTION'}}),1);
  assert.equal(await prisma.transactionalOutboxEvent.count({where:{aggregateId:attempt.id,eventType:'MACHINE_DISPENSED'}}),1);
});

pg('stale callback worker cannot fail a reclaimed or completed callback',async()=>{
  const f=await fixture();const attempt=await sent(f);const inbox=await f.repository.inbox({organizationId:f.organizationId,dispenseAttemptId:attempt.id,provider:'TEST',providerEventId:uid('provider_event'),machineId:f.machineId,providerCommandId:attempt.providerCommandId,payloadSafe:{status:'ACCEPTED'},payloadFingerprint:uid('fingerprint'),callbackStatus:'ACCEPTED',correlationId:attempt.correlationId});
  const claimedA=await f.repository.claimInbox(inbox.id,{workerId:'worker-a'});
  await prisma.machineCallbackInbox.update({where:{id:inbox.id},data:{processingLockedAt:new Date(Date.now()-120000)}});
  const [claimedB,...others]=await Promise.all(Array.from({length:20},(_,index)=>f.repository.claimInbox(inbox.id,{workerId:`worker-b-${index}`,leaseMs:60000})));
  const effective=[claimedB,...others].filter(Boolean);assert.equal(effective.length,1);
  assert.equal((await f.repository.failClaimedInbox(inbox.id,'worker-a',claimedA.processingLeaseVersion,'STALE')).count,0);
  const owner=effective[0];assert.equal((await f.repository.updateClaimedInbox(inbox.id,owner.processingLockedBy,owner.processingLeaseVersion,{status:'PROCESSED',processedAt:new Date(),processingLockedAt:null,processingLockedBy:null})).count,1);
  assert.equal((await f.repository.failClaimedInbox(inbox.id,'worker-a',claimedA.processingLeaseVersion,'STALE')).count,0);
  assert.equal((await prisma.machineCallbackInbox.findUnique({where:{id:inbox.id}})).status,'PROCESSED');
});

pg('callback business rollback leaves no cross-transaction effects and permits reclaim',async()=>{
  const f=await fixture();const attempt=await sent(f);const injected=new MachineDispenseService({repository:f.repository,inventory:f.inventory,orderDomain:f.orderDomain,provider:f.provider,failureInjector:async(point)=>{if(point==='INVENTORY_CONSUME')throw Object.assign(new Error('rollback'),{code:'INJECT_INVENTORY_CONSUME'});}});
  const callback={provider:'TEST',providerEventId:uid('provider_event'),providerCommandId:attempt.providerCommandId,machineId:f.machineId,status:'DISPENSED',payload:{status:'DISPENSED'}};
  await assert.rejects(()=>injected.receiveCallback(callback),{code:'INJECT_INVENTORY_CONSUME'});
  assert.equal((await f.repository.get(f.organizationId,attempt.id)).status,'SENT');
  assert.equal(await prisma.inventoryRuntimeMovement.count({where:{sourceId:f.reservation.reservationId,movementType:'CONSUMPTION'}}),0);
  const inbox=await f.repository.findInbox('TEST',callback.providerEventId);assert.equal(inbox.status,'FAILED');
  await new MachineRecoveryWorker({repository:new MachineDispenseRepository(prisma),machineDispenseService:f.service,workerId:'rollback-reclaim'}).runOnce();
  assert.equal((await f.repository.findInbox('TEST',callback.providerEventId)).status,'PROCESSED');
});

for (const operationType of ['OPERATOR_TEST', 'MAINTENANCE_TEST']) pg(`${operationType}: durable restart workflow and test inventory`, async () => {
  const f = await fixture(operationType); const attempt = await sent(f);
  const restarted = new MachineDispenseService({ repository: new MachineDispenseRepository(prisma), inventory: new PostgresInventoryReservationService({ prisma }), orderDomain: {}, provider: { reconcileCommand: async () => ({ status: 'DISPENSED', providerEventId: uid('reconcile') }) } });
  await restarted.reconcileUnfinished(f.organizationId); const stored = await f.repository.get(f.organizationId, attempt.id);
  assert.equal(stored.status, 'DISPENSED'); assert.equal(stored.orderId, null); assert.equal(stored.saleFlowId, null); assert.equal(stored.requestedByActorId, f.context.securityContext.subject_id);
  assert.equal(await prisma.inventoryRuntimeMovement.count({ where: { sourceId: f.reservation.reservationId, movementType: 'TEST_CONSUMPTION' } }), 1);
});

pg('restart preserves QUEUED/DISPATCHING/SENT/ACCEPTED/DISPENSING/TIMED_OUT/RECONCILIATION_REQUIRED identity', async () => {
  for (const status of ['QUEUED', 'DISPATCHING', 'SENT', 'ACCEPTED', 'DISPENSING', 'TIMED_OUT', 'RECONCILIATION_REQUIRED']) {
    const f = await fixture('OPERATOR_TEST'); const attempt = (await create(f)).attempt;
    const now=new Date();await prisma.machineDispenseAttempt.update({ where: { id: attempt.id }, data: { status, ...(status === 'TIMED_OUT' && { timedOutAt: now }), ...(['SENT', 'ACCEPTED', 'DISPENSING'].includes(status) && { providerCommandId: attempt.commandId, sentAt:now }), ...(['ACCEPTED','DISPENSING'].includes(status)&&{acceptedAt:now}), ...(status==='DISPENSING'&&{startedAt:now}) } });
    const restarted = new MachineDispenseService({ repository: new MachineDispenseRepository(prisma), inventory: new PostgresInventoryReservationService({ prisma }), orderDomain: {}, provider: { reconcileCommand: async () => ({ status: 'UNKNOWN' }) } });
    await restarted.reconcileUnfinished(f.organizationId); const stored = await f.repository.get(f.organizationId, attempt.id);
    assert.equal(stored.commandId, attempt.commandId); assert.equal(await prisma.machineDispenseAttempt.count({ where: { organizationId: f.organizationId } }), 1);
  }
});

pg('concurrent recovery workers claim an operation once and never dispatch',async()=>{const f=await fixture('OPERATOR_TEST');const attempt=(await create(f)).attempt;await prisma.machineDispenseAttempt.update({where:{id:attempt.id},data:{status:'DISPATCHING'}});let classifications=0;const service={recoverCallback:(inbox,claim)=>f.service.recoverCallback(inbox,claim),requireReconciliation:async current=>{classifications++;return f.service.requireReconciliation(current,'SEND_OUTCOME_UNKNOWN_AFTER_RESTART',{test:true});},reconcileAttempt:async current=>f.service.reconcileAttempt(current)};const workers=Array.from({length:20},(_,i)=>new MachineRecoveryWorker({repository:new MachineDispenseRepository(prisma),machineDispenseService:service,workerId:`recovery-worker-${i}`}));await Promise.all(workers.map(worker=>worker.runOnce()));assert.equal(classifications,1);assert.equal(f.dispatches(),0);assert.equal((await f.repository.get(f.organizationId,attempt.id)).status,'RECONCILIATION_REQUIRED');});

pg('test workflow idempotency rejects changed reason or service context',async()=>{const f=await fixture('OPERATOR_TEST');await create(f);await assert.rejects(()=>f.service.createTestAuthorized({...f.request,operationReason:'Другая причина'},f.context),{code:'MACHINE_DISPENSE_IDEMPOTENCY_CONFLICT'});await assert.rejects(()=>f.service.createTestAuthorized({...f.request,serviceContext:{sessionId:'other'}},f.context),{code:'MACHINE_DISPENSE_IDEMPOTENCY_CONFLICT'});});

pg('test workflows validate trusted actor type, role and tenant fail closed',async()=>{
  const operator=await fixture('OPERATOR_TEST');await create(operator);
  const maintenance=await fixture('MAINTENANCE_TEST');await create(maintenance);
  for(const context of [{},{securityContext:{}},{securityContext:{subject_type:'customer',subject_id:operator.context.securityContext.subject_id}},{securityContext:{subject_type:'organization_member',subject_id:operator.context.securityContext.subject_id,organization_id:uid('other')}}])await assert.rejects(()=>operator.service.createTestAuthorized({...operator.request,idempotencyKey:uid('invalid'),actorId:operator.context.securityContext.subject_id,roles:['OPERATOR'],organizationMember:true},context),{code:/MACHINE_TEST_(AUTHENTICATION_REQUIRED|ACTOR_TYPE_FORBIDDEN|ACTOR_FORBIDDEN)/});
  await prisma.organizationRoleAssignment.updateMany({where:{organizationId:operator.organizationId,memberId:operator.context.securityContext.subject_id},data:{revokedAt:new Date()}});
  await assert.rejects(()=>operator.service.createTestAuthorized({...operator.request,idempotencyKey:uid('role')},operator.context),{code:'MACHINE_TEST_ACTOR_FORBIDDEN'});
  await assert.rejects(()=>maintenance.service.createTestAuthorized({...maintenance.request,idempotencyKey:uid('cross'),actorId:operator.context.securityContext.subject_id},{...maintenance.context,securityContext:{...maintenance.context.securityContext,subject_id:operator.context.securityContext.subject_id}}),{code:'MACHINE_TEST_ACTOR_FORBIDDEN'});
  const spoofed=await maintenance.service.createTestAuthorized({...maintenance.request,idempotencyKey:uid('payload-spoof'),actorId:operator.context.securityContext.subject_id,roles:['CUSTOMER'],organizationMember:false},maintenance.context);
  assert.equal(spoofed.attempt.requestedByActorId,maintenance.context.securityContext.subject_id);
  const inactive=await fixture('OPERATOR_TEST');await prisma.organizationMember.update({where:{id:inactive.context.securityContext.subject_id},data:{status:'INACTIVE'}});await assert.rejects(()=>inactive.service.createTestAuthorized({...inactive.request,idempotencyKey:uid('inactive')},inactive.context),{code:'MACHINE_TEST_ACTOR_FORBIDDEN'});
});

pg('late callbacks and conflicting terminal facts remain safe', async () => {
  const late = await fixture(); let attempt = await sent(late); await late.service.timeout(attempt.id, late.organizationId);
  await late.service.applyPhysicalResult(await late.repository.get(late.organizationId, attempt.id), 'DISPENSED', { providerEventId: uid('late') });
  assert.equal(await prisma.inventoryRuntimeMovement.count({ where: { sourceId: late.reservation.reservationId } }), 1);
  await late.service.applyPhysicalResult(await late.repository.get(late.organizationId, attempt.id), 'FAILED', {});
  assert.equal((await late.repository.get(late.organizationId, attempt.id)).status, 'DISPENSED');
  const failed = await fixture('OPERATOR_TEST'); attempt = await sent(failed); await failed.service.timeout(attempt.id, failed.organizationId);
  await failed.service.applyPhysicalResult(await failed.repository.get(failed.organizationId, attempt.id), 'FAILED', {});
  assert.equal((await failed.repository.get(failed.organizationId, attempt.id)).status, 'RECONCILIATION_REQUIRED');
});

pg('conflicting terminal callbacks preserve the first physical fact and create reconciliation', async () => {
  const dispensed = await fixture();
  let attempt = await sent(dispensed);
  const dispensedCallback = { provider: 'TEST', providerEventId: uid('provider_event'), providerCommandId: attempt.providerCommandId, machineId: dispensed.machineId, status: 'DISPENSED', payload: { status: 'DISPENSED' } };
  await dispensed.service.receiveCallback(dispensedCallback);
  const failedConflict = { ...dispensedCallback, providerEventId: uid('provider_event'), status: 'FAILED', payload: { status: 'FAILED' }, physicalConsumptionUnknown: false };
  await dispensed.service.receiveCallback(failedConflict);
  await dispensed.service.receiveCallback(failedConflict);
  assert.equal((await dispensed.repository.get(dispensed.organizationId, attempt.id)).status, 'DISPENSED');
  assert.equal(await prisma.machineReconciliation.count({ where: { dispenseAttemptId: attempt.id, category: 'CONFLICTING_TERMINAL_CALLBACK' } }), 1);
  assert.equal(await prisma.inventoryRuntimeMovement.count({ where: { sourceId: dispensed.reservation.reservationId, movementType: 'CONSUMPTION' } }), 1);
  assert.equal(await prisma.transactionalOutboxEvent.count({ where: { aggregateId: attempt.id, eventType: 'MACHINE_DISPENSED' } }), 1);

  const failed = await fixture();
  attempt = await sent(failed);
  const failedCallback = { provider: 'TEST', providerEventId: uid('provider_event'), providerCommandId: attempt.providerCommandId, machineId: failed.machineId, status: 'FAILED', payload: { status: 'FAILED' }, physicalConsumptionUnknown: false };
  await failed.service.receiveCallback(failedCallback);
  const dispensedConflict = { ...failedCallback, providerEventId: uid('provider_event'), status: 'DISPENSED', payload: { status: 'DISPENSED' } };
  await failed.service.receiveCallback(dispensedConflict);
  await failed.service.receiveCallback(dispensedConflict);
  assert.equal((await failed.repository.get(failed.organizationId, attempt.id)).status, 'FAILED');
  assert.equal(await prisma.machineReconciliation.count({ where: { dispenseAttemptId: attempt.id, category: 'CONFLICTING_TERMINAL_CALLBACK' } }), 1);
  assert.equal((await prisma.inventoryRuntimeReservation.findUnique({ where: { reservationId: failed.reservation.reservationId } })).status, 'RELEASED');
  assert.equal(await prisma.inventoryRuntimeMovement.count({ where: { sourceId: failed.reservation.reservationId, movementType: 'CONSUMPTION' } }), 0);
  assert.equal((await prisma.order.findUnique({ where: { id: failed.orderId } })).status, 'PAID');
  assert.equal((await prisma.saleFlow.findUnique({ where: { flowId: failed.saleFlowId } })).currentState, 'REFUND_REQUIRED');
  assert.equal(await prisma.transactionalOutboxEvent.count({ where: { aggregateId: attempt.id, eventType: 'MACHINE_DISPENSED' } }), 0);
});

pg('tenant, machine and idempotency conflicts fail closed', async () => {
  const f = await fixture();
  const attempt = (await create(f)).attempt;
  await assert.rejects(() => f.service.deliverCommand({ organizationId: uid('other_org'), aggregateId: attempt.id }), { code: 'DISPENSE_ATTEMPT_NOT_FOUND' });
  const sentAttempt = await sent(f);
  await assert.rejects(() => f.service.receiveCallback({ provider: 'TEST', providerEventId: uid('provider_event'), providerCommandId: sentAttempt.providerCommandId, machineId: uid('other_machine'), status: 'DISPENSED', payload: {} }), { code: 'MACHINE_CALLBACK_TARGET_UNKNOWN' });
  await assert.rejects(() => f.service.createAuthorized({ ...f.request, idempotencyKey: uid('different_key') }, f.context), { code: 'MACHINE_DISPENSE_IDEMPOTENCY_CONFLICT' });
  const callback = { provider: 'TEST', providerEventId: uid('provider_event'), providerCommandId: sentAttempt.providerCommandId, machineId: f.machineId, status: 'ACCEPTED', payload: { status: 'ACCEPTED' } };
  await f.service.receiveCallback(callback);
  await assert.rejects(() => f.service.receiveCallback({ ...callback, status: 'DISPENSED', payload: { status: 'DISPENSED' } }), { code: 'MACHINE_CALLBACK_IDEMPOTENCY_CONFLICT' });
});

pg('PostgreSQL rejects impossible Machine lifecycle temporal states through direct SQL',async()=>{
  const f=await fixture();const attempt=(await create(f)).attempt;const now=new Date();
  for(const [status,patch] of [['SENT',{}],['ACCEPTED',{sentAt:now}],['DISPENSING',{sentAt:now,acceptedAt:now}],['DISPENSED',{sentAt:now,acceptedAt:now,startedAt:now}],['FAILED',{}],['TIMED_OUT',{}]]){
    await assert.rejects(()=>prisma.$executeRawUnsafe(`UPDATE "MachineDispenseAttempt" SET "status"=$1::"MachineDispenseStatus", "sentAt"=$2, "acceptedAt"=$3, "startedAt"=$4, "completedAt"=$5, "failedAt"=$6, "timedOutAt"=$7 WHERE "id"=$8`,status,patch.sentAt||null,patch.acceptedAt||null,patch.startedAt||null,patch.completedAt||null,patch.failedAt||null,patch.timedOutAt||null,attempt.id));
  }
  const inbox=await f.repository.inbox({organizationId:f.organizationId,dispenseAttemptId:attempt.id,provider:'TEST',providerEventId:uid('provider_event'),machineId:f.machineId,providerCommandId:attempt.commandId,payloadSafe:{},payloadFingerprint:uid('fingerprint'),callbackStatus:'ACCEPTED'});
  await assert.rejects(()=>prisma.$executeRawUnsafe(`UPDATE "MachineCallbackInbox" SET "status"='PROCESSING', "processingStartedAt"=NULL WHERE "id"=$1`,inbox.id));
  await assert.rejects(()=>prisma.$executeRawUnsafe(`UPDATE "MachineCallbackInbox" SET "status"='PROCESSED', "processingStartedAt"=NULL, "processedAt"=NOW() WHERE "id"=$1`,inbox.id));
  await assert.rejects(()=>prisma.$executeRawUnsafe(`UPDATE "MachineCallbackInbox" SET "status"='FAILED', "processingStartedAt"=NOW(), "failedAt"=NULL WHERE "id"=$1`,inbox.id));
});

for (const injectionPoint of ['MACHINE_PERSISTENCE', 'INVENTORY_CONSUME', 'ORDER_COMPLETION', 'SALE_FLOW_COMPLETION', 'TRANSACTIONAL_OUTBOX']) pg(`failure injection rolls back ${injectionPoint}`, async () => {
  const f = await fixture(); const attempt = await sent(f);
  const injected = new MachineDispenseService({ repository: f.repository, inventory: f.inventory, orderDomain: f.orderDomain, provider: f.provider, failureInjector: async (point) => { if (point === injectionPoint) throw Object.assign(new Error('injected'), { code: `INJECT_${point}` }); } });
  await assert.rejects(() => injected.applyPhysicalResult(attempt, 'DISPENSED', { providerEventId: uid('injected') }), { code: `INJECT_${injectionPoint}` });
  const stored = await f.repository.get(f.organizationId, attempt.id);
  assert.equal(stored.status, 'RECONCILIATION_REQUIRED');
  assert.equal((await prisma.inventoryRuntimeReservation.findUnique({ where: { reservationId: f.reservation.reservationId } })).status, 'RESERVED');
  assert.equal((await prisma.order.findUnique({ where: { id: f.orderId } })).status, 'PAID');
  assert.equal((await prisma.saleFlow.findUnique({ where: { flowId: f.saleFlowId } })).currentState, 'FULFILLMENT_AUTHORIZED');
  assert.equal(await prisma.transactionalOutboxEvent.count({ where: { aggregateId: attempt.id, eventType: 'MACHINE_DISPENSED' } }), 0);
  await assert.rejects(() => injected.deliverCommand({ organizationId: f.organizationId, aggregateId: attempt.id }), { code: 'DISPENSE_COMMAND_NOT_QUEUED' });
  const restarted = new MachineDispenseService({ repository: new MachineDispenseRepository(prisma), inventory: new PostgresInventoryReservationService({ prisma }), orderDomain: f.orderDomain, provider: { sendDispenseCommand: async () => { throw new Error('physical resend forbidden'); }, reconcileCommand: async () => ({ status: 'DISPENSED', providerEventId: uid('recovered') }) } });
  await restarted.reconcileUnfinished(f.organizationId);
  assert.equal((await f.repository.get(f.organizationId, attempt.id)).status, 'DISPENSED');
  assert.equal(f.dispatches(), 1);
  assert.equal(await prisma.inventoryRuntimeMovement.count({ where: { sourceId: f.reservation.reservationId, movementType: 'CONSUMPTION' } }), 1);
  assert.equal((await prisma.order.findUnique({ where: { id: f.orderId } })).status, 'COMPLETED');
  assert.equal((await prisma.saleFlow.findUnique({ where: { flowId: f.saleFlowId } })).currentState, 'COMPLETED');
  assert.equal(await prisma.transactionalOutboxEvent.count({ where: { aggregateId: attempt.id, eventType: 'MACHINE_DISPENSED' } }), 1);
  assert.equal(await prisma.machineDispenseAuditEntry.count({ where: { dispenseAttemptId: attempt.id, action: 'DISPENSED' } }), 1);
});
