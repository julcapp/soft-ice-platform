'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PromotionRepository, cloneChildRows } = require('../src/modules/promotion_engine/PromotionRepository');

function fakePrisma() {
  const state = {
    campaign: { id: 'c1', status: 'PAUSED', currentVersionId: 'v2', effectiveVersionId: 'v1', archivedAt: null },
    versions: {
      v1: { id: 'v1', campaignId: 'c1', version: 1, status: 'PAUSED', schedules: [], targets: [], audiences: [], rules: [], channels: [] },
      v2: { id: 'v2', campaignId: 'c1', version: 2, status: 'DRAFT', schedules: [], targets: [], audiences: [], rules: [], channels: [] },
    },
    events: [],
  };
  const tx = {
    promotionCampaign: {
      findUnique: async () => ({ ...state.campaign, currentVersion: { ...state.versions[state.campaign.currentVersionId] }, effectiveVersion: state.campaign.effectiveVersionId ? { ...state.versions[state.campaign.effectiveVersionId] } : null }),
      update: async ({ data }) => { Object.assign(state.campaign, data); return { ...state.campaign }; },
    },
    promotionVersion: {
      update: async ({ where, data }) => { Object.assign(state.versions[where.id], data); return { ...state.versions[where.id] }; },
    },
    promotionEvent: { create: async ({ data }) => { state.events.push(data); return data; } },
  };
  return { ...tx, $transaction: async (callback) => callback(tx), state };
}

test('resume keeps effective v1 and leaves working v2 DRAFT untouched', async () => {
  const prisma = fakePrisma();
  const repository = new PromotionRepository(prisma);
  const result = await repository.transitionStatus({ campaignId: 'c1', status: 'ACTIVE', actorId: 'admin-2', eventType: 'RESUMED' });
  assert.equal(prisma.state.campaign.effectiveVersionId, 'v1');
  assert.equal(prisma.state.versions.v1.status, 'ACTIVE');
  assert.equal(prisma.state.versions.v2.status, 'DRAFT');
  assert.equal(result.effectiveVersion.id, 'v1');
  assert.equal(result.currentVersion.id, 'v2');
});

test('activation atomically switches effective pointer from v1 to working v2', async () => {
  const prisma = fakePrisma();
  prisma.state.campaign.status = 'ACTIVE';
  prisma.state.versions.v1.status = 'ACTIVE';
  prisma.state.versions.v2.status = 'READY';
  const repository = new PromotionRepository(prisma);
  const result = await repository.transitionStatus({ campaignId: 'c1', status: 'ACTIVE', actorId: 'admin-2', eventType: 'ACTIVATED' });
  assert.equal(prisma.state.campaign.effectiveVersionId, 'v2');
  assert.equal(prisma.state.versions.v1.status, 'SUPERSEDED');
  assert.equal(prisma.state.versions.v2.status, 'ACTIVE');
  assert.equal(result.effectiveVersion.id, 'v2');
});

test('cloned child rows never reuse Prisma identity fields', () => {
  const rows = cloneChildRows([{ id: 'old', promotionVersionId: 'v1', createdAt: new Date(), updatedAt: new Date(), channel: 'MAX', enabled: true }]);
  assert.deepEqual(rows, [{ channel: 'MAX', enabled: true }]);
});
