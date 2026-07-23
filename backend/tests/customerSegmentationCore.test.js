const assert = require('node:assert/strict');
const test = require('node:test');
const { SegmentationService } = require('../src/modules/segmentation/SegmentationService');
const { toCustomerSegmentDto, toSegmentDto } = require('../src/modules/segmentation/segmentationDto');

const now = new Date('2026-07-21T08:00:00.000Z');

function fixture() {
  const repository = new MemorySegmentationRepository();
  const audits = [];
  const service = new SegmentationService({
    segmentationRepository: repository,
    customerRepository: { findById: async (id) => id === 'customer_1' ? { id } : null },
    auditRepository: { record: async (event) => audits.push(event) },
    clock: () => now,
  });
  return { repository, audits, service };
}

test('creates manual and system segments with stable DTO values', async () => {
  const { service } = fixture();
  const manual = await service.createSegment({ code: 'VIP_CUSTOMER', name: 'VIP Customer', type: 'MANUAL' });
  const system = await service.createSegment({ code: 'NEW_CUSTOMER', name: 'New Customer', type: 'SYSTEM' });
  assert.equal(toSegmentDto(manual).attributes.segment_type, 'manual');
  assert.equal(toSegmentDto(system).attributes.status, 'active');
  assert.deepEqual((await service.listSegments()).map(({ code }) => code), ['NEW_CUSTOMER', 'VIP_CUSTOMER']);
});

test('supports rules only on system segments', async () => {
  const { service } = fixture();
  const system = await service.createSegment({ code: 'BIRTHDAY_UPCOMING', name: 'Birthday upcoming', type: 'SYSTEM' });
  const manual = await service.createSegment({ code: 'CLUB_MEMBER', name: 'Club member', type: 'MANUAL' });
  const rule = await service.addRule(system.id, { rule_type: 'birthday_within_days', criteria: { days: 7 }, priority: 10 });
  assert.equal(rule.criteria.days, 7);
  await assert.rejects(() => service.addRule(manual.id, { rule_type: 'x', criteria: {} }), ({ code }) => code === 'SEGMENT_RULE_NOT_ALLOWED');
});

test('manual assignment is idempotent and unassignment preserves history', async () => {
  const { service } = fixture();
  const segment = await service.createSegment({ code: 'VIP_CUSTOMER', name: 'VIP', type: 'MANUAL' });
  const first = await service.assignCustomer('customer_1', segment.id, { source: 'manual', reason: 'support_review' }, { actorId: 'operator_1' });
  const duplicate = await service.assignCustomer('customer_1', segment.id, { source: 'manual' });
  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal((await service.activeForCustomer('customer_1')).length, 1);
  await service.unassignCustomer('customer_1', segment.id);
  assert.equal((await service.activeForCustomer('customer_1')).length, 0);
  const history = await service.historyForCustomer('customer_1');
  assert.equal(history.length, 1);
  assert.equal(toCustomerSegmentDto(history[0]).attributes.active, false);
});

test('inactive segments reject new assignments', async () => {
  const { service } = fixture();
  const segment = await service.createSegment({ code: 'ACTIVE_CUSTOMER', name: 'Active', type: 'SYSTEM' });
  await service.setActivation(segment.id, false);
  await assert.rejects(() => service.assignCustomer('customer_1', segment.id, { source: 'system' }), ({ code }) => code === 'SEGMENT_INACTIVE');
});

class MemorySegmentationRepository {
  constructor() { this.segments = []; this.assignments = []; this.rules = []; }
  async createSegment(data) { const row = { id: `segment_${this.segments.length + 1}`, ...data, rules: [], createdAt: now, updatedAt: now }; this.segments.push(row); return row; }
  async findSegmentById(id) { return this.segments.find((item) => item.id === id) || null; }
  async findSegmentByCode(code) { return this.segments.find((item) => item.code === code) || null; }
  async listSegments() { return [...this.segments].sort((a, b) => a.code.localeCompare(b.code)); }
  async setSegmentStatus(id, status) { const item = await this.findSegmentById(id); item.status = status; return item; }
  async addRule(segmentId, data) { const rule = { id: `rule_${this.rules.length + 1}`, segmentId, ...data, createdAt: now, updatedAt: now }; this.rules.push(rule); return rule; }
  async assignCustomer(command) {
    const existing = this.assignments.find((item) => item.customerId === command.customerId && item.segmentId === command.segmentId && !item.unassignedAt);
    if (existing) return { assignment: existing, created: false };
    const assignment = { id: `assignment_${this.assignments.length + 1}`, ...command, unassignedAt: null, segment: await this.findSegmentById(command.segmentId) };
    this.assignments.push(assignment); return { assignment, created: true };
  }
  async unassignCustomer(customerId, segmentId, unassignedAt) { const item = this.assignments.find((row) => row.customerId === customerId && row.segmentId === segmentId && !row.unassignedAt); if (!item) return null; item.unassignedAt = unassignedAt; return item; }
  async findActiveForCustomer(customerId) { return this.assignments.filter((item) => item.customerId === customerId && !item.unassignedAt && item.segment.status === 'ACTIVE'); }
  async findHistoryForCustomer(customerId) { return this.assignments.filter((item) => item.customerId === customerId); }
}
