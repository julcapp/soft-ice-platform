const { SegmentationService } = require('./SegmentationService');

class SegmentationRuntime {
  constructor(options) { this.segmentationService = options.segmentationService || new SegmentationService(options); }
  createSegment(request, context) { return this.segmentationService.createSegment(request, context); }
  listSegments() { return this.segmentationService.listSegments(); }
  setSegmentActivation(segmentId, active, context) { return this.segmentationService.setActivation(segmentId, active, context); }
  addSegmentRule(segmentId, request, context) { return this.segmentationService.addRule(segmentId, request, context); }
  assignCustomer(customerId, segmentId, request, context) { return this.segmentationService.assignCustomer(customerId, segmentId, request, context); }
  unassignCustomer(customerId, segmentId, context) { return this.segmentationService.unassignCustomer(customerId, segmentId, context); }
  listCustomerSegments(customerId) { return this.segmentationService.activeForCustomer(customerId); }
  listCustomerSegmentHistory(customerId) { return this.segmentationService.historyForCustomer(customerId); }
}

module.exports = { SegmentationRuntime };
