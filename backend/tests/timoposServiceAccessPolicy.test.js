'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateServiceAccess } = require('../src/modules/timopos/TimoPosServiceAccessPolicy');
const now = new Date('2026-11-17T09:00:00Z');
const actor = { id:'tech-1',status:'ACTIVE',assignedPointIds:['point-001'],assignedTerminalIds:['POS-001'] };
const terminal = { id:'POS-001',pointId:'point-001',active:true };
const session = { id:'session-1',actorId:'tech-1',terminalId:'POS-001',pointId:'point-001',
  active:true,expiresAt:'2026-11-17T09:30:00Z',serverVerifiedRole:'TECHNICIAN' };
const ctx = (operation, extra = {}) => ({now,actor,terminal,session,operation,...extra});
const allow = input => evaluateServiceAccess(input).allowed;

test('valid technician may perform scoped read only',()=>{
 assert.equal(allow(ctx('diagnostics.read')),true);
 assert.equal(allow(ctx('network.read')),true);
 assert.equal(allow(ctx('devices.calibrate')),false);
 assert.equal(allow(ctx('software.update')),false);
});
test('triple tap alone cannot provide a valid session',()=>{
 assert.deepEqual(evaluateServiceAccess(ctx('diagnostics.read',{session:null})).code,'SESSION_NOT_VALID');
});
test('missing or revoked staff, session and disabled terminal fail closed',()=>{
 assert.equal(allow(ctx('diagnostics.read',{actor:{...actor,status:'BLOCKED'}})),false);
 assert.equal(allow(ctx('diagnostics.read',{session:{...session,revokedAt:now}})),false);
 assert.equal(allow(ctx('diagnostics.read',{terminal:{...terminal,active:false}})),false);
});
test('session must match actor, point and terminal',()=>{
 assert.equal(allow(ctx('diagnostics.read',{session:{...session,terminalId:'POS-002'}})),false);
 assert.equal(allow(ctx('diagnostics.read',{session:{...session,pointId:'point-002'}})),false);
 assert.equal(allow(ctx('diagnostics.read',{session:{...session,actorId:'other'}})),false);
 assert.equal(allow(ctx('diagnostics.read',{actor:{...actor,assignedPointIds:[]}})),false);
 assert.equal(allow(ctx('diagnostics.read',{actor:{...actor,assignedTerminalIds:[]}})),false);
});
test('expiry is exclusive; missing expiry fails closed',()=>{
 assert.equal(allow(ctx('diagnostics.read',{now:new Date('2026-11-17T09:30:00Z')})),false);
 assert.equal(allow(ctx('diagnostics.read',{session:{...session,expiresAt:null}})),false);
});
test('server-verified service role required; seller cannot elevate',()=>{
 assert.equal(allow(ctx('diagnostics.read',{session:{...session,serverVerifiedRole:'SELLER'}})),false);
 assert.equal(allow(ctx('diagnostics.read',{session:{...session,serverVerifiedRole:'MASTER'}})),true);
});
test('offline state blocks commands but permits low-risk reads',()=>{
 assert.equal(allow(ctx('network.read',{connected:false})),true);
 assert.equal(allow(ctx('devices.self_test',{connected:false})),false);
});
test('master needs server step-up for calibration bound to exact action',()=>{
 const master = {...session,serverVerifiedRole:'MASTER'};
 const approval = {id:'approval-1',confirmedByServer:true,actorId:'tech-1',terminalId:'POS-001',
   operation:'devices.calibrate',confirmedAt:'2026-11-17T08:59:00Z'};
 assert.equal(evaluateServiceAccess(ctx('devices.calibrate',{session:master})).code,'STEP_UP_REQUIRED');
 assert.equal(allow(ctx('devices.calibrate',{session:master,approval})),true);
 assert.equal(allow(ctx('devices.calibrate',{session:master,approval:{...approval,operation:'app.restart'}})),false);
 assert.equal(allow(ctx('devices.calibrate',{session:master,approval:{...approval,terminalId:'POS-002'}})),false);
 assert.equal(allow(ctx('devices.calibrate',{session:master,approval:{...approval,usedAt:now}})),false);
 assert.equal(evaluateServiceAccess(ctx('devices.calibrate',{session:master,approval:{...approval,confirmedAt:'2026-11-17T08:57:00Z'}})).code,'STEP_UP_EXPIRED');
});
test('platform admin needs step-up for terminal assignment too',()=>{
 const elevated = {...session,serverVerifiedRole:'PLATFORM_ADMIN'};
 assert.equal(allow(ctx('terminal.assign',{session:elevated})),false);
 assert.equal(allow(ctx('terminal.assign',{session:elevated,approval:{id:'a',confirmedByServer:true,actorId:actor.id,terminalId:terminal.id,operation:'terminal.assign',confirmedAt:'2026-11-17T08:59:50Z'}})),true);
});
test('unrecognized operation, role, invalid clock fail closed',()=>{
 assert.equal(allow(ctx('device.format')),false);
 assert.equal(allow(ctx('diagnostics.read',{session:{...session,serverVerifiedRole:'__proto__'}})),false);
 assert.equal(allow(ctx('diagnostics.read',{now:new Date('invalid')})),false);
});
