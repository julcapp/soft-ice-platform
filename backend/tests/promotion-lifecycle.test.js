'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PromotionService } = require('../src/modules/promotion_engine/PromotionService');

function campaign(status='READY', policy='SINGLE_APPROVAL') {
  return { id:'promo-1', code:'HAPPY_HOUR', name:'Час выгоды', status, currentVersion:{ id:'ver-1', approvalPolicy:policy, schedules:[], targets:[], audiences:[], rules:[], channels:[] } };
}
function fixture(status='READY', policy='SINGLE_APPROVAL', approvals=1) {
  let state=status; const events=[];
  const repository={
    async getCampaignById(){ const c=campaign(state,policy); return c; },
    async countApprovals(){ return approvals; },
    async transitionStatus(payload){ events.push(payload); state=payload.status; return {status:state}; },
  };
  return { service:new PromotionService({repository}), events, state:()=>state };
}

test('READY campaign schedules only after required approval', async()=>{
  const {service,state,events}=fixture('READY','SINGLE_APPROVAL',1);
  const startsAt=new Date(Date.now()+3600000).toISOString();
  await service.schedule({campaignId:'promo-1',actorId:'manager-1',startsAt});
  assert.equal(state(),'SCHEDULED');
  assert.equal(events[0].eventType,'SCHEDULED');
});

test('activation is blocked when approval policy is not satisfied', async()=>{
  const {service}=fixture('READY','DUAL_APPROVAL',1);
  await assert.rejects(()=>service.activate({campaignId:'promo-1',actorId:'admin-1'}),(error)=>error.code==='PROMOTION_APPROVAL_REQUIRED');
});

test('run now activates READY campaign and records RUN_NOW', async()=>{
  const {service,state,events}=fixture('READY','NONE',0);
  await service.activate({campaignId:'promo-1',actorId:'admin-1',runNow:true,durationMinutes:60});
  assert.equal(state(),'ACTIVE');
  assert.equal(events[0].eventType,'RUN_NOW');
  assert.ok(events[0].versionPatch.startsAt instanceof Date);
  assert.ok(events[0].versionPatch.endsAt instanceof Date);
});

test('ACTIVE can pause and PAUSED can resume', async()=>{
  const {service,state}=fixture('ACTIVE','NONE',0);
  await service.pause({campaignId:'promo-1',actorId:'admin-1',reason:'manual'});
  assert.equal(state(),'PAUSED');
  await service.resume({campaignId:'promo-1',actorId:'admin-1'});
  assert.equal(state(),'ACTIVE');
});

test('ENDED can archive but cannot reactivate', async()=>{
  const {service,state}=fixture('ENDED','NONE',0);
  await service.archive({campaignId:'promo-1',actorId:'owner-1'});
  assert.equal(state(),'ARCHIVED');
  const other=fixture('ENDED','NONE',0).service;
  await assert.rejects(()=>other.activate({campaignId:'promo-1',actorId:'admin-1'}),(error)=>error.code==='PROMOTION_INVALID_TRANSITION');
});
