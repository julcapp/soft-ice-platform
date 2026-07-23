const { ApiError } = require('../../platform/errors/ApiError');
const { CustomerSegment } = require('./CustomerSegment');
const { SEGMENT_STATUSES, SEGMENT_TYPES, Segment, isCode } = require('./Segment');
const { SegmentRule } = require('./SegmentRule');

class SegmentationService {
  constructor({ segmentationRepository, customerRepository, auditRepository, clock = () => new Date() }) {
    this.repository = segmentationRepository;
    this.customerRepository = customerRepository;
    this.auditRepository = auditRepository;
    this.clock = clock;
  }

  async createSegment(request, context = {}) {
    validateSegmentRequest(request);
    if (await this.repository.findSegmentByCode(request.code)) throw conflict('SEGMENT_CODE_CONFLICT', 'Segment code already exists.');
    const segment = new Segment(await this.repository.createSegment({
      code: request.code, name: request.name.trim(), description: request.description || null,
      type: request.type, status: request.status || 'ACTIVE',
    }));
    await this.audit('Segments.Created', segment.id, 'create', context, { code: segment.code, type: segment.type });
    return segment;
  }

  async listSegments() { return (await this.repository.listSegments()).map((record) => new Segment(record)); }

  async setActivation(segmentId, active, context = {}) {
    if (typeof active !== 'boolean') throw validation('active', 'must be a boolean');
    if (!await this.repository.findSegmentById(segmentId)) throw notFound('Segment');
    const segment = new Segment(await this.repository.setSegmentStatus(segmentId, active ? 'ACTIVE' : 'INACTIVE'));
    await this.audit('Segments.ActivationChanged', segment.id, active ? 'activate' : 'deactivate', context, { status: segment.status });
    return segment;
  }

  async addRule(segmentId, request, context = {}) {
    const segment = await this.repository.findSegmentById(segmentId);
    if (!segment) throw notFound('Segment');
    if (segment.type !== 'SYSTEM') throw conflict('SEGMENT_RULE_NOT_ALLOWED', 'Rules are supported only for system segments.');
    if (!request || typeof request.rule_type !== 'string' || !request.rule_type.trim()) throw validation('rule_type', 'must be a non-empty string');
    if (!request.criteria || typeof request.criteria !== 'object' || Array.isArray(request.criteria)) throw validation('criteria', 'must be an object');
    const rule = new SegmentRule(await this.repository.addRule(segmentId, { ruleType: request.rule_type, criteria: request.criteria, priority: request.priority || 0 }));
    await this.audit('Segments.RuleAdded', segmentId, 'add_rule', context, { rule_type: rule.ruleType });
    return rule;
  }

  async assignCustomer(customerId, segmentId, request = {}, context = {}) {
    if (!await this.customerRepository.findById(customerId)) throw notFound('Customer');
    const segment = await this.repository.findSegmentById(segmentId);
    if (!segment) throw notFound('Segment');
    if (segment.status !== 'ACTIVE') throw conflict('SEGMENT_INACTIVE', 'Customers cannot be assigned to an inactive segment.');
    const source = request.source || (segment.type === 'MANUAL' ? 'manual' : 'system');
    if (!['manual', 'system'].includes(source) || (segment.type === 'MANUAL' && source !== 'manual') || (segment.type === 'SYSTEM' && source !== 'system')) {
      throw validation('source', 'must match the segment type');
    }
    const result = await this.repository.assignCustomer({ customerId, segmentId, source, reason: request.reason || null, assignedBy: context.actorId || null, assignedAt: this.clock() });
    const assignment = new CustomerSegment(result.assignment);
    await this.audit('Segments.CustomerAssigned', assignment.id, 'assign_customer', context, { customer_id: customerId, segment_id: segmentId, duplicate: !result.created });
    return { assignment, created: result.created };
  }

  async unassignCustomer(customerId, segmentId, context = {}) {
    const assignment = await this.repository.unassignCustomer(customerId, segmentId, this.clock());
    if (!assignment) throw notFound('Active customer segment assignment');
    await this.audit('Segments.CustomerUnassigned', assignment.id, 'unassign_customer', context, { customer_id: customerId, segment_id: segmentId });
    return new CustomerSegment(assignment);
  }

  async activeForCustomer(customerId) {
    if (!await this.customerRepository.findById(customerId)) throw notFound('Customer');
    return (await this.repository.findActiveForCustomer(customerId)).map((record) => new CustomerSegment(record));
  }

  async historyForCustomer(customerId) {
    if (!await this.customerRepository.findById(customerId)) throw notFound('Customer');
    return (await this.repository.findHistoryForCustomer(customerId)).map((record) => new CustomerSegment(record));
  }

  audit(eventType, targetId, action, context, metadata) {
    return this.auditRepository.record({ eventType, subjectType: context.actorType || 'system', subjectId: context.actorId || null,
      targetType: 'Segmentation', targetId, action, decision: 'success', reasonCode: context.reasonCode || null,
      authMethod: context.authMethod, sourceChannel: context.sourceChannel, correlationId: context.correlationId, metadata });
  }
}

function validateSegmentRequest(request) {
  if (!request || !isCode(request.code)) throw validation('code', 'must be uppercase SNAKE_CASE');
  if (typeof request.name !== 'string' || !request.name.trim()) throw validation('name', 'must be a non-empty string');
  if (!SEGMENT_TYPES.includes(request.type)) throw validation('type', `must be one of ${SEGMENT_TYPES.join(', ')}`);
  if (request.status && !SEGMENT_STATUSES.includes(request.status)) throw validation('status', `must be one of ${SEGMENT_STATUSES.join(', ')}`);
}
function validation(field, issue) { return new ApiError({ statusCode: 400, code: 'VALIDATION_FAILED', message: 'Request validation failed.', details: [{ field, issue }], source: 'api' }); }
function notFound(resource) { return new ApiError({ statusCode: 404, code: 'RESOURCE_NOT_FOUND', message: `${resource} was not found.`, source: 'runtime' }); }
function conflict(code, message) { return new ApiError({ statusCode: 409, code, message, source: 'runtime' }); }

module.exports = { SegmentationService };
