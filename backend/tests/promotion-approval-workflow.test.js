'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PromotionService } = require('../src/modules/promotion_engine/PromotionService');

function campaign(policy = 'SINGLE_APPROVAL') {
  return {
    id: 'campaign-1', code: 'HAPPY_HOUR', name: 'Час выгоды', status: 'READY',
    currentVersion: { id: 'version-1', approvalPolicy: policy },
  };
}

function repositoryFixture(policy = 'SINGLE_APPROVAL') {
  const approvals = [];
  let pending = null;
  const repo = {
    async getCampaignById() { return campaign(policy); },
    async requestApproval(input) { pending = { id: 'request-1', status: 'PENDING', requestedAt: new Date(), ...input }; approvals.push(pending); return pending; },
    async getPendingApprovalRequest() { return pending && pending.status === 'PENDING' ? pending : null; },
    async recordApprovalDecision(input) { const row = { id: `decision-${approvals.length}`, decidedAt: new Date(), ...input }; approvals.push(row); if (input.status === 'REJECTED' && pending) pending.status = 'REJECTED'; return row; },
    async listApprovals() { return approvals; },
    async countApprovals() { return new Set(approvals.filter((x) => x.status === 'APPROVED').map((x) => x.decidedBy)).size; },
    async hasOwnerApproval() { return approvals.some((x) => x.status === 'APPROVED' && (x.metadata?.deciderRoles || []).includes('OWNER')); },
    async transitionStatus() { return {}; },
  };
  return { repo, approvals, getPending: () => pending };
}

test('READY campaign can request approval', async () => {
  const { repo } = repositoryFixture();
  const service = new PromotionService({ repository: repo });
  const result = await service.requestApproval({ campaignId: 'campaign-1', actorId: 'manager-1', reason: 'Проверить запуск' });
  assert.equal(result.status, 'PENDING');
  assert.equal(result.requestedBy, 'manager-1');
});

test('approval requester cannot self-approve', async () => {
  const { repo } = repositoryFixture();
  const service = new PromotionService({ repository: repo });
  await service.requestApproval({ campaignId: 'campaign-1', actorId: 'manager-1' });
  await assert.rejects(
    () => service.approve({ campaignId: 'campaign-1', actorId: 'manager-1', actorRoles: ['MANAGER'] }),
    (error) => error.code === 'PROMOTION_SELF_APPROVAL_FORBIDDEN',
  );
});

test('same actor cannot approve twice', async () => {
  const { repo } = repositoryFixture('DUAL_APPROVAL');
  const service = new PromotionService({ repository: repo });
  await service.requestApproval({ campaignId: 'campaign-1', actorId: 'manager-1' });
  await service.approve({ campaignId: 'campaign-1', actorId: 'admin-1', actorRoles: ['ADMIN'] });
  await assert.rejects(
    () => service.approve({ campaignId: 'campaign-1', actorId: 'admin-1', actorRoles: ['ADMIN'] }),
    (error) => error.code === 'PROMOTION_DUPLICATE_APPROVAL',
  );
});

test('OWNER_APPROVAL rejects non-owner and accepts OWNER', async () => {
  const { repo } = repositoryFixture('OWNER_APPROVAL');
  const service = new PromotionService({ repository: repo });
  await service.requestApproval({ campaignId: 'campaign-1', actorId: 'manager-1' });
  await assert.rejects(
    () => service.approve({ campaignId: 'campaign-1', actorId: 'admin-1', actorRoles: ['ADMIN'] }),
    (error) => error.code === 'PROMOTION_OWNER_APPROVAL_REQUIRED',
  );
  const approved = await service.approve({ campaignId: 'campaign-1', actorId: 'owner-1', actorRoles: ['OWNER'] });
  assert.equal(approved.status, 'APPROVED');
});

test('rejection requires reason', async () => {
  const { repo } = repositoryFixture();
  const service = new PromotionService({ repository: repo });
  await service.requestApproval({ campaignId: 'campaign-1', actorId: 'manager-1' });
  await assert.rejects(
    () => service.reject({ campaignId: 'campaign-1', actorId: 'admin-1', actorRoles: ['ADMIN'] }),
    (error) => error.code === 'PROMOTION_REJECTION_REASON_REQUIRED',
  );
});

test('DUAL_APPROVAL counts two distinct approvers before activation', async () => {
  const { repo } = repositoryFixture('DUAL_APPROVAL');
  const service = new PromotionService({ repository: repo });
  await service.requestApproval({ campaignId: 'campaign-1', actorId: 'manager-1' });
  await service.approve({ campaignId: 'campaign-1', actorId: 'admin-1', actorRoles: ['ADMIN'] });
  await assert.rejects(
    () => service.activate({ campaignId: 'campaign-1', actorId: 'owner-1' }),
    (error) => error.code === 'PROMOTION_APPROVAL_REQUIRED',
  );
  await service.approve({ campaignId: 'campaign-1', actorId: 'owner-1', actorRoles: ['OWNER'] });
  const result = await service.activate({ campaignId: 'campaign-1', actorId: 'owner-2' });
  assert.equal(result.status, 'READY');
});
