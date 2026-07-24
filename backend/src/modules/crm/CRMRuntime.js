class CRMRuntime {
  constructor({ service }) { this.service = service; }
  getDashboard() { return this.service.getDashboard(); }
  listCustomers(options) { return this.service.listCustomers(options); }
  getCustomerCard(customerId) { return this.service.getCustomerCard(customerId); }
  updateCustomerCard(customerId, request, context) { return this.service.updateCustomerCard(customerId, request, context); }
  topUp(customerId, request, context) { return this.service.topUp(customerId, request, context); }
  assignSegment(customerId, segmentId, request, context) { return this.service.assignSegment(customerId, segmentId, request, context); }
  createCampaign(request, context) { return this.service.createCampaign(request, context); }
  queueNotification(customerId, request, context) { return this.service.queueNotification(customerId, request, context); }
}

module.exports = { CRMRuntime };
