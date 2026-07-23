function toSegmentDto(segment) {
  return { type: 'segment', id: segment.id, attributes: {
    code: segment.code, name: segment.name, description: segment.description || null,
    segment_type: segment.type.toLowerCase(), status: segment.status.toLowerCase(),
    rules: (segment.rules || []).map((rule) => toSegmentRuleDto(rule).attributes),
    created_at: iso(segment.createdAt), updated_at: iso(segment.updatedAt),
  } };
}

function toSegmentRuleDto(rule) {
  return { type: 'segment_rule', id: rule.id, attributes: {
    segment_id: rule.segmentId, rule_type: rule.ruleType, criteria: rule.criteria,
    priority: rule.priority, created_at: iso(rule.createdAt), updated_at: iso(rule.updatedAt),
  } };
}

function toCustomerSegmentDto(assignment) {
  return { type: 'customer_segment', id: assignment.id, attributes: {
    customer_id: assignment.customerId, segment_id: assignment.segmentId,
    segment_code: assignment.segment ? assignment.segment.code : null,
    source: assignment.source, reason: assignment.reason || null, assigned_by: assignment.assignedBy || null,
    active: assignment.unassignedAt == null, assigned_at: iso(assignment.assignedAt), unassigned_at: iso(assignment.unassignedAt),
  } };
}

function iso(value) { return value instanceof Date ? value.toISOString() : value || null; }
module.exports = { toCustomerSegmentDto, toSegmentDto, toSegmentRuleDto };
